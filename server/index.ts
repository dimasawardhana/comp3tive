/**
 * The Worker's entry point: `/api/*`, and nothing else.
 *
 * `wrangler.jsonc` sets `assets.run_worker_first: ["/api/*"]`, so this script
 * only ever runs for an API path — every other request is served by the static
 * assets without reaching here. That scoping is not tidiness: the compatibility
 * date is past the point where a *navigation* request no longer invokes the
 * Worker script even on a matching path, so without it a browser navigating to
 * an API path would be handed the assets' 404 page while `fetch()` to the same
 * path reached this code. The config and this file are two halves of one
 * behaviour.
 *
 * No CORS headers are set, deliberately. The API is same-origin, it authenticates
 * with a bearer token rather than a cookie, and so a cross-origin page gains
 * nothing by making a request it cannot read the answer to.
 */

import { collectDecompose } from "./store/decompose";
import { reassemble } from "./store/reassemble";
import { parseBackup, type BackupData } from "../src/data/transfer";
import { collectCasRevision, collectInsertRevision, getRevision, listRevisions } from "./storage";
import { d1Database, type Database, type Statement } from "./db";
import {
  accountForToken,
  attachGoogle,
  describeAccount,
  finishRegistration,
  finishSignIn,
  signInWithGoogle,
  signOut,
  startRegistration,
  startSignIn,
} from "./identity";

/**
 * The Worker's environment.
 *
 * `Cloudflare.Env` is what `wrangler types` generated from `wrangler.jsonc`, so
 * the `DB` binding is declared there and checked against the config rather than
 * restated here. `GOOGLE_CLIENT_ID` is added on top because it is a *secret*,
 * set with `wrangler secret put` and deliberately absent from the config file —
 * optional, so a deployment without it answers 503 on the Google routes instead
 * of failing to start.
 */
type Env = Cloudflare.Env & { GOOGLE_CLIENT_ID?: string };

/** A refusal with an HTTP status. Anything else reaching the top is a 500. */
class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

/**
 * The bearer token, if the request carries one.
 *
 * Read from the header and nowhere else — never a query parameter, which ends up
 * in logs and referrers.
 */
function bearer(request: Request): string {
  const header = request.headers.get("authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

async function requireAccount(db: Database, request: Request): Promise<string> {
  const accountId = await accountForToken(db, bearer(request));
  if (!accountId) throw new ApiError(401, "Not signed in.");
  return accountId;
}

async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new ApiError(400, "That request body is not valid JSON.");
  }
}

/** Parse a document payload, mapping a rejected document onto a 400. */
function parseOr400(payload: string): BackupData {
  try {
    return parseBackup(payload);
  } catch (error) {
    throw new ApiError(400, error instanceof Error ? error.message : "That payload is not a valid document.");
  }
}

/**
 * The `community_documents` dual-write, gated on the revision counter like
 * every other statement in the batch. During the dual-write window writes go
 * to both stores (reads come from the normalized rows), so a failed deploy can
 * be rolled back without data loss (relational plan, Task 3).
 *
 * `insert` selects the insert-or-ignore shape (adoption); otherwise the
 * versioned UPDATE (push), which only fires when the blob row exists.
 */
function guardedDocumentUpsert(
  db: Database,
  accountId: string,
  communityId: string,
  payload: string,
  now: number,
  revision: number,
  insert: boolean,
): Statement {
  const guard = " AND (SELECT revision FROM community_revisions WHERE account_id = ? AND community_id = ?) = ?";
  return insert
    ? db
        .prepare(
          `INSERT INTO community_documents (account_id, community_id, version, payload, updated_at)
           SELECT ?, ?, 1, ?, ? WHERE NOT EXISTS (SELECT 1 FROM community_documents WHERE account_id = ? AND community_id = ?)${guard}`,
        )
        .bind(accountId, communityId, payload, now, accountId, communityId, accountId, communityId, revision)
    : db
        .prepare(
          `UPDATE community_documents SET payload = ?, version = version + 1, updated_at = ? WHERE account_id = ? AND community_id = ?${guard}`,
        )
        .bind(payload, now, accountId, communityId, accountId, communityId, revision);
}

/**
 * The API routes.
 *
 * Split out from `fetch` so the error boundary — and the one place a thrown
 * error becomes a status — is not interleaved with the routing table.
 */
async function route(db: Database, request: Request, env: Env, pathname: string): Promise<Response> {
  const method = request.method;

  if (pathname === "/api/session" && method === "GET") {
    const accountId = await accountForToken(db, bearer(request));
    // Not signed in is a 401 rather than an empty 200: the client's guard reads
    // this answer, and "no Account" and "an Account with no data" are different.
    if (!accountId) return json({ signedIn: false }, 401);
    const account = await describeAccount(db, accountId);
    if (!account) return json({ signedIn: false }, 401);
    return json({ signedIn: true, account: { id: account.id, email: account.email } });
  }
  // Which optional sign-in methods this deployment has configured.
  //
  // The client reads exactly ONE `import.meta.env` variable — the API base —
  // and the acceptance criterion for this ticket says so. So the Google client
  // id is served from here instead of being baked into the bundle as a second
  // one, which also means a deployment can turn Google on or off without a
  // rebuild. The value is not a secret: it travels in every OAuth request
  // Google's own script makes.
  if (pathname === "/api/config" && method === "GET") {
    return json({ googleClientId: env.GOOGLE_CLIENT_ID ?? null });
  }

  if (pathname === "/api/signout" && method === "POST") {
    await signOut(db, bearer(request));
    // Always 200, whether or not the token was live. Signing out of a session
    // the server had already forgotten has succeeded.
    return json({ ok: true });
  }

  // ---- Passkeys ----

  if (pathname === "/api/passkey/register/options" && method === "POST") {
    // Signed in means "add a passkey to this Account"; signed out means "create
    // one". The distinction is the whole reason this route reads the session.
    const accountId = await accountForToken(db, bearer(request));
    const body = await readJson<{ email?: string }>(request).catch(() => ({}) as { email?: string });
    const ceremony = await startRegistration(db, request, {
      accountId,
      email: typeof body.email === "string" ? body.email : null,
    });
    return json(ceremony);
  }

  if (pathname === "/api/passkey/register/verify" && method === "POST") {
    const body = await readJson<{ ceremonyId?: string; response?: unknown }>(request);
    if (!body.ceremonyId || !body.response) throw new ApiError(400, "That request is missing its ceremony.");
    const result = await finishRegistration(db, request, body.ceremonyId, body.response as never);
    return json({
      account: { id: result.account.id, email: result.account.email },
      token: result.session.token,
      expiresAt: result.session.expiresAt,
    });
  }

  if (pathname === "/api/passkey/signin/options" && method === "POST") {
    return json(await startSignIn(db, request));
  }

  if (pathname === "/api/passkey/signin/verify" && method === "POST") {
    const body = await readJson<{ ceremonyId?: string; response?: unknown }>(request);
    if (!body.ceremonyId || !body.response) throw new ApiError(400, "That request is missing its ceremony.");
    const session = await finishSignIn(db, request, body.ceremonyId, body.response as never);
    return json({ token: session.token, expiresAt: session.expiresAt });
  }

  // ---- Google ----

  if (pathname === "/api/google/signin" && method === "POST") {
    if (!env.GOOGLE_CLIENT_ID) throw new ApiError(503, "Google sign-in is not configured on this deployment.");
    const body = await readJson<{ credential?: string }>(request);
    if (!body.credential) throw new ApiError(400, "That request carries no credential.");
    const session = await signInWithGoogle(db, body.credential, { clientId: env.GOOGLE_CLIENT_ID });
    return json({ token: session.token, expiresAt: session.expiresAt });
  }

  if (pathname === "/api/google/attach" && method === "POST") {
    if (!env.GOOGLE_CLIENT_ID) throw new ApiError(503, "Google sign-in is not configured on this deployment.");
    // Requires a session: attaching a second way in is an explicit act by the
    // Organizer who already controls the Account (ADR-0008).
    const accountId = await requireAccount(db, request);
    const body = await readJson<{ credential?: string }>(request);
    if (!body.credential) throw new ApiError(400, "That request carries no credential.");
    await attachGoogle(db, accountId, body.credential, { clientId: env.GOOGLE_CLIENT_ID });
    return json({ ok: true });
  }

  // ---- Community documents (normalized store; dual-write window) ----

  if (pathname === "/api/documents" && method === "GET") {
    const accountId = await requireAccount(db, request);
    const summaries = await listRevisions(db, accountId);
    return json({
      documents: summaries.map((s) => ({ communityId: s.communityId, version: s.revision, updatedAt: s.updatedAt })),
    });
  }

  if (pathname === "/api/documents/pull" && method === "POST") {
    const accountId = await requireAccount(db, request);
    const body = await readJson<{ communityIds?: unknown }>(request);
    const ids = Array.isArray(body.communityIds)
      ? body.communityIds.filter((v): v is string => typeof v === "string")
      : [];
    const documents: Array<{ communityId: string; version: number; payload: string }> = [];
    for (const communityId of ids) {
      // A pull is a read, never a write: the payload is reassembled from the
      // rows, so a community whose revision row exists always has a document.
      const revision = await getRevision(db, accountId, communityId);
      if (!revision) continue;
      const doc = await reassemble(db, accountId, communityId);
      if (!doc) continue;
      documents.push({ communityId, version: revision.revision, payload: JSON.stringify(doc) });
    }
    return json({ documents });
  }

  // Adoption's first write: create the revision row at 1 and decompose the
  // document into rows, one atomic batch. Insert-only: an Account that already
  // has a revision for this community gets a 409 rather than an overwrite,
  // because the overwrite path runs through the compare-and-swap and never
  // through an adoption. The parse is validation, not normalization: a payload
  // that fails it applies nothing.
  if (pathname === "/api/documents/adopt" && method === "POST") {
    const accountId = await requireAccount(db, request);
    const body = await readJson<{ communityId?: string; payload?: string }>(request);
    if (!body.communityId || typeof body.payload !== "string")
      throw new ApiError(400, "That request is missing its community or payload.");
    const doc = parseOr400(body.payload);
    const now = Date.now();
    const statements = [
      collectInsertRevision(db, accountId, body.communityId, now),
      ...collectDecompose(db, accountId, body.communityId, doc, 1),
      // Dual-write window (relational plan, Task 3): community_documents stays
      // current so a failed deploy can be rolled back without data loss.
      // Guarded like the rest: it applies only when the revision row was
      // created by this batch.
      guardedDocumentUpsert(db, accountId, body.communityId, JSON.stringify(doc), now, 1, true),
    ];
    const results = await db.batch(statements);
    // The revision insert is the gate: changes 0 means the row existed.
    if (results[0].changes !== 1)
      return json({ error: "This Account already has data for that community." }, 409);
    return json({ version: 1 });
  }
  // The compare-and-swap push: the CAS UPDATE on community_revisions is the
  // FIRST statement of the batch, and every row write carries the gate in its
  // own WHERE — a subquery naming the revision a winning CAS produces. A
  // `batch` is atomic but a lost CAS is not an error: without the per-statement
  // guard the loser's writes would run anyway. With it, a loser leaves zero
  // rows behind and gets a 409 carrying the server's current revision.
  if (pathname === "/api/documents/push" && method === "POST") {
    const accountId = await requireAccount(db, request);
    const body = await readJson<{ communityId?: string; expectedVersion?: number; payload?: string }>(request);
    if (!body.communityId || typeof body.payload !== "string" || typeof body.expectedVersion !== "number")
      throw new ApiError(400, "That request is missing its community, version or payload.");
    const doc = parseOr400(body.payload);
    const now = Date.now();
    const existing = await getRevision(db, accountId, body.communityId);
    if (!existing) return json({ error: "No document to push onto.", serverVersion: null }, 409);
    if (existing.revision !== body.expectedVersion)
      return json({ error: "This community changed on another device first.", serverVersion: existing.revision }, 409);
    const next = body.expectedVersion + 1;
    const statements = [
      collectCasRevision(db, accountId, body.communityId, body.expectedVersion, now),
      ...collectDecompose(db, accountId, body.communityId, doc, next),
      // Dual-write window: the blob's version is kept in step with the
      // revision counter, in the same transaction so the two never diverge.
      guardedDocumentUpsert(db, accountId, body.communityId, JSON.stringify(doc), now, next, false),
    ];
    const results = await db.batch(statements);
    // The CAS is the gate: changes 0 means another write won between our read
    // and this batch. Re-read for the 409's current revision.
    if (results[0].changes !== 1) {
      const current = await getRevision(db, accountId, body.communityId);
      return json(
        { error: "This community changed on another device first.", serverVersion: current?.revision ?? null },
        409,
      );
    }
    return json({ version: next });
  }

  return json({ error: "No such endpoint." }, 404);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const db = d1Database(env.DB);

    try {
      return await route(db, request, env, url.pathname);
    } catch (error) {
      if (error instanceof ApiError) return json({ error: error.message }, error.status);
      // Anything else is a bug on this side, and the message is not echoed: a
      // thrown SQL error can name a table and a column, and the client has no
      // use for either.
      console.error("api error", url.pathname, error);
      return json({ error: "Something went wrong on the server." }, 500);
    }
  },
};
