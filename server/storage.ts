/**
 * Every query the server runs, against the seam in `./db`.
 *
 * Accounts, credentials, federated identities, sessions and challenges. There is
 * deliberately no document/community storage here yet: Phase E ticket 04 proves
 * identity end to end and moves no data, and the versioned document store
 * arrives with the sync work rather than sitting here unused.
 *
 * The types come from `../src/domain/types` rather than being restated, so the
 * client and the server cannot drift on what an `Account` is.
 */
import type { Account, Credential, Id } from "../src/domain/types";
import type { Database, Statement } from "./db";

interface AccountRow {
  id: string;
  handle: string;
  email: string | null;
  created_at: number;
}

interface CredentialRow {
  id: string;
  account_id: string;
  public_key: string;
  sign_count: number;
  backed_up: number;
  device_type: string;
  transports: string;
  created_at: number;
}

const toAccount = (row: AccountRow): Account => ({
  id: row.id,
  handle: row.handle,
  email: row.email,
  createdAt: row.created_at,
});

function toCredential(row: CredentialRow): Credential {
  return {
    id: row.id,
    accountId: row.account_id,
    publicKey: row.public_key,
    signCount: row.sign_count,
    // SQLite has no boolean; 0/1 comes back as a number.
    backedUp: row.backed_up === 1,
    deviceType: row.device_type,
    transports: JSON.parse(row.transports) as string[],
    createdAt: row.created_at,
  };
}

// ---- Accounts ----

export async function insertAccount(db: Database, account: Account): Promise<void> {
  await db
    .prepare("INSERT INTO accounts (id, handle, email, created_at) VALUES (?, ?, ?, ?)")
    .bind(account.id, account.handle, account.email, account.createdAt)
    .run();
}

export async function getAccount(db: Database, id: Id): Promise<Account | null> {
  const row = await db.prepare("SELECT * FROM accounts WHERE id = ?").bind(id).first<AccountRow>();
  return row ? toAccount(row) : null;
}

/**
 * Accounts with this address, newest first.
 *
 * **A list, not a lookup.** Two Accounts may share an address — the schema has
 * no unique constraint on it and must not grow one — so a caller that treats the
 * first result as "the" Account is making the account-takeover inference
 * ADR-0008 rejects. This returns everything that matched so the caller has to
 * decide deliberately, and the only current caller uses it for recovery.
 */
export async function findAccountsByEmail(db: Database, email: string): Promise<Account[]> {
  const rows = await db
    .prepare("SELECT * FROM accounts WHERE email = ? ORDER BY created_at DESC")
    .bind(email)
    .all<AccountRow>();
  return rows.map(toAccount);
}

export async function setAccountEmail(db: Database, id: Id, email: string): Promise<void> {
  await db.prepare("UPDATE accounts SET email = ? WHERE id = ?").bind(email, id).run();
}

// ---- Credentials ----

/**
 * Store a passkey.
 *
 * An upsert keyed on the credential id, which is what makes a **synced passkey
 * one row and not two**: the same credential arrives from a second device with
 * the same id and public key, so it updates rather than inserting. Registration
 * of a genuinely new passkey is the only path that creates a row.
 */
export async function upsertCredential(db: Database, credential: Credential): Promise<void> {
  await db
    .prepare(
      `INSERT INTO credentials
         (id, account_id, public_key, sign_count, backed_up, device_type, transports, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET
         public_key  = excluded.public_key,
         sign_count  = excluded.sign_count,
         backed_up   = excluded.backed_up,
         device_type = excluded.device_type,
         transports  = excluded.transports`,
    )
    .bind(
      credential.id,
      credential.accountId,
      credential.publicKey,
      credential.signCount,
      credential.backedUp ? 1 : 0,
      credential.deviceType,
      JSON.stringify(credential.transports),
      credential.createdAt,
    )
    .run();
}

export async function getCredential(db: Database, id: string): Promise<Credential | null> {
  const row = await db.prepare("SELECT * FROM credentials WHERE id = ?").bind(id).first<CredentialRow>();
  return row ? toCredential(row) : null;
}

export async function listCredentials(db: Database, accountId: Id): Promise<Credential[]> {
  const rows = await db
    .prepare("SELECT * FROM credentials WHERE account_id = ? ORDER BY created_at ASC")
    .bind(accountId)
    .all<CredentialRow>();
  return rows.map(toCredential);
}

/** How many passkeys this Account has registered. The sign-in count tests read it. */
export async function countCredentials(db: Database, accountId: Id): Promise<number> {
  const row = await db
    .prepare("SELECT COUNT(*) AS n FROM credentials WHERE account_id = ?")
    .bind(accountId)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

/**
 * Record a signature counter.
 *
 * `MAX(sign_count, ?)` rather than an assignment: a synced or platform
 * authenticator can legitimately report a lower counter on a second device, and
 * overwriting would let a genuine regression walk the stored value backwards so
 * that a later clone looked normal. Taking the high-water mark keeps the signal
 * meaningful — while never being used to refuse a sign-in, which is the whole of
 * ADR-0008's rule on `signCount`.
 */
export async function recordSignCount(db: Database, credentialId: string, counter: number): Promise<void> {
  await db
    .prepare("UPDATE credentials SET sign_count = MAX(sign_count, ?) WHERE id = ?")
    .bind(counter, credentialId)
    .run();
}

// ---- Federated identities ----

/**
 * Attach a Google identity to an Account.
 *
 * `INSERT OR IGNORE` because (issuer, subject) is the primary key: the same
 * Google account signing in twice must not fail, and it must not move to a
 * different Account. Attaching is only ever called for an Account the caller has
 * already established.
 */
export async function linkFederatedIdentity(
  db: Database,
  issuer: string,
  subject: string,
  accountId: Id,
  createdAt: number,
): Promise<void> {
  await db
    .prepare(
      "INSERT OR IGNORE INTO federated_identities (issuer, subject, account_id, created_at) VALUES (?, ?, ?, ?)",
    )
    .bind(issuer, subject, accountId, createdAt)
    .run();
}

/**
 * The Account a (issuer, subject) pair belongs to, if any.
 *
 * This is the only identity lookup that may decide "same person": `iss` + `sub`
 * is what OIDC Core §5.7 defines as stable, and an address is not.
 */
export async function findAccountByFederatedIdentity(
  db: Database,
  issuer: string,
  subject: string,
): Promise<Account | null> {
  const row = await db
    .prepare(
      `SELECT a.* FROM accounts a
         JOIN federated_identities f ON f.account_id = a.id
        WHERE f.issuer = ? AND f.subject = ?`,
    )
    .bind(issuer, subject)
    .first<AccountRow>();
  return row ? toAccount(row) : null;
}

// ---- Sessions ----

export async function insertSession(
  db: Database,
  tokenHash: string,
  accountId: Id,
  createdAt: number,
  expiresAt: number,
): Promise<void> {
  await db
    .prepare("INSERT INTO sessions (token_hash, account_id, created_at, expires_at) VALUES (?, ?, ?, ?)")
    .bind(tokenHash, accountId, createdAt, expiresAt)
    .run();
}

/**
 * The Account for a live session token digest, or null.
 *
 * An expired row is deleted as it is refused, so a token cannot be extended by
 * trying it repeatedly and the table does not accumulate dead sessions.
 */
export async function findLiveSession(
  db: Database,
  tokenHash: string,
  now: number,
): Promise<{ accountId: Id; expiresAt: number } | null> {
  const row = await db
    .prepare("SELECT account_id, expires_at FROM sessions WHERE token_hash = ?")
    .bind(tokenHash)
    .first<{ account_id: string; expires_at: number }>();
  if (!row) return null;
  if (row.expires_at <= now) {
    await deleteSession(db, tokenHash);
    return null;
  }
  return { accountId: row.account_id, expiresAt: row.expires_at };
}

export async function deleteSession(db: Database, tokenHash: string): Promise<void> {
  await db.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(tokenHash).run();
}

/** Every session for an Account. Used when a credential is removed. */
export async function deleteSessionsForAccount(db: Database, accountId: Id): Promise<void> {
  await db.prepare("DELETE FROM sessions WHERE account_id = ?").bind(accountId).run();
}

// ---- WebAuthn challenges ----

export async function insertChallenge(
  db: Database,
  id: string,
  value: string,
  kind: string,
  accountId: Id | null,
  payload: string | null,
  expiresAt: number,
): Promise<void> {
  await db
    .prepare("INSERT INTO challenges (id, value, kind, account_id, payload, expires_at) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(id, value, kind, accountId, payload, expiresAt)
    .run();
}

/**
 * Read a challenge and consume it, in that order.
 *
 * **Single-use is the point.** A WebAuthn response is bound to the challenge it
 * answered, so a challenge that could be read twice would let one captured
 * response be replayed until it expired. Deleting before returning means a
 * replayed verify call finds nothing rather than finding the same challenge.
 *
 * An expired challenge is deleted and answered with null, the same way an
 * expired session is.
 */
export async function takeChallenge(
  db: Database,
  id: string,
  kind: string,
  now: number,
): Promise<{ value: string; accountId: Id | null; payload: string | null } | null> {
  const row = await db
    .prepare("SELECT value, kind, account_id, payload, expires_at FROM challenges WHERE id = ?")
    .bind(id)
    .first<{
      value: string;
      kind: string;
      account_id: string | null;
      payload: string | null;
      expires_at: number;
    }>();
  if (!row) return null;
  await db.prepare("DELETE FROM challenges WHERE id = ?").bind(id).run();
  // A challenge issued for a different ceremony must not answer this one.
  if (row.kind !== kind) return null;
  if (row.expires_at <= now) return null;
  return { value: row.value, accountId: row.account_id, payload: row.payload };
}

// ---- Community documents ----

/** One stored document: the payload plus the version the next write must name. */
export interface StoredDocument {
  version: number;
  payload: string;
  updatedAt: number;
}

/**
 * The Account's document for one community, or null if it has never synced.
 *
 * Keyed on the pair: one Account with three Communities is three rows, so a
 * push for one community never touches another's document.
 */
export async function getDocument(
  db: Database,
  accountId: Id,
  communityId: Id,
): Promise<StoredDocument | null> {
  const row = await db
    .prepare("SELECT version, payload, updated_at FROM community_documents WHERE account_id = ? AND community_id = ?")
    .bind(accountId, communityId)
    .first<{ version: number; payload: string; updated_at: number }>();
  if (!row) return null;
  return { version: row.version, payload: row.payload, updatedAt: row.updated_at };
}

/** Every community the Account has a document for, with versions and no payloads. */
export async function listDocumentSummaries(
  db: Database,
  accountId: Id,
): Promise<Array<{ communityId: Id; version: number; updatedAt: number }>> {
  const result = await db
    .prepare("SELECT community_id, version, updated_at FROM community_documents WHERE account_id = ? ORDER BY updated_at DESC")
    .bind(accountId)
    .all<{ community_id: string; version: number; updated_at: number }>();
  return result.map((r) => ({ communityId: r.community_id, version: r.version, updatedAt: r.updated_at }));
}

/**
 * First write for this community: the insert the compare-and-swap guards.
 *
 * Returns the new version (always 1) — or null if a row already exists, which
 * means the Account has data here and adoption must not proceed blind.
 * `INSERT OR IGNORE` against the pair primary key makes the check and the write
 * one statement, so a concurrent first sync cannot produce two rows.
 */
export async function insertDocument(
  db: Database,
  accountId: Id,
  communityId: Id,
  payload: string,
  now: number,
): Promise<number | null> {
  const result = await db
    .prepare(
      "INSERT OR IGNORE INTO community_documents (account_id, community_id, version, payload, updated_at) VALUES (?, ?, 1, ?, ?)",
    )
    .bind(accountId, communityId, payload, now)
    .run();
  return result.changes === 1 ? 1 : null;
}

/**
 * The compare-and-swap (ticket 06's guard, defined here because ticket 05's
 * pull path reads the same rows).
 *
 * Applies only when the caller names the version it believes is current.
 * Returns the row's NEW version, or null when the named version was not the
 * current one — which is the rejection the losing device is told about.
 */
export async function updateDocument(
  db: Database,
  accountId: Id,
  communityId: Id,
  expectedVersion: number,
  payload: string,
  now: number,
): Promise<number | null> {
  const result = await db
    .prepare(
      "UPDATE community_documents SET payload = ?, version = version + 1, updated_at = ? WHERE account_id = ? AND community_id = ? AND version = ?",
    )
    .bind(payload, now, accountId, communityId, expectedVersion)
    .run();
  if (result.changes !== 1) return null;
  return expectedVersion + 1;
}

// ---- Community revisions (the normalized store's compare-and-swap) ----

/**
 * First write for this community against the normalized rows: create the
 * revision row at 1, or refuse when one already exists. The caller batches
 * this ahead of `collectDecompose`'s statements so the insert and the rows
 * commit together.
 */
export function collectInsertRevision(
  db: Database,
  accountId: Id,
  communityId: Id,
  now: number,
): Statement {
  return db
    .prepare(
      "INSERT OR IGNORE INTO community_revisions (account_id, community_id, revision, updated_at) VALUES (?, ?, 1, ?)",
    )
    .bind(accountId, communityId, now);
}

/**
 * The compare-and-swap on the revision counter: the FIRST statement of the
 * push transaction, ahead of `collectDecompose`'s row writes. Returns null
 * when the expected revision is not current — the losing device's refusal.
 */
export function collectCasRevision(
  db: Database,
  accountId: Id,
  communityId: Id,
  expectedRevision: number,
  now: number,
): Statement {
  return db
    .prepare(
      "UPDATE community_revisions SET revision = revision + 1, updated_at = ? WHERE account_id = ? AND community_id = ? AND revision = ?",
    )
    .bind(now, accountId, communityId, expectedRevision);
}

/** Current revision and update time for one community, or null if never synced. */
export async function getRevision(
  db: Database,
  accountId: Id,
  communityId: Id,
): Promise<{ revision: number; updatedAt: number } | null> {
  const row = await db
    .prepare("SELECT revision, updated_at FROM community_revisions WHERE account_id = ? AND community_id = ?")
    .bind(accountId, communityId)
    .first<{ revision: number; updated_at: number }>();
  return row ? { revision: row.revision, updatedAt: row.updated_at } : null;
}

/** Every community the Account has a revision for, newest update first. */
export async function listRevisions(
  db: Database,
  accountId: Id,
): Promise<Array<{ communityId: Id; revision: number; updatedAt: number }>> {
  const rows = await db
    .prepare("SELECT community_id, revision, updated_at FROM community_revisions WHERE account_id = ? ORDER BY updated_at DESC")
    .bind(accountId)
    .all<{ community_id: string; revision: number; updated_at: number }>();
  return rows.map((r) => ({ communityId: r.community_id, revision: r.revision, updatedAt: r.updated_at }));
}
