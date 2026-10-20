/**
 * RB-4 migration: move every `community_documents` blob into the normalized
 * tables, then drop the blob table. One shot, run against a D1 sqlite file:
 *
 *   npx tsx scripts/migrate-documents.ts <db.sqlite> [--dry-run]
 *
 * Local dev: the file lives under
 * `.wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite`. For the remote
 * database, take an export first (`wrangler d1 export`), migrate the exported
 * file, verify, and re-import — the migration never talks to the network; it
 * is pure SQL against the file you name.
 *
 * Per row: read blob, parseBackup, skip when a revision row already exists
 * (rows are authoritative since RB-3; a blob without its revision lost a CAS
 * during the dual-write window), decompose, write `community_revisions` at
 * the blob's own version so the CAS numbering survives the cutover,
 * reassemble, and compare. A row that fails verification aborts the run with
 * the blob table untouched; earlier rows stay migrated and a re-run resumes
 * (migrated rows are skipped by the revision check). `community_documents`
 * is dropped only after every row verified; from there, rollback means
 * restoring the pre-migration export.
 *
 * --dry-run runs the whole migration against a throwaway copy of the file
 * (the verification needs the real writes) and deletes the copy after.
 */
import { copyFile, rm } from "node:fs/promises";
import { sqliteDatabase } from "../server/test-support/sqlite";
import { parseBackup } from "../src/data/transfer";
import { collectDecompose } from "../server/store/decompose";
import { reassemble } from "../server/store/reassemble";
import type { BackupData } from "../src/data/transfer";

interface BlobRow {
  account_id: string;
  community_id: string;
  version: number;
  payload: string;
}

/** Structural canonicalization: object key order is not part of the law. */
function canon(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canon);
  if (v && typeof v === "object") {
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, vv]) => [k, canon(vv)]),
    );
  }
  return v;
}

async function main(): Promise<void> {
  const [, , fileArg, ...rest] = process.argv;
  const dryRun = rest.includes("--dry-run");
  if (!fileArg) {
    console.error("usage: npx tsx scripts/migrate-documents.ts <db.sqlite> [--dry-run]");
    process.exit(2);
  }

  // A dry run must exercise the real writes — the verification reassembles
  // what the rows hold, so anything less proves nothing. It runs the whole
  // migration against a throwaway copy of the file and deletes it after.
  const target = dryRun ? `${fileArg}.migrate-dry-run` : fileArg;
  if (dryRun) {
    await copyFile(fileArg, target);
    console.log(`dry run: migrating a copy at ${target}`);
  }

  let blobs: BlobRow[] = [];
  try {
    blobs = (await db
      .prepare("SELECT account_id, community_id, version, payload FROM community_documents")
      .all()) as unknown as BlobRow[];
  } catch {
    console.log(`community_documents does not exist: already migrated (or a fresh schema). Nothing to do.`);
    if (dryRun) await rm(target);
    return;
  }
  console.log(`community_documents rows: ${blobs.length}`);

  // A blob referencing a missing account would fail the FKs on the way in;
  // say it now rather than as an opaque SQLite error.
  const missing = (await db
    .prepare(
      "SELECT COUNT(*) AS n FROM community_documents d LEFT JOIN accounts a ON a.id = d.account_id WHERE a.id IS NULL",
    )
    .first()) as { n: number };
  if (missing.n > 0) {
    console.error(`ABORT: ${missing.n} blob row(s) reference a missing account.`);
    process.exit(1);
  }

  let migrated = 0;
  let skipped = 0;
  for (const row of blobs) {
    const existing = (await db
      .prepare("SELECT revision FROM community_revisions WHERE account_id = ? AND community_id = ?")
      .bind(row.account_id, row.community_id)
      .first()) as { revision: number } | null;
    if (existing) {
      skipped += 1;
      console.log(
        `skip ${row.account_id}/${row.community_id}: revision ${existing.revision} already present (blob version ${row.version})`,
      );
      continue;
    }
    const doc = parseBackup(row.payload) as BackupData;
    // The decomposed rows and the revision row land in ONE batch: per-row
    // atomicity, the same shape the push route uses. A failure mid-run
    // leaves the rows already migrated committed and the blob table in
    // place — the script is idempotent, so re-running continues where it
    // stopped (a migrated row is skipped by the revision check above).
    await db.batch([
      ...collectDecompose(db, row.account_id, row.community_id, doc),
      db
        .prepare(
          "INSERT INTO community_revisions (account_id, community_id, revision, updated_at) VALUES (?, ?, ?, (SELECT updated_at FROM community_documents WHERE account_id = ? AND community_id = ?))",
        )
        .bind(row.account_id, row.community_id, row.version, row.account_id, row.community_id),
    ]);
    // Verify: what came back out of the rows must equal what went in.
    const back = await reassemble(db, row.account_id, row.community_id);
    if (JSON.stringify(canon(back)) !== JSON.stringify(canon(doc))) {
      console.error(
        `ABORT at ${row.account_id}/${row.community_id}: the reassembled document differs from the blob. The blob table is untouched; every earlier row stays migrated and a re-run resumes here.`,
      );
      process.exit(1);
    }
    migrated += 1;
    console.log(`migrated ${row.account_id}/${row.community_id} at version ${row.version}`);
  }

  if (migrated + skipped !== blobs.length) {
    console.error("ABORT: accounting mismatch, rows processed != rows found. The blob table is untouched.");
    process.exit(1);
  }

  if (dryRun) {
    await rm(target);
    console.log(`dry run ok: ${migrated} verified, ${skipped} skipped. Re-run without --dry-run to migrate ${fileArg} itself.`);
    return;
  }

  // The drop: only after every row migrated or skipped. From here, rollback
  // means restoring the pre-migration export.
  await db.exec("DROP TABLE community_documents");
  console.log(`done: ${migrated} migrated, ${skipped} skipped, community_documents dropped.`);
}

void main();
