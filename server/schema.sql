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
