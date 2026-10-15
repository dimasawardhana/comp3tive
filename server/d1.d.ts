/**
 * The subset of Cloudflare's D1 API this Worker uses.
 *
 * **Why these are hand-written when `wrangler types` exists.** `wrangler types`
 * emits the whole `workerd` runtime surface — 16,000 lines — and the only part
 * this project needs is the five D1 methods below. `worker-configuration.d.ts`
 * is generated with `--include-runtime=false`, so it declares the *bindings*
 * (`Env.DB` — the thing that can drift from `wrangler.jsonc`, and the reason to
 * generate it at all), while `D1Database` and its friends are declared here.
 * Running `npx wrangler types` without that flag emits the full runtime and
 * makes this file redundant; it is not run, because committing or regenerating
 * 16k lines to type five methods is the larger cost.
 *
 * The D1 shapes are from `developers.cloudflare.com/d1/worker-api/return-object/`,
 * verified 2026-10-15:
 *
 * - `prepare(sql)` returns a statement; `bind(...)` returns a NEW statement
 *   rather than mutating, which is why `Statement.bind` in `./db.ts` also
 *   returns one.
 * - `run()` and `all()` both answer `{ results, success, meta }`, and `first()`
 *   answers a row or null.
 * - `meta.changes` is the count of changed rows. Nothing in this ticket depends
 *   on it; the compare-and-swap that does arrives with the sync work, and it
 *   reads `changes` rather than trusting a success flag.
 */

interface D1Meta {
  changes?: number;
  last_row_id?: number;
  duration?: number;
}

interface D1Result<T> {
  results?: T[] | null;
  success: boolean;
  meta?: D1Meta;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  all<T = unknown>(): Promise<D1Result<T>>;
  first<T = unknown>(column?: string): Promise<T | null>;
  run<T = unknown>(): Promise<D1Result<T>>;
}

interface D1Database {
  prepare(sql: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(sql: string): Promise<{ count: number; duration: number }>;
}
