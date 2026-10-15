/**
 * A `Database` over `node:sqlite`, for tests only.
 *
 * **Nothing in the Worker may import this file.** It pulls in a Node builtin,
 * which `workerd` does not have, and the Worker's entry point is what the
 * bundler follows — so as long as `server/index.ts` never reaches it, it is not
 * in the deployed bundle. It lives under `test-support/` for that reason, and
 * no non-test file imports it.
 *
 * **Why real SQLite and not a fake.** The storage code's correctness lives
 * largely in its schema: a credential id is a primary key so a synced passkey
 * cannot insert a second row, a session token is unique, and the version check
 * on the sync documents is a conditional `UPDATE` whose whole point is the row
 * count it returns. A hand-written mock would accept every one of those and
 * prove nothing. `node:sqlite` is SQLite, which is what D1 runs, so these tests
 * exercise the same statements and the same constraints the platform will.
 *
 * The one thing it does not reproduce is D1's *distributed* behaviour — writes
 * serialising on a primary, and replicas lagging. That is a property of the
 * platform, not of this code, and it is the reason the compare-and-swap is a
 * single statement rather than read-then-write.
 */
import { DatabaseSync, type StatementSync } from "node:sqlite";
import type { Database, Row, Statement } from "../db";

class SqliteStatement implements Statement {
  constructor(
    private readonly stmt: StatementSync,
    private readonly params: unknown[] = [],
  ) {}

  bind(...values: unknown[]): Statement {
    // `node:sqlite` refuses `undefined`; D1 does too ("D1_TYPE_ERROR"). Making
    // the substitution here means a forgotten optional field fails as a null
    // column in a test rather than only in production.
    return new SqliteStatement(this.stmt, values.map((v) => (v === undefined ? null : v)));
  }

  async all<T = Row>(): Promise<T[]> {
    return this.stmt.all(...(this.params as never[])) as T[];
  }

  async first<T = Row>(): Promise<T | null> {
    const row = this.stmt.get(...(this.params as never[]));
    return (row as T | undefined) ?? null;
  }

  async run(): Promise<{ changes: number }> {
    const result = this.stmt.run(...(this.params as never[]));
    return { changes: Number(result.changes) };
  }
}

/**
 * An in-memory SQLite database, shaped like D1's prepared-statement API.
 *
 * Foreign keys are ON, to match D1 rather than SQLite's default. `node:sqlite`
 * leaves them off per connection, so a test that inserted a credential for an
 * account that does not exist would pass here and fail on the platform.
 */
export function sqliteDatabase(): Database {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  return {
    prepare: (sql) => new SqliteStatement(db.prepare(sql)),
    exec: async (sql) => {
      db.exec(sql);
    },
  };
}
