-- comp3tive's server schema.
--
-- Applied out of band, the way D1 works, rather than lazily on a request:
--
--   npx wrangler d1 execute comp3tive-db --remote --file=server/schema.sql
--   npx wrangler d1 execute comp3tive-db --local  --file=server/schema.sql
--
-- and the unit tests apply this same file to an in-memory SQLite, so there is
-- one definition of the tables rather than a schema and a copy of it.
--
-- ## These tables are identity, and they are relational on purpose
--
-- ADR-0007 says "nothing is normalized" about the *documents* — the backup
-- payload, which keeps dangling player ids by design. This file is the other
-- thing: Accounts, credentials and sessions are genuinely relational, have no
-- dangling references, and the constraints below are what stop a synced passkey
-- from becoming two credentials. The two decisions do not conflict because they
-- are about different data.
--
-- ## Why the constraints are load-bearing
--
-- - `credentials.id` is the WebAuthn credential id, so a passkey synced to a
--   second device arrives as a row that already exists. Sign-in updates it and
--   registration of a *new* account inserts one; nothing can produce a second
--   row for one credential.
-- - `federated_identities` is keyed on (issuer, subject), which is the only
--   stable identifier OpenID Connect defines. There is deliberately no unique
--   constraint on `accounts.email`: two Accounts may share an address, and
--   nothing is ever joined on it (ADR-0008).
-- - `sessions.token_hash` is the primary key, so the table holds no usable
--   token. A dump of this database does not grant a session.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS accounts (
  id         TEXT    PRIMARY KEY,
  -- The WebAuthn user handle: 64 random bytes, base64url, PII-free (ADR-0008).
  handle     TEXT    NOT NULL,
  -- A verified address. An attribute, never the account key. Nullable because
  -- a passkey-only Account may never supply one.
  email      TEXT,
  created_at INTEGER NOT NULL
);

-- For discovery and recovery lookups. NOT unique: see the header.
CREATE INDEX IF NOT EXISTS accounts_by_email ON accounts (email) WHERE email IS NOT NULL;

CREATE TABLE IF NOT EXISTS credentials (
  -- The credential id in base64url — the value the authenticator presents.
  id          TEXT    PRIMARY KEY,
  account_id  TEXT    NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
  -- The COSE public key, base64url. A credential; never a password.
  public_key  TEXT    NOT NULL,
  -- Stored and never used to hard-fail: a non-increasing counter is a signal,
  -- not proof, and synced devices produce it legitimately (ADR-0008).
  sign_count  INTEGER NOT NULL DEFAULT 0,
  -- §6.1.3's two flags. Together they say whether this credential survives
  -- losing the device, which is the failure the Account exists to fix.
  backed_up   INTEGER NOT NULL DEFAULT 0,
  device_type TEXT    NOT NULL,
  transports  TEXT    NOT NULL DEFAULT '[]',
  created_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS credentials_by_account ON credentials (account_id);

CREATE TABLE IF NOT EXISTS federated_identities (
  -- OpenID Connect Core §5.7: iss + sub together are the only stable identifier.
  issuer     TEXT    NOT NULL,
  subject    TEXT    NOT NULL,
  account_id TEXT    NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (issuer, subject)
);

CREATE TABLE IF NOT EXISTS sessions (
  -- SHA-256 of the bearer token, hex. The token itself is never stored.
  token_hash TEXT    PRIMARY KEY,
  account_id TEXT    NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS sessions_by_account ON sessions (account_id);

-- WebAuthn challenges, held between the options call and the verify call.
-- Short-lived and single-use: `takeChallenge` deletes as it reads, so a replayed
-- response finds nothing.
CREATE TABLE IF NOT EXISTS challenges (
  id         TEXT    PRIMARY KEY,
  value      TEXT    NOT NULL,
  kind       TEXT    NOT NULL,
  -- Deliberately NOT a foreign key, unlike every other reference in this file:
  -- a registration challenge names an Account that does not exist yet.
  account_id TEXT,
  -- What the verify call needs that the options call decided. For a new
  -- Account that is its generated id and user handle, so the ceremony can run
  -- to completion without a half-created Account row existing while it does.
  payload    TEXT,
  expires_at INTEGER NOT NULL
);

-- The account's data, one versioned backup document per (account, community).
-- ADR-0007: nothing is normalized — the payload keeps its dangling ids by
-- design, and this table holds it as a blob with a version integer. That
-- integer is the compare-and-swap ticket 06 needs: `UPDATE ... SET payload = ?,
-- version = version + 1 WHERE account_id = ? AND community_id = ? AND version
-- = ?` either applies or refuses, and the loser is told rather than silently
-- overwritten. The primary key is the pair, so one Account's two Communities
-- are two rows and never one document.
CREATE TABLE IF NOT EXISTS community_documents (
  account_id   TEXT    NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
  community_id TEXT    NOT NULL,
  version      INTEGER NOT NULL,
  payload      TEXT    NOT NULL,
  updated_at   INTEGER NOT NULL,
  PRIMARY KEY (account_id, community_id)
);

-- The revision counter behind the compare-and-swap, once the document is
-- normalized (relational-backend plan). The push's gate is the FIRST statement
-- inside one atomic `batch`: `UPDATE ... SET revision = revision + 1 WHERE
-- ... AND revision = ?` either applies or refuses, and the row writes that
-- follow share the transaction, so a rejected CAS leaves zero rows behind.
-- Kept beside `community_documents` during the dual-write window: writes go to
-- both, reads come from here, and the documents table is dropped by Task 4's
-- migration after the cutover proves stable.
CREATE TABLE IF NOT EXISTS community_revisions (
  account_id   TEXT    NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
  community_id TEXT    NOT NULL,
  revision     INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL,
  PRIMARY KEY (account_id, community_id)
);

-- ---- The normalized store (relational plan, Task 2; ADR-0007) ----
--
-- One document = one (account, community) slice, decomposed into rows.
-- `community_revisions` above carries the compare-and-swap counter; these
-- tables carry the state. JSON columns hold what nothing queries (settings,
-- results, embedded ids); everything else is a column. Ordering is the
-- `position` columns, because the round-trip law cannot hold without it.
--
-- Players and tournaments get a UNIQUE (account_id, id) on top of their
-- community-scoped PRIMARY KEY: their children (capabilities, teams, matches,
-- games) are scoped by player or tournament id alone, and a foreign key must
-- reference a unique constraint it names column-for-column.

CREATE TABLE IF NOT EXISTS communities (
  account_id  TEXT    NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
  id          TEXT    NOT NULL,
  name        TEXT    NOT NULL,
  created_at  INTEGER NOT NULL,
  exported_at TEXT    NOT NULL,
  PRIMARY KEY (account_id, id)
);

CREATE TABLE IF NOT EXISTS disciplines (
  account_id     TEXT    NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
  id             TEXT    NOT NULL,
  name           TEXT    NOT NULL,
  short_name     TEXT    NOT NULL,
  strength_model TEXT    NOT NULL,
  team           TEXT    NOT NULL,
  built_in       INTEGER NOT NULL CHECK (built_in IN (0, 1)),
  PRIMARY KEY (account_id, id)
);

CREATE TABLE IF NOT EXISTS discipline_roles (
  account_id    TEXT    NOT NULL,
  discipline_id TEXT    NOT NULL,
  id            TEXT    NOT NULL,
  name          TEXT    NOT NULL,
  position      INTEGER NOT NULL,
  PRIMARY KEY (account_id, discipline_id, id)
,
  FOREIGN KEY (account_id, discipline_id) REFERENCES disciplines (account_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS discipline_attributes (
  account_id    TEXT    NOT NULL,
  discipline_id TEXT    NOT NULL,
  id            TEXT    NOT NULL,
  name          TEXT    NOT NULL,
  min_def       INTEGER,
  max_def       INTEGER,
  position      INTEGER NOT NULL,
  PRIMARY KEY (account_id, discipline_id, id)
,
  FOREIGN KEY (account_id, discipline_id) REFERENCES disciplines (account_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS players (
  account_id   TEXT    NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
  community_id TEXT    NOT NULL,
  id           TEXT    NOT NULL,
  name         TEXT    NOT NULL,
  notes        TEXT,
  created_at   INTEGER NOT NULL,
  PRIMARY KEY (account_id, community_id, id),
  UNIQUE (account_id, id),
  FOREIGN KEY (account_id, community_id) REFERENCES communities (account_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS player_capabilities (
  account_id     TEXT NOT NULL,
  player_id      TEXT NOT NULL,
  discipline_id  TEXT NOT NULL,
  preferred_role TEXT,
  PRIMARY KEY (account_id, player_id, discipline_id)
,
  FOREIGN KEY (account_id, player_id, discipline_id) REFERENCES player_capabilities (account_id, player_id, discipline_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS capability_ratings (
  account_id    TEXT    NOT NULL,
  player_id     TEXT    NOT NULL,
  discipline_id TEXT    NOT NULL,
  attribute_id  TEXT    NOT NULL,
  rating        INTEGER NOT NULL,
  PRIMARY KEY (account_id, player_id, discipline_id, attribute_id)
);

CREATE TABLE IF NOT EXISTS capability_roles (
  account_id    TEXT    NOT NULL,
  player_id     TEXT    NOT NULL,
  discipline_id TEXT    NOT NULL,
  role_id       TEXT    NOT NULL,
  position      INTEGER NOT NULL,
  PRIMARY KEY (account_id, player_id, discipline_id, role_id)
);

CREATE TABLE IF NOT EXISTS split_sessions (
  account_id      TEXT    NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
  community_id    TEXT    NOT NULL,
  id              TEXT    NOT NULL,
  discipline_id   TEXT    NOT NULL,
  created_at      INTEGER NOT NULL,
  pool_player_ids TEXT    NOT NULL,
  settings        TEXT    NOT NULL,
  result          TEXT    NOT NULL,
  PRIMARY KEY (account_id, community_id, id),
  FOREIGN KEY (account_id, community_id) REFERENCES communities (account_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS saved_squads (
  account_id      TEXT    NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
  community_id    TEXT    NOT NULL,
  id              TEXT    NOT NULL,
  name            TEXT    NOT NULL,
  discipline_id   TEXT    NOT NULL,
  created_at      INTEGER NOT NULL,
  pool_player_ids TEXT    NOT NULL,
  settings        TEXT    NOT NULL,
  result          TEXT    NOT NULL,
  PRIMARY KEY (account_id, community_id, id),
  FOREIGN KEY (account_id, community_id) REFERENCES communities (account_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tournaments (
  account_id    TEXT    NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
  community_id  TEXT    NOT NULL,
  id            TEXT    NOT NULL,
  discipline_id TEXT    NOT NULL,
  name          TEXT    NOT NULL,
  format        TEXT    NOT NULL,
  series_length INTEGER NOT NULL,
  team_count    INTEGER NOT NULL,
  third_place   INTEGER NOT NULL CHECK (third_place IN (0, 1)),
  status        TEXT    NOT NULL,
  created_at    INTEGER NOT NULL,
  PRIMARY KEY (account_id, community_id, id),
  UNIQUE (account_id, id),
  FOREIGN KEY (account_id, community_id) REFERENCES communities (account_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tournament_teams (
  account_id    TEXT    NOT NULL,
  tournament_id TEXT    NOT NULL,
  id            TEXT    NOT NULL,
  bib_index     INTEGER NOT NULL,
  name          TEXT    NOT NULL,
  strength      INTEGER NOT NULL,
  player_ids    TEXT    NOT NULL,
  position      INTEGER NOT NULL,
  PRIMARY KEY (account_id, tournament_id, id),
  FOREIGN KEY (account_id, tournament_id) REFERENCES tournaments (account_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tournament_matches (
  account_id     TEXT    NOT NULL,
  tournament_id  TEXT    NOT NULL,
  id             TEXT    NOT NULL,
  round          INTEGER NOT NULL,
  position       INTEGER NOT NULL,
  team_a_id      TEXT,
  team_b_id      TEXT,
  winner_team_id TEXT,
  winner_next    TEXT,
  loser_next     TEXT,
  is_third_place INTEGER NOT NULL CHECK (is_third_place IN (0, 1)),
  PRIMARY KEY (account_id, tournament_id, id),
  FOREIGN KEY (account_id, tournament_id) REFERENCES tournaments (account_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS match_games (
  account_id     TEXT    NOT NULL,
  tournament_id  TEXT    NOT NULL,
  match_id       TEXT    NOT NULL,
  idx            INTEGER NOT NULL,
  winner_team_id TEXT    NOT NULL,
  score_a        INTEGER,
  score_b        INTEGER,
  PRIMARY KEY (account_id, tournament_id, match_id, idx),
  FOREIGN KEY (account_id, tournament_id, match_id) REFERENCES tournament_matches (account_id, tournament_id, id) ON DELETE CASCADE
);
