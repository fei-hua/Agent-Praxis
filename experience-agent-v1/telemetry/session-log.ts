/**
 * telemetry/session-log.ts — Harness Session 事件日志解码（T1 数据源）
 *
 * DSH 会话持久化（调研实证，2026-09-27）：
 *   路径：<DSH_HOME>/sessions/<projectKey>/<sessionId>/session.v3.jsonl[.zstd]
 *   首行 = header（{type:'session', version, id, createdAt, cwd, isSeeded,
 *           delegationDepth, parentSession?, origin?, agentPreset?}）
 *   之后每行一个 SessionEvent：{type, seq, time, data, ignorable?, surfaceOp?, sourceEventSeqs?}
 *   tool/call data = {turn, step, callId, name, arguments}
 *   tool/result data = {turn, step, message, error?, meta?}，message.source.callId 与
 *   message.content[].toolCallId 用于与 tool/call 配对
 *   压缩为 zstd「拼接帧容器」：每个 append batch 一个独立帧；live 尾部可能有撕裂帧。
 *
 * OQ-015（open）：Phase 0 的 Event Collector 以本日志为数据源（typed 事件流，
 * 与 cordis 'session/event' firehose 同源同内容），进程内插件 / SDK 流留作可替换事件源。
 * 本模块绝不解析最终聊天文本——只处理 typed SessionEvent。
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { zstdDecompressSync } from 'node:zlib';

// ---------- 类型（对齐 DSH SessionEvent 形状，只声明我们需要的字段） ----------

export interface SessionHeader {
  type: 'session';
  version: number;
  id: string;
  createdAt: number;
  cwd?: string;
  isSeeded: boolean;
  delegationDepth: number;
  parentSession?: string;
  origin?: string;
  agentPreset?: string;
}

export interface RawSessionEvent {
  type: string;
  seq: number;
  time: number;
  data: Record<string, unknown>;
  ignorable?: boolean;
  surfaceOp?: string;
  sourceEventSeqs?: number[];
}

export interface DecodedSessionLog {
  header: SessionHeader;
  events: RawSessionEvent[];
  /** 解码来源文件 */
  sourcePath: string;
}

// ---------- zstd 拼接帧解码（含撕裂尾容错） ----------

interface ZstdFrame {
  offset: number;
  size: number;
}

/** 扫描 zstd 拼接帧；返回可完整解码的帧区间（撕裂尾部之后的不完整帧被丢弃） */
export function scanZstdFrames(buf: Buffer): ZstdFrame[] {
  const frames: ZstdFrame[] = [];
  let off = 0;
  while (off + 4 <= buf.length) {
    if (!(buf[off] === 0x28 && buf[off + 1] === 0xb5 && buf[off + 2] === 0x2f && buf[off + 3] === 0xfd)) {
      break; // 非帧头（撕裂/垃圾）：停止
    }
    const start = off;
    off += 4;
    if (off >= buf.length) break;
    const descriptor = buf[off]!;
    off += 1;
    const fcsFlag = (descriptor >> 6) & 0x03;
    const singleSegment = (descriptor >> 5) & 0x01;
    const checksumFlag = (descriptor >> 2) & 0x01;
    const dictIdFlag = descriptor & 0x03;
    if (!singleSegment) off += 1; // Window_Descriptor
    off += [0, 1, 2, 4][dictIdFlag]!; // Dictionary_ID
    off += fcsFlag === 0 ? (singleSegment ? 1 : 0) : fcsFlag === 1 ? 2 : fcsFlag === 2 ? 4 : 8; // Frame_Content_Size

    let last = false;
    let complete = true;
    while (!last) {
      if (off + 3 > buf.length) {
        complete = false;
        break;
      }
      const hdr = buf[off]! | (buf[off + 1]! << 8) | (buf[off + 2]! << 16);
      last = (hdr & 1) === 1;
      const blockType = (hdr >> 1) & 0x03;
      const blockSize = hdr >> 3;
      off += 3;
      if (blockType === 3) {
        complete = false;
        break; // reserved block type
      }
      off += blockType === 1 ? 1 : blockSize; // RLE 块内容恒 1 字节；raw/compressed 块 = blockSize
    }
    if (!complete) break;
    if (checksumFlag) off += 4; // Content_Checksum
    frames.push({ offset: start, size: off - start });
  }
  return frames;
}

export function decompressZstdConcatenated(buf: Buffer): Buffer {
  // 实测（2026-09-27，真实 DSH 日志 21MB / 15,737 帧）：Node 的 zstdDecompressSync
  // 对拼接帧只解出第一个帧，因此禁用「整体解码」快路径，一律按帧扫描后逐帧解码再拼接。
  // 末尾撕裂帧（写入中断）允许丢弃——规格只保证最终一致记录（§3.1），不承诺崩溃安全。
  const frames = scanZstdFrames(buf);
  const parts: Buffer[] = [];
  for (const f of frames) {
    try {
      parts.push(zstdDecompressSync(buf.subarray(f.offset, f.offset + f.size)) as Buffer);
    } catch {
      // 单帧损坏/撕裂：跳过该批，保留其余可解批次
    }
  }
  if (parts.length === 0) {
    // 帧扫描识别不出（例如单帧文件的非常规编码）时退回一次性解码
    try {
      return zstdDecompressSync(buf) as Buffer;
    } catch {
      throw new Error('zstd 解码失败：没有可识别的完整帧');
    }
  }
  return Buffer.concat(parts);
}

// ---------- 会话日志读取 ----------

/** 解码一个 session 日志文件（.zstd 或纯 .jsonl） */
export function decodeSessionLog(filePath: string): DecodedSessionLog {
  const raw = readFileSync(filePath);
  const isZstd =
    filePath.endsWith('.zstd') ||
    (raw.length >= 4 && raw[0] === 0x28 && raw[1] === 0xb5 && raw[2] === 0x2f && raw[3] === 0xfd);
  const text = (isZstd ? decompressZstdConcatenated(raw) : raw).toString('utf8');

  const lines = text.split('\n').filter((l) => l.trim() !== '');
  if (lines.length === 0) {
    throw new Error(`空会话日志：${filePath}`);
  }
  const first = JSON.parse(lines[0]!) as Record<string, unknown>;
  if (first['type'] !== 'session') {
    throw new Error(`首行不是会话 header（type:'session'）：${filePath}`);
  }
  const header = first as unknown as SessionHeader;
  const events: RawSessionEvent[] = [];
  for (let i = 1; i < lines.length; i++) {
    const ev = JSON.parse(lines[i]!) as RawSessionEvent;
    if (typeof ev.type !== 'string' || typeof ev.seq !== 'number') {
      throw new Error(`第 ${i + 1} 行不是合法 SessionEvent：${filePath}`);
    }
    events.push(ev);
  }
  return { header, events, sourcePath: filePath };
}

// ---------- 会话发现（避免依赖 projectKey 编码算法，直接按目录扫描） ----------

export interface SessionEntry {
  sessionId: string;
  logPath: string;
  projectKey: string;
}

/** 列出 <dshHome>/sessions 下全部会话（每个 projectKey/<sessionId>/ 目录） */
export function listSessions(dshHome: string): SessionEntry[] {
  const sessionsDir = path.join(dshHome, 'sessions');
  if (!existsSync(sessionsDir)) return [];
  const out: SessionEntry[] = [];
  for (const projectKey of readdirSync(sessionsDir)) {
    const projectDir = path.join(sessionsDir, projectKey);
    if (!statSync(projectDir).isDirectory()) continue;
    for (const sessionId of readdirSync(projectDir)) {
      const sessionDir = path.join(projectDir, sessionId);
      if (!statSync(sessionDir).isDirectory()) continue;
      for (const name of readdirSync(sessionDir)) {
        if (/^session\.v\d+\.jsonl(\.zstd)?$/.test(name)) {
          out.push({ sessionId, logPath: path.join(sessionDir, name), projectKey });
          break;
        }
      }
    }
  }
  return out;
}

export function findSessionLog(dshHome: string, sessionId: string): SessionEntry | undefined {
  return listSessions(dshHome).find((s) => s.sessionId === sessionId);
}

/** 找出某会话的直接子会话（header.parentSession === parentId） */
export function findChildSessions(dshHome: string, parentId: string): SessionEntry[] {
  return listSessions(dshHome).filter((s) => {
    try {
      return decodeSessionLog(s.logPath).header.parentSession === parentId;
    } catch {
      return false;
    }
  });
}
