/**
 * experience/store.ts — Experience Store（SQLite + FTS5，spec/frozen.md §5 / tasks/phase0.md T6）
 *
 * 已冻结的检索参与规则（spec/frozen.md §4.2）：
 *   deprecated / rejected / conflict  →  不参与检索（权重 0）
 *   candidate / validated / active / stale  →  可参与检索
 *
 * 设计意图（spec/frozen.md §4.2 要求写进代码注释）：
 *   没有 status_weight 乘法因子。candidate 的低影响力来自 independent_support = 1
 *   （见 §5.4 reliability），不是额外降权。
 *   candidate 可以参与检索，但由于独立支持数不足，其 reliability 上限较低；
 *   因此 candidate 在设计上通常只能提供低置信参考，不应被解释为高权威经验。
 *   若 candidate 无法达到高置信，这是预期行为，不是 bug。
 */

import { DatabaseSync } from 'node:sqlite';
import type { Experience } from './schema.ts';
import { normalizeLesson } from './schema.ts';

export const NON_PARTICIPATING_STATUSES = ['deprecated', 'rejected', 'conflict'] as const;

export interface StoreRow {
  id: string;
  experience: Experience;
}

export class ExperienceStore {
  readonly dbPath: string;
  #db: DatabaseSync;

  constructor(dbPath: string, opts?: { readOnly?: boolean }) {
    this.dbPath = dbPath;
    this.#db = new DatabaseSync(dbPath, { readOnly: opts?.readOnly ?? false });
    if (!opts?.readOnly) {
      this.#initSchema();
    }
  }

  #initSchema(): void {
    this.#db.exec(`
      CREATE TABLE IF NOT EXISTS experiences (
        id TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        payload TEXT NOT NULL
      );
      CREATE VIRTUAL TABLE IF NOT EXISTS experience_fts USING fts5(
        id UNINDEXED,
        situation,
        lesson
      );
    `);
  }

  /** 写入/更新一条经验（schema 必须已通过 experience/schema.ts 校验） */
  upsert(exp: Experience): void {
    const lesson = normalizeLesson(exp.lesson);
    const stored: Experience = { ...exp, lesson };
    const payload = JSON.stringify(stored);
    this.#db.exec('BEGIN');
    try {
      this.#db
        .prepare('INSERT INTO experiences (id, status, payload) VALUES (?, ?, ?) ' +
          'ON CONFLICT(id) DO UPDATE SET status = excluded.status, payload = excluded.payload')
        .run(stored.id, stored.status, payload);
      this.#db.prepare('DELETE FROM experience_fts WHERE id = ?').run(stored.id);
      this.#db
        .prepare('INSERT INTO experience_fts (id, situation, lesson) VALUES (?, ?, ?)')
        .run(stored.id, stored.situation, stored.lesson);
      this.#db.exec('COMMIT');
    } catch (e) {
      this.#db.exec('ROLLBACK');
      throw e;
    }
  }

  get(id: string): Experience | undefined {
    const row = this.#db.prepare('SELECT payload FROM experiences WHERE id = ?').get(id) as
      | { payload: string }
      | undefined;
    return row ? (JSON.parse(row.payload) as Experience) : undefined;
  }

  /** §4.2：deprecated / rejected / conflict 不参与检索（权重 0，硬过滤） */
  listRetrievable(): Experience[] {
    const rows = this.#db
      .prepare(
        `SELECT payload FROM experiences WHERE status NOT IN (${NON_PARTICIPATING_STATUSES.map(() => '?').join(',')})`,
      )
      .all(...NON_PARTICIPATING_STATUSES) as Array<{ payload: string }>;
    return rows.map((r) => JSON.parse(r.payload) as Experience);
  }

  /**
   * FTS5 BM25 检索。返回 id → raw_bm25。
   * SQLite FTS5 的 bm25() 越低越相关（spec/frozen.md §5.5）。
   *
   * 查询串构造（实现细节，非公式）：原始文本直接进 MATCH 会因中文标点、括号、引号、
   * 换行等被 FTS5 当作语法而报 `SQL logic error`（实证）。因此先切分为安全 token
   * （字母/数字/CJK 连续段），每个 token 用双引号包裹为字面短语，再以 OR 连接；
   * 无可用 token 时返回空结果（等价于「无命中」，lexical_match=0）。
   * 该处理只影响「哪些候选被 FTS5 命中」，不改变 lexical_match 的冻结公式。
   */
  bm25(queryText: string): Map<string, { raw_bm25: number; matched: boolean }> {
    const out = new Map<string, { raw_bm25: number; matched: boolean }>();
    const tokens = [
      ...new Set(
        (queryText.match(/[\p{Script=Han}\p{L}\p{N}_]+/gu) ?? [])
          .map((t) => t.trim())
          .filter((t) => t.length > 0),
      ),
    ].slice(0, 64);
    if (tokens.length === 0) return out;
    const matchQuery = tokens.map((t) => `"${t.replace(/"/g, '""')}"`).join(' OR ');
    const rows = this.#db
      .prepare('SELECT id, bm25(experience_fts) AS raw_bm25 FROM experience_fts WHERE experience_fts MATCH ?')
      .all(matchQuery) as Array<{ id: string; raw_bm25: number }>;
    for (const r of rows) {
      out.set(r.id, { raw_bm25: r.raw_bm25, matched: true });
    }
    return out;
  }

  close(): void {
    this.#db.close();
  }
}
