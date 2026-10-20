import type { Database } from "../db";

/**
 * Wrap the sqlite seam into the D1-shaped object `handler.fetch` expects in
 * `env.DB`. The raw seam and D1 disagree on two return shapes — `all` answers
 * `{ results }` where the seam answers the bare array, and `run` answers
 * `{ meta }` where the seam answers `{ changes }` — so a test that passes the
 * raw seam as `DB` silently reads every list as empty. `server/index.ts` wraps
 * whatever it receives in `d1Database()`, which reads exactly these shapes.
 */
export interface D1Like {
  prepare(sql: string): D1LikeStatement;
  exec(sql: string): Promise<{ count: number; duration: number }>;
  batch<T = unknown>(statements: D1LikeStatement[]): Promise<Array<{ results: T[] | null; success: boolean; meta?: { changes?: number } }>>;
}

export function asD1(db: Database): D1Like {
  return {
    prepare: (sql: string) => new D1LikeStatement(db.prepare(sql) as never),
    exec: async (sql: string) => {
      await db.exec(sql);
      return { count: 0, duration: 0 };
    },
    batch: async (statements) => (await db.batch(statements.map((s) => (s as D1LikeStatement).raw) as never)).map((r) => ({ results: null, success: true, meta: { changes: r.changes } })),
  };
}

interface D1LikeStatement {
  bind(...values: unknown[]): D1LikeStatement;
  all(): Promise<{ results: unknown[] | null; success: boolean; meta?: { changes?: number } }>;
  first(): Promise<unknown>;
  run(): Promise<{ results: unknown[] | null; success: boolean; meta?: { changes?: number } }>;
}

class D1LikeStatement implements D1LikeStatement {
  constructor(
    private readonly stmt: {
      bind(...v: unknown[]): unknown;
      all(): Promise<unknown[]>;
      first(): Promise<unknown>;
      run(): Promise<{ changes: number }>;
    },
  ) {}

  bind(...values: unknown[]): D1LikeStatement {
    return new D1LikeStatement(this.stmt.bind(...values) as never);
  }

  /** The wrapped seam statement, for `batch`. Same shape as D1's `raw`. */
  get raw(): unknown {
    return this.stmt;
  }

  async all(): Promise<{ results: unknown[] | null; success: boolean; meta?: { changes?: number } }> {
    return { results: await this.stmt.all(), success: true };
  }

  async first(): Promise<unknown> {
    return await this.stmt.first();
  }

  async run(): Promise<{ results: unknown[] | null; success: boolean; meta?: { changes?: number } }> {
    return { results: null, success: true, meta: { changes: (await this.stmt.run()).changes } };
  }
}
