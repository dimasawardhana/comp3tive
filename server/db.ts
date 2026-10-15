/**
 * The database seam.
 *
 * One narrow interface over D1, so `server/storage.ts` reads as queries and
 * nothing else. It exists because the alternative — calling `env.DB` directly
 * from every query site — makes the storage code untestable without a Worker
 * runtime, and this repository's unit tests run in plain node.
 *
 * The test adapter (`server/test-support/sqlite.ts`) implements this over
 * `node:sqlite`, so the tests execute the **real schema against real SQLite**
 * rather than asserting against a mock. That is the point of the seam: a mock
 * would happily accept a query D1 rejects, and the constraints that matter here
 * (a credential id is unique, a session token is unique) are enforced by the
 * schema rather than by the calling code.
 */

/** A result row, as the drivers return it. */
export type Row = Record<string, unknown>;

export interface Statement {
  /** D1's `bind` returns a new statement rather than mutating, so this does too. */
  bind(...values: unknown[]): Statement;
  all<T = Row>(): Promise<T[]>;
  first<T = Row>(): Promise<T | null>;
  /** `changes` is the count of rows written — what a compare-and-swap reads. */
  run(): Promise<{ changes: number }>;
}

export interface Database {
  prepare(sql: string): Statement;
  /**
   * Run a multi-statement script with no results — the schema. D1 exposes this
   * and so does `node:sqlite`, so the tests apply the *same* file production
   * does rather than a second copy of the tables.
   */
  exec(sql: string): Promise<void>;
  /**
   * Run statements in order as one atomic transaction. D1's `batch` is
   * transactional ("all statements or none"), and it is the only transaction
   * primitive D1 offers — interactive BEGIN/COMMIT over a single connection is
   * not available across a Worker's stateless invocations. The compare-and-swap
   * push depends on this: the conditional revision UPDATE must gate the row
   * writes, and a rejected CAS must leave zero rows behind.
   */
  batch(statements: Statement[]): Promise<Array<{ changes: number }>>;
}

class D1Statement implements Statement {
  constructor(private readonly stmt: D1PreparedStatement) {}

  /** The wrapped D1 statement, for `batch`. Not part of the seam's surface. */
  get raw(): D1PreparedStatement {
    return this.stmt;
  }
  bind(...values: unknown[]): Statement {
    return new D1Statement(this.stmt.bind(...values));
  }

  async all<T = Row>(): Promise<T[]> {
    const result = await this.stmt.all<T>();
    // D1 answers `null` for a statement with no result set, and `[]` for one
    // that matched nothing. Callers only ever want the list.
    return result.results ?? [];
  }

  async first<T = Row>(): Promise<T | null> {
    return (await this.stmt.first<T>()) ?? null;
  }

  async run(): Promise<{ changes: number }> {
    const result = await this.stmt.run();
    return { changes: result.meta?.changes ?? 0 };
  }
}

/** Adapt a bound `env.DB` to the seam. */
export function d1Database(db: D1Database): Database {
  return {
    prepare: (sql) => new D1Statement(db.prepare(sql)),
    exec: async (sql) => {
      await db.exec(sql);
    },
    batch: async (statements) => {
      const results = await db.batch(
        statements.map((s) => {
          if (!(s instanceof D1Statement)) throw new Error("batch received a foreign statement.");
          return s.raw;
        }),
      );
      return results.map((r) => ({ changes: r.meta?.changes ?? 0 }));
    },
  };
}
