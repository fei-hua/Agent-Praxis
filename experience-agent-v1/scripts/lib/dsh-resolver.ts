/**
 * scripts/lib/dsh-resolver.ts — 「声明版本 → exact binary」的**唯一**解析实现
 * （人工要求 2026-09-29：启动器与 preflight #12 必须共用，不得各写一套）
 *
 * 设计要点：
 *   - 只认 plan **声明的** harness_version；不选"最新版本"；
 *   - 四种状态，除 RESOLVED 外全部为"不能继续"：
 *       RESOLVED        解析到 exact binary 且真实探测版本 == 声明版本
 *       VERSION_MISMATCH 找到该版本目录，但 binary 自报版本不同（identity 不一致）
 *       NOT_FOUND        本机确实没有该版本
 *       RESOLVER_ERROR   目录/文件读取、解析或探测异常 ⇒ **fail-closed**，不得降级成 NOT_FOUND
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

export type DshResolveResult =
  | { status: 'RESOLVED'; declared: string; resolvedVersion: string; binaryPath: string; available: string[]; probed: string[] }
  | { status: 'VERSION_MISMATCH'; declared: string; probedVersion: string; binaryPath: string; available: string[]; probed: string[] }
  | { status: 'NOT_FOUND'; declared: string; available: string[] }
  | { status: 'RESOLVER_ERROR'; declared: string; message: string; available: string[] };

export interface ResolveOptions {
  /** npx 缓存根目录（默认真实路径；测试可注入临时目录） */
  baseDir?: string;
  /** 显式 bin 路径（优先探测） */
  explicitBin?: string;
  /** 版本探测函数（默认真实执行 `node <bin> --version`；测试可注入） */
  probe?: (bin: string) => string;
}

export const DEFAULT_NPX_BASE = path.join(process.env['LOCALAPPDATA'] ?? '', 'npm-cache', '_npx');

function defaultProbe(bin: string): string {
  const out = execFileSync(process.execPath, [bin, '--version'], { encoding: 'utf8', timeout: 180_000 });
  return out.trim().split('\n').pop()!.trim();
}

export function resolveDshBinary(declared: string, opts: ResolveOptions = {}): DshResolveResult {
  const baseDir = opts.baseDir ?? DEFAULT_NPX_BASE;
  const probe = opts.probe ?? defaultProbe;
  const candidates: Array<{ bin: string; version: string }> = [];
  const available: string[] = [];

  // 1) 扫描安装（读取/解析异常一律 RESOLVER_ERROR，绝不吞掉）
  let dirs: string[];
  try {
    dirs = readdirSync(baseDir);
  } catch (e) {
    return { status: 'RESOLVER_ERROR', declared, message: `无法读取安装目录 ${baseDir}：${(e as Error).message}`, available };
  }
  for (const dir of dirs) {
    const root = path.join(baseDir, dir, 'node_modules', '@deepseek-ai', 'dsh');
    const pkg = path.join(root, 'package.json');
    const bin = path.join(root, 'lib', 'bin.js');
    if (!existsSync(pkg) || !existsSync(bin)) continue; // 与该包无关的目录：跳过
    let version: string;
    try {
      version = (JSON.parse(readFileSync(pkg, 'utf8')) as { version?: string }).version ?? '';
    } catch (e) {
      return { status: 'RESOLVER_ERROR', declared, message: `无法解析 ${pkg}：${(e as Error).message}`, available };
    }
    if (version === '') return { status: 'RESOLVER_ERROR', declared, message: `${pkg} 缺少 version 字段`, available };
    available.push(version);
    candidates.push({ bin, version });
  }
  if (opts.explicitBin && existsSync(opts.explicitBin)) candidates.unshift({ bin: opts.explicitBin, version: declared });

  // 2) 精确匹配优先，然后逐个探测真实版本
  candidates.sort((a, b) => (a.version === declared ? -1 : 0) - (b.version === declared ? -1 : 0));
  const probed: string[] = [];
  for (const c of candidates) {
    let v: string;
    try {
      v = probe(c.bin);
    } catch (e) {
      return { status: 'RESOLVER_ERROR', declared, message: `探测 ${c.bin} 版本失败：${(e as Error).message}`, available };
    }
    probed.push(v);
    if (v === declared) return { status: 'RESOLVED', declared, resolvedVersion: v, binaryPath: c.bin, available, probed };
    if (c.version === declared) {
      // 目录自称是该版本，但 binary 自报不同 ⇒ identity 不一致（危险信号，不继续）
      return { status: 'VERSION_MISMATCH', declared, probedVersion: v, binaryPath: c.bin, available, probed };
    }
  }
  return { status: 'NOT_FOUND', declared, available };
}
