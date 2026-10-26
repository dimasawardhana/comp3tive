/**
 * Join codes and pending registrations (TASK-125): the store half of public
 * player registration.
 *
 * The write model is asymmetric on purpose. The public route INSERTs a
 * registration row and nothing else — never a community document, whose
 * compare-and-swap belongs to the Organizer alone (docs/adr/0007). The
 * Organizer's routes read by (account_id, code) so a tenant can never see
 * another tenant's registrations, and the ack route deletes rows the
 * Organizer has handled, whether accepted or ignored.
 *
 * A join code is capability, not identity: anyone holding it may register,
 * exactly like anyone holding the shared link. It is unguessable by
 * construction (8 random bytes from WebCrypto, base64url — 64 bits).
 */
import type { Database } from "../db";
import { toBase64Url } from "../encoding";

/** A join code minted for one community. */
export interface JoinCode {
  code: string;
  communityId: string;
  /** The discipline this link registers players for; null = whole catalog
   * (codes minted before links became one-per-discipline). */
  disciplineId: string | null;
  createdAt: number;
}

/** One pending registration, as the public form submitted it. */
export interface JoinRegistration {
  id: string;
  payload: string;
  createdAt: number;
}

/** A registration's payload: the form's fields, validated before storage.
 *
 * `ratings` is keyed by attribute NAME (the public form knows no ids) with the
 * visitor's self-assessed values. Null on rows written before this field
 * existed; consumers default those to the middle rating.
 */
export interface RegistrationPayload {
  name: string;
  disciplineName: string;
  roleName: string | null;
  /** Every role the visitor said they can fill, preferred one included.
   * Null on rows older than the multi-role form (and on visitors who
   * ticked none) — imports to eligible-for-everything. */
  roles: string[] | null;
  ratings: Record<string, number> | null;
  notes: string | null;
}

/** Mint a code for the community, optionally bound to one discipline.
 *
 * Binding is the point of the mint: the discipline's id lives server-side
 * (the public form never sees ids), the form drops its discipline picker,
 * and a registration through that link names the bound discipline. */
export async function mintJoinCode(
  db: Database,
  accountId: string,
  communityId: string,
  now: number,
  disciplineId?: string,
): Promise<JoinCode> {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const code = toBase64Url(bytes);
  await db.batch([
    db
      .prepare("INSERT INTO join_codes (code, account_id, community_id, created_at) VALUES (?, ?, ?, ?)")
      .bind(code, accountId, communityId, now),
    ...(disciplineId
      ? [
          db
            .prepare("INSERT INTO join_code_disciplines (code, account_id, discipline_id) VALUES (?, ?, ?)")
            .bind(code, accountId, disciplineId),
        ]
      : []),
  ]);
  return { code, communityId, disciplineId: disciplineId ?? null, createdAt: now };
}

/** Every code the Account has minted, newest first, with its binding. */
export async function listJoinCodes(db: Database, accountId: string): Promise<JoinCode[]> {
  const rows = await db
    .prepare(
      `SELECT c.code, c.community_id, c.created_at, b.discipline_id
       FROM join_codes c
       LEFT JOIN join_code_disciplines b ON b.code = c.code
       WHERE c.account_id = ?
       ORDER BY c.created_at DESC`,
    )
    .bind(accountId)
    .all<{ code: string; community_id: string; created_at: number; discipline_id: string | null }>();
  return rows.map((r) => ({
    code: r.code,
    communityId: r.community_id,
    disciplineId: r.discipline_id,
    createdAt: r.created_at,
  }));
}

/** Look a code up for the public route: the account, community, and — when
 * the link was minted for one discipline — that discipline's id. */
export async function joinCodeByCode(
  db: Database,
  code: string,
): Promise<{ accountId: string; communityId: string; disciplineId: string | null } | null> {
  const row = await db
    .prepare(
      `SELECT c.account_id, c.community_id, b.discipline_id
       FROM join_codes c
       LEFT JOIN join_code_disciplines b ON b.code = c.code
       WHERE c.code = ?`,
    )
    .bind(code)
    .first<{ account_id: string; community_id: string; discipline_id: string | null }>();
  if (!row) return null;
  return { accountId: row.account_id, communityId: row.community_id, disciplineId: row.discipline_id };
}

/** The community's name from the decomposed rows, for the public form's heading. */
export async function communityName(db: Database, accountId: string, communityId: string): Promise<string | null> {
  const row = await db
    .prepare("SELECT name FROM communities WHERE account_id = ? AND id = ?")
    .bind(accountId, communityId)
    .first<{ name: string }>();
  return row?.name ?? null;
}

/** The account's disciplines (name, roles, attributes), for the public form.
 *
 * Disciplines are per-ACCOUNT, not per-community (schema-v2's decision table):
 * the catalog is shared, so the public form offers the whole catalog. Role and
 * attribute names ride along (newline-joined) so the form needs no second
 * query. An attribute's bounds come too: the form's rating controls and the
 * POST's validation share one definition of a legal rating, and so do its
 * labels — a visitor sees "3 · Solid", the same words the Organizer sees.
 */
export interface JoinDiscipline {
  id: string;
  name: string;
  shortName: string;
  roles: string[];
  attributes: Array<{ name: string; min: number; max: number; labels: Record<string, string> }>;
}

export async function accountDisciplines(db: Database, accountId: string): Promise<JoinDiscipline[]> {
  const rows = await db
    .prepare(
      `SELECT d.id, d.name, d.short_name,
              (SELECT GROUP_CONCAT(r.name, '\n') FROM discipline_roles r
                WHERE r.account_id = d.account_id AND r.discipline_id = d.id
                ORDER BY r.position) AS roles,
             (SELECT GROUP_CONCAT(
                       a.name || '\t' || COALESCE(a.min_def, 1) || '\t' || COALESCE(a.max_def, 5) || '\t' ||
                       COALESCE((SELECT json_group_object(l.value, l.label)
                                   FROM discipline_attribute_labels l
                                  WHERE l.account_id = a.account_id
                                    AND l.discipline_id = a.discipline_id
                                    AND l.attribute_id = a.id), '{}'), '\n')
                FROM discipline_attributes a
                WHERE a.account_id = d.account_id AND a.discipline_id = d.id
                ORDER BY a.position) AS attributes
       FROM disciplines d
       WHERE d.account_id = ?
       ORDER BY d.rowid`,
    )
    .bind(accountId)
    .all<{
      id: string;
      name: string;
      short_name: string;
      roles: string | null;
      attributes: string | null;
    }>();
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    shortName: r.short_name,
    roles: r.roles === null ? [] : r.roles.split("\n"),
    attributes:
      r.attributes === null
        ? []
        : r.attributes.split("\n").map((line) => {
            const [name, min, max, labels] = line.split("\t");
            return {
              name,
              min: Number(min),
              max: Number(max),
              labels: JSON.parse(labels ?? "{}") as Record<string, string>,
            };
          }),
  }));
}

/** How many registrations this code already holds, for the rate limit. */
export async function countRegistrations(db: Database, code: string, since: number): Promise<number> {
  const row = await db
    .prepare("SELECT COUNT(*) AS n FROM join_registrations WHERE code = ? AND created_at >= ?")
    .bind(code, since)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

/** Record one registration. The id is random, like the code. */
export async function insertRegistration(
  db: Database,
  code: string,
  payload: RegistrationPayload,
  now: number,
): Promise<JoinRegistration> {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const id = toBase64Url(bytes);
  const body = JSON.stringify(payload);
  await db
    .prepare("INSERT INTO join_registrations (id, code, payload, created_at) VALUES (?, ?, ?, ?)")
    .bind(id, code, body, now)
    .run();
  return { id, payload: body, createdAt: now };
}

/** Pending registrations for one code, oldest first (the Organizer pulls in order). */
export async function listRegistrations(db: Database, accountId: string, code: string): Promise<JoinRegistration[]> {
  // The account_id scope is load-bearing: a code alone must not list another
  // tenant's registrations, so the join through join_codes happens here.
  const rows = await db
    .prepare(
      `SELECT r.id, r.payload, r.created_at
       FROM join_registrations r
       JOIN join_codes c ON c.code = r.code AND c.account_id = ?
       WHERE r.code = ?
       ORDER BY r.created_at`,
    )
    .bind(accountId, code)
    .all<{ id: string; payload: string; created_at: number }>();
  return rows.map((r) => ({ id: r.id, payload: r.payload, createdAt: r.created_at }));
}

/** Acknowledge registrations: delete rows the Organizer has handled. */
export async function deleteRegistrations(db: Database, accountId: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const stmts = ids.map((id) =>
    db
      .prepare(
        `DELETE FROM join_registrations WHERE id = ?
          AND code IN (SELECT code FROM join_codes WHERE account_id = ?)`,
      )
      .bind(id, accountId),
  );
  await db.batch(stmts);
}
