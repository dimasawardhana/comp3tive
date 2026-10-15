# Plan: Relational Backend — Document In, Normalized Out

Date: 2026-10-15. Status: proposed, not started.
Decisions driving this plan (user, 2026-10-15): **full rebuild to a normalized schema** (both query capability and integrity), **Cloudflare D1**, **document-in / normalized-out** sync.

## 1. What changes and what does not

### Changes
- `community_documents` (one JSON blob per account+community) is **replaced** by ~14 normalized D1 tables.
- The server gains **query capability**: cross-community rosters, leaderboards per attribute, session/tournament history queries, integrity reporting — none possible today.
- Referential integrity is **enforced by FKs** where the domain means it, and deliberately *not* where the app tolerates dangling ids (ADR-0007's filter rule survives, but now as an explicit per-column decision instead of "no FKs anywhere").
- Sync storage: a push **decomposes** the v5 backup into rows inside one transaction; a pull **reassembles** rows into the same v5 backup. The wire format does not change.

### Does not change (invariants carried from ADR-0007/0008 and the Phase E plan)
- **The wire format is the backup format** (`version: 5`, `BackupData`). Clients, e2e suite and the existing adopt/push/pull endpoints keep their contracts.
- **The storage seam in the client does not change shape.** `list*()` take no arguments; Community scoping stays a React-layer filter; the read path is IndexedDB; no screen awaits a fetch to render.
- **Authority is the server's; the CAS push stays.** The per-(account, community) revision integer survives — it moves from a column on the document row to a counter on a `community_revisions` row.
- **The Account is identified by the token**, never the payload. No FK on `email` (ADR-0008).
- **Guest path untouched**: the e2e suite stays green unedited.

## 2. Normalized schema (D1 / SQLite)

Migration strategy: `server/schema-v2.sql`, applied out of band like the current one; `community_documents` is kept **read-only during migration** and dropped only after a verified cutover (Task 4).

### Identity — unchanged
`accounts`, `credentials`, `federated_identities`, `sessions`, `challenges` stay exactly as in `server/schema.sql`. New tables all carry `account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE` — this is the tenant key; every query in the API is scoped by it and it comes from the token, never the payload.

### Catalog
```sql
-- A community is now a real row, so "delete community" is a cascade,
-- and a cross-account query can name communities without parsing blobs.
CREATE TABLE communities (
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  id         TEXT NOT NULL,
  name       TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (account_id, id)
);

CREATE TABLE disciplines (
  account_id   TEXT NOT NULL REFERENCES accounts(account_id?) -- see note
  -- account_id + id PK; name, short_name, built_in (0/1);
  -- strength_model and team JSON columns (tiny, whole-value, never queried
  -- by field: StrengthModel is {kind:"mean"} today and TeamConstraints is
  -- three scalars — normalizing these buys nothing yet).
);
```
Note: `disciplines` keeps `builtIn` seeds per-account (a user may delete the built-in — `indexed-db.test.ts` pins this), so the table is per-account, seeded on first adopt, and deleting a built-in is an ordinary row delete. `roles` and `attributes` ARE normalized because leaderboards/ratings join on them:

```sql
CREATE TABLE discipline_roles (
  account_id TEXT NOT NULL, discipline_id TEXT NOT NULL,
  id TEXT NOT NULL, name TEXT NOT NULL, position INTEGER NOT NULL,
  PRIMARY KEY (account_id, discipline_id, id),
  FOREIGN KEY (account_id, discipline_id) REFERENCES disciplines(account_id, id) ON DELETE CASCADE
);
CREATE TABLE discipline_attributes (
  account_id TEXT NOT NULL, discipline_id TEXT NOT NULL,
  id TEXT NOT NULL, name TEXT NOT NULL, min_def INTEGER, max_def INTEGER, position INTEGER NOT NULL,
  PRIMARY KEY (account_id, discipline_id, id),
  FOREIGN KEY (account_id, discipline_id) REFERENCES disciplines(account_id, id) ON DELETE CASCADE
);
```

### Roster — fully normalized, this is where queries pay
```sql
CREATE TABLE players (
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  community_id TEXT NOT NULL,
  id TEXT NOT NULL, name TEXT NOT NULL, notes TEXT,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (account_id, id),
  FOREIGN KEY (account_id, community_id) REFERENCES communities(account_id, id) ON DELETE CASCADE
);

CREATE TABLE player_capabilities (
  account_id TEXT NOT NULL,
  player_id TEXT NOT NULL,
  discipline_id TEXT NOT NULL,
  preferred_role TEXT,                 -- nullable; validated against roles
  PRIMARY KEY (account_id, player_id, discipline_id),
  FOREIGN KEY (account_id, player_id) REFERENCES players(account_id, id) ON DELETE CASCADE
  -- discipline_id: FK only when the discipline row exists. Custom
  -- capabilities can outlive their discipline (ADR-0007's dangling rule),
  -- so this is a *conditional* integrity decision, encoded as:
  -- no FK, plus a server-side check on decompose that warns, never rejects.
);

CREATE TABLE capability_ratings (
  account_id TEXT NOT NULL, player_id TEXT NOT NULL, discipline_id TEXT NOT NULL,
  attribute_id TEXT NOT NULL, rating INTEGER NOT NULL CHECK (rating >= 0),
  PRIMARY KEY (account_id, player_id, discipline_id, attribute_id)
);

CREATE TABLE capability_roles (
  account_id TEXT NOT NULL, player_id TEXT NOT NULL, discipline_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  PRIMARY KEY (account_id, player_id, discipline_id, role_id)
);
```
Query payoff example (impossible today): leaderboard by attribute across all communities —
```sql
SELECT p.name, r.rating FROM capability_ratings r
JOIN players p ON p.account_id = r.account_id AND p.id = r.player_id
WHERE r.account_id = ? AND r.discipline_id = 'mlbb' AND r.attribute_id = 'mechanics'
ORDER BY r.rating DESC;
```

### Splits, squads, tournaments — headers relational, solver output JSON
```sql
CREATE TABLE split_sessions (
  account_id TEXT NOT NULL, community_id TEXT NOT NULL REFERENCES communities(account_id, id) ON DELETE CASCADE,
  id TEXT NOT NULL, discipline_id TEXT NOT NULL, created_at INTEGER NOT NULL,
  settings TEXT NOT NULL,   -- {teamCount} today; JSON column, one key
  result TEXT NOT NULL,     -- SplitResult verbatim. DECISION: JSON.
  PRIMARY KEY (account_id, id)
);
```
Why `result` stays JSON: `SplitResult` is solver output — teams, slots, gap, flags, unassigned, solver telemetry. It is **displayed**, never queried by field, and its ids are deliberately dangling (deleted players appear in history). Normalizing it would trade one honest blob for five tables that exist only to be reassembled, and would force the dangling-id rule into FK exceptions per column. The same applies to `saved_squads.result` and `tournament_teams.players` (a snapshot of player ids **at submission** — an FK would make deleting a player corrupt a historical record).

```sql
CREATE TABLE saved_squads ( -- mirror of split_sessions minus status
  account_id, community_id FK, id, name, discipline_id, created_at, settings, result,
  PRIMARY KEY (account_id, id)
);

CREATE TABLE tournaments (
  account_id TEXT NOT NULL, community_id TEXT NOT NULL REFERENCES communities(account_id, id) ON DELETE CASCADE,
  id TEXT NOT NULL, discipline_id TEXT NOT NULL,
  name TEXT NOT NULL, format TEXT NOT NULL CHECK (format IN ('series','single-elim','swiss','round-robin')),
  series_length INTEGER NOT NULL CHECK (series_length IN (1,3,5)),
  team_count INTEGER NOT NULL, third_place INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','active','complete')),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (account_id, id)
);

CREATE TABLE tournament_teams (
  account_id TEXT NOT NULL, tournament_id TEXT NOT NULL,
  id TEXT NOT NULL, bib_index INTEGER NOT NULL, name TEXT NOT NULL,
  strength REAL NOT NULL, player_ids TEXT NOT NULL, -- snapshot JSON, see above
  PRIMARY KEY (account_id, tournament_id, id),
  FOREIGN KEY (account_id, tournament_id) REFERENCES tournaments(account_id, id) ON DELETE CASCADE
);

CREATE TABLE tournament_matches (
  account_id TEXT NOT NULL, tournament_id TEXT NOT NULL,
  id TEXT NOT NULL, round INTEGER NOT NULL, position INTEGER NOT NULL,
  team_a_id TEXT, team_b_id TEXT,               -- tournament-team ids, FK-able:
  winner_team_id TEXT,
  winner_next TEXT, loser_next TEXT,            -- {matchId, slot} — JSON, structural not queryable
  is_third_place INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (account_id, tournament_id, id),
  FOREIGN KEY (account_id, tournament_id) REFERENCES tournaments(account_id, id) ON DELETE CASCADE
);

CREATE TABLE match_games (
  account_id TEXT NOT NULL, tournament_id TEXT NOT NULL, match_id TEXT NOT NULL,
  idx INTEGER NOT NULL, winner_team_id TEXT NOT NULL,
  PRIMARY KEY (account_id, tournament_id, match_id, idx),
  FOREIGN KEY (account_id, tournament_id, match_id)
    REFERENCES tournament_matches(account_id, tournament_id, id) ON DELETE CASCADE
);
```
`tournament_matches.team_a_id/team_b_id/winner_team_id` get real FKs to `tournament_teams` where NOT NULL — a match slot pointing at a team that never existed is a bug, unlike a match pointing at a deleted player's session team (which cannot happen; tournament teams are snapshots).

### Versioning — the CAS survives
```sql
CREATE TABLE community_revisions (
  account_id TEXT NOT NULL,
  community_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (account_id, community_id)
);
```
`/api/documents/push` keeps its request/response shape exactly: `expectedVersion` maps to `revision`; the CAS becomes `UPDATE community_revisions SET revision = revision + 1 WHERE ... AND revision = ?` executed **first inside the decompose transaction**, so the atomicity guarantee moves from one UPDATE to one transaction — D1 transactions are atomic, and the statement is still the gate. `community_documents` is dropped in Task 4 after both paths verify.

## 3. New server modules

| Module | Role |
|---|---|
| `server/store/decompose.ts` | v5 `BackupData` → row writes, one transaction. Pure except for the db handle; unit-testable against `sqliteDatabase()`. Rejects malformed documents with `ApiError(400)` — never partial writes. |
| `server/store/reassemble.ts` | Rows → v5 `BackupData`. Missing optional rows (e.g. a capability whose ratings were all cleared) serialize as empty arrays, matching `serializeBackup`'s output for the same state. |
| `server/store/queries.ts` | The new capability: leaderboards, cross-community player search, per-discipline session history, orphan reports. Not exposed on the wire in this plan (Task 5 lists the endpoints as a follow-up). |

Round-trip law (the test that pins everything): for any valid `BackupData` `b`, `reassemble(decompose(b)) === b` with deterministic ordering (every `position` column; JSON object key order preserved by construction from the input). `parseBackup(serialize(reassemble(decompose(b))))` also equals `b`. This is tested on the sample rosters and on property-generated documents.

## 4. Tasks

1. **Schema v2 + store module skeleton.** `server/schema-v2.sql`; `server/store/decompose.ts`, `reassemble.ts` with the round-trip law tested. No wire change. Verification: vitest.
2. **Decompose/reassemble complete over all entity kinds** — communities, disciplines (+roles/attributes), players (+capabilities), sessions, saved squads, tournaments (+teams, matches, games). Property test: random documents round-trip. Verification: vitest.
3. **Rewire adopt/pull/push through the store.** Push = CAS on `community_revisions` + decompose in one transaction; pull = reassemble; adopt = insert revision row at 1 + decompose. `server/push.test.ts` rewritten against the new storage; the two-client conflict test must stay red-to-green. **Keep `community_documents` in dual-write during this task** (write both, read new), so a failed deploy can be rolled back without data loss. Verification: full chain, e2e green unedited.
4. **Migration + cutover.** `scripts/migrate-documents.ts` (a one-shot Worker route or wrangler script — D1 has no server-side procedure): read every `community_documents` row, decompose, write `community_revisions` at the row's version, verify round-trip per row, then drop `community_documents` from the schema. Verification: migrated local DB passes the full suite; live migration is a deploy-time step with a backup export first.
5. **Query endpoints (follow-up, not in this plan's build).** `GET /api/leaderboards/:discipline/:attribute`, `GET /api/players?q=`, `GET /api/history`. Wire them after the storage cutover is stable; the client UI that consumes them is its own design task (it touches the "no screen awaits a fetch" invariant and needs its own ADR note).

## 5. Risks and tradeoffs, stated

- **Transaction-wrapped CAS vs single-statement CAS**: D1 (SQLite) serializes writers, so `BEGIN; UPDATE revisions ... WHERE revision = ?;` + row writes is safe. The gate must be the FIRST statement; verified by the rewritten two-client test.
- **Row explosion**: a 200-player community with full capabilities is ~1 row per player + ~4 rating rows each ≈ 1000 rows per push. D1 handles this; the decompose runs in one batched transaction. Push payload size is unchanged (wire format fixed).
- **`account_id` in every PK** is deliberate multi-tenancy: D1 has no row-level security, and every query in `store/` must carry it from the token. A lint rule or grep gate (`account_id` present in every WHERE in `server/store/queries.ts`) is part of Task 5.
- **Nothing is lost from ADR-0007's reasoning** — the dangling-id rule moves from "no FKs anywhere" to a per-column decision table, recorded in the schema comments: FK where a dangling row is a bug, JSON/no-FK where the domain deliberately tolerates it (capability→discipline, `result` blobs, `player_ids` snapshots).
- **Rollback**: Task 3's dual-write is the rollback window. After Task 4's drop, rollback means restoring from the pre-migration export.

## 6. Verification commands (unchanged baseline, raised counts)

```
npx tsc -b && npx vitest run        # 905 + new store tests
npm run build && npm run e2e        # 124/124, guest specs unedited
```
Mutation checks: the round-trip property test must go red on any dropped column; the conflict test must go red on any CAS reorder.
