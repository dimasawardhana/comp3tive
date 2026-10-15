-- comp3tive's normalized schema (v2) — the relational backend.
--
-- Applied out of band, the way D1 works, rather than lazily on a request:
--
--   npx wrangler d1 execute comp3tive-db --remote --file=server/schema-v2.sql
--   npx wrangler d1 execute comp3tive-db --local --file=server/schema-v2.sql
--
-- The identity tables are defined once, in `server/schema.sql`, and this file
-- assumes they exist. Applying BOTH files in order is the full setup; applying
-- this one alone is the v1 -> v2 step on a database that already has identity.
-- Unit tests that need the whole surface apply schema.sql then this file.
--
-- ## What this file is
--
-- ADR-0007's original storage was one JSON blob per (account, community) —
-- `community_documents`, deliberately unnormalized. It was superseded in part
-- on 2026-10-15 (plan: `docs/superpowers/plans/2026-10-15-relational-backend.md`):
-- the storage is now normalized to gain server-side querying and enforced
-- integrity. The wire format is still the backup format: a push decomposes the
-- v5 document into these rows inside one transaction, and a pull reassembles
-- rows into the same document (`server/store/decompose.ts` / `reassemble.ts`).
--
-- ## The integrity decision table
--
-- The original "no foreign keys anywhere" rule moved to a per-column decision:
-- a foreign key exists where a dangling row would be a BUG, and is deliberately
-- absent where the domain TOLERATES the gap:
--
--   FK where a dangling row is a bug:
--     - every table -> accounts (the tenant; a row without its tenant is corrupt)
--     - player -> community, session/squad/tournament -> community
--     - capability -> player, rating/role -> capability
--     - tournament match/team -> tournament, game -> match
--   NO FK where the domain deliberately tolerates the gap:
--     - player_capability.discipline_id: a custom capability can outlive its
--       discipline (a user may delete the built-in that defined it); the
--       decomposer records the capability and the reader tolerates the miss.
--     - the solver-output JSON columns (result, player_ids snapshots,
--       winner_next/loser_next): they hold ids of entities that may since have
--       been deleted, and the app displays them through a filter, by design.
--     - split_session.discipline_id / saved_squad.discipline_id /
--       tournament.discipline_id: same rule — history outlives the catalog.
--
-- ## Multi-tenancy
--
-- account_id is part of every primary key. D1 has no row-level security, so
-- every query in `server/store/` must carry it, and it comes from the session
-- token, never from the payload. This is the load-bearing convention of the
-- whole file.

-- ---- Catalog ----

CREATE TABLE IF NOT EXISTS communities (
  account_id TEXT NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
  id         TEXT NOT NULL,
  name       TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  exported_at TEXT NOT NULL DEFAULT "",
  PRIMARY KEY (account_id, id)
);

-- Disciplines are per-account (a user may delete the built-in; a custom one is
-- account data). strength_model and team stay JSON: StrengthModel is
-- {kind:"mean"} today and TeamConstraints is three scalars — normalizing them
-- buys nothing, and they are never queried by field.
CREATE TABLE IF NOT EXISTS disciplines (
  account_id     TEXT NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
  id             TEXT NOT NULL,
  name           TEXT NOT NULL,
  short_name     TEXT NOT NULL,
  strength_model TEXT NOT NULL,
  team           TEXT NOT NULL,
  built_in       INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (account_id, id)
);

CREATE TABLE IF NOT EXISTS discipline_roles (
  account_id    TEXT NOT NULL,
  discipline_id TEXT NOT NULL,
  id            TEXT NOT NULL,
  name          TEXT NOT NULL,
  position      INTEGER NOT NULL,
  PRIMARY KEY (account_id, discipline_id, id),
  FOREIGN KEY (account_id, discipline_id) REFERENCES disciplines (account_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS discipline_attributes (
  account_id    TEXT NOT NULL,
  discipline_id TEXT NOT NULL,
  id            TEXT NOT NULL,
  name          TEXT NOT NULL,
  min_def       INTEGER,
  max_def       INTEGER,
  position      INTEGER NOT NULL,
  PRIMARY KEY (account_id, discipline_id, id),
  FOREIGN KEY (account_id, discipline_id) REFERENCES disciplines (account_id, id) ON DELETE CASCADE
);

-- ---- Roster (the tables the queries join) ----

CREATE TABLE IF NOT EXISTS players (
  account_id   TEXT NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
  community_id TEXT NOT NULL,
  id           TEXT NOT NULL,
  name         TEXT NOT NULL,
  notes        TEXT,
  created_at   INTEGER NOT NULL,
  PRIMARY KEY (account_id, id),
  FOREIGN KEY (account_id, community_id) REFERENCES communities (account_id, id) ON DELETE CASCADE
);

-- No FK on discipline_id: see the decision table. preferred_role is the raw
-- value, nullable; it is validated against the roles at read time, not write
-- time, because the role may be deleted before the capability is edited.
CREATE TABLE IF NOT EXISTS player_capabilities (
  account_id     TEXT NOT NULL,
  player_id      TEXT NOT NULL,
  discipline_id  TEXT NOT NULL,
  preferred_role TEXT,
  PRIMARY KEY (account_id, player_id, discipline_id),
  FOREIGN KEY (account_id, player_id) REFERENCES players (account_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS capability_ratings (
  account_id    TEXT NOT NULL,
  player_id     TEXT NOT NULL,
  discipline_id TEXT NOT NULL,
  attribute_id  TEXT NOT NULL,
  rating        INTEGER NOT NULL CHECK (rating >= 0),
  PRIMARY KEY (account_id, player_id, discipline_id, attribute_id),
  FOREIGN KEY (account_id, player_id, discipline_id) REFERENCES player_capabilities (account_id, player_id, discipline_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS capability_roles (
  account_id    TEXT NOT NULL,
  player_id     TEXT NOT NULL,
  discipline_id TEXT NOT NULL,
  role_id       TEXT NOT NULL,
  position      INTEGER NOT NULL,
  PRIMARY KEY (account_id, player_id, discipline_id, position)
);


-- ---- Splits, squads, tournaments ----
--
-- `result` stays JSON on purpose: it is solver OUTPUT — teams, gap, flags,
-- unassigned, solver telemetry — displayed and never queried by field, and its
-- ids deliberately dangle after a player is deleted. Normalizing it would trade
-- one honest blob for five tables that exist only to be reassembled.

CREATE TABLE IF NOT EXISTS split_sessions (
  account_id    TEXT NOT NULL,
  community_id  TEXT NOT NULL,
  id            TEXT NOT NULL,
  discipline_id TEXT NOT NULL,
  created_at    INTEGER NOT NULL,
  pool_player_ids TEXT NOT NULL,
  settings      TEXT NOT NULL,
  result        TEXT NOT NULL,
  PRIMARY KEY (account_id, id),
  FOREIGN KEY (account_id, community_id) REFERENCES communities (account_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS saved_squads (
  account_id    TEXT NOT NULL,
  community_id  TEXT NOT NULL,
  id            TEXT NOT NULL,
  name          TEXT NOT NULL,
  discipline_id TEXT NOT NULL,
  created_at    INTEGER NOT NULL,
  pool_player_ids TEXT NOT NULL,
  settings      TEXT NOT NULL,
  result        TEXT NOT NULL,
  PRIMARY KEY (account_id, id),
  FOREIGN KEY (account_id, community_id) REFERENCES communities (account_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tournaments (
  account_id     TEXT NOT NULL,
  community_id   TEXT NOT NULL,
  id             TEXT NOT NULL,
  discipline_id  TEXT NOT NULL,
  name           TEXT NOT NULL,
  format         TEXT NOT NULL CHECK (format IN ('series', 'single-elim', 'swiss', 'round-robin')),
  series_length  INTEGER NOT NULL CHECK (series_length IN (1, 3, 5)),
  team_count     INTEGER NOT NULL,
  third_place    INTEGER NOT NULL DEFAULT 0,
  status         TEXT NOT NULL CHECK (status IN ('draft', 'active', 'complete')),
  created_at     INTEGER NOT NULL,
  PRIMARY KEY (account_id, id),
  FOREIGN KEY (account_id, community_id) REFERENCES communities (account_id, id) ON DELETE CASCADE
);

-- player_ids is a snapshot of player ids AT SUBMISSION — a historical record.
-- A foreign key here would make deleting a player corrupt a tournament's
-- past, so it is JSON and deliberately unenforced.
CREATE TABLE IF NOT EXISTS tournament_teams (
  account_id    TEXT NOT NULL,
  tournament_id TEXT NOT NULL,
  id            TEXT NOT NULL,
  bib_index     INTEGER NOT NULL,
  name          TEXT NOT NULL,
  strength      REAL NOT NULL,
  player_ids    TEXT NOT NULL,
  position      INTEGER NOT NULL,
  PRIMARY KEY (account_id, tournament_id, id),
  FOREIGN KEY (account_id, tournament_id) REFERENCES tournaments (account_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tournament_matches (
  account_id     TEXT NOT NULL,
  tournament_id  TEXT NOT NULL,
  id             TEXT NOT NULL,
  round          INTEGER NOT NULL,
  position       INTEGER NOT NULL,
  team_a_id      TEXT,
  team_b_id      TEXT,
  winner_team_id TEXT,
  winner_next    TEXT,
  loser_next     TEXT,
  is_third_place INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (account_id, tournament_id, id),
  FOREIGN KEY (account_id, tournament_id) REFERENCES tournaments (account_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS match_games (
  account_id     TEXT NOT NULL,
  tournament_id  TEXT NOT NULL,
  match_id       TEXT NOT NULL,
  idx            INTEGER NOT NULL,
  winner_team_id TEXT NOT NULL,
  score_a        INTEGER,
  score_b        INTEGER,
  PRIMARY KEY (account_id, tournament_id, match_id, idx),
  FOREIGN KEY (account_id, tournament_id, match_id) REFERENCES tournament_matches (account_id, tournament_id, id) ON DELETE CASCADE
);

-- ---- The CAS ticket survives ----
--
-- One revision counter per (account, community). The push's compare-and-swap
-- becomes: revision UPDATE first, then the row writes, all inside one
-- transaction. D1 (SQLite) serializes writers, so the transaction is atomic
-- and the conditional UPDATE is still the gate.
CREATE TABLE IF NOT EXISTS community_revisions (
  account_id   TEXT NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
  community_id TEXT NOT NULL,
  revision     INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL,
  PRIMARY KEY (account_id, community_id)
);
