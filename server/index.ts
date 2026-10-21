/**
 * The Worker's entry point: `/api/*`, and the public `/join/*` page.
 *
 * `wrangler.jsonc` sets `assets.run_worker_first: ["/api/*", "/join/*"]`, so
 * this script runs for those paths and nothing else — every other request is
 * served by the static assets without reaching here. That scoping is not
 * tidiness: the compatibility date is past the point where a *navigation*
 * request no longer invokes the Worker script even on a matching path, so
 * without it a browser navigating to an API path would be handed the assets'
 * 404 page while `fetch()` to the same path reached this code. The config and
 * this file are two halves of one behaviour.
 *
 * No CORS headers are set, deliberately. The API is same-origin, it
 * authenticates with a bearer token rather than a cookie, and so a
 * cross-origin page gains nothing by making a request it cannot read the
 * answer to. The public join page is same-origin too: the Worker itself
 * serves it at `/join/:code`.
 */

import { collectDecompose, collectDeleteCommunity } from "./store/decompose";
import { leaderboard, searchPlayers, sessionHistory } from "./store/queries";
import { reassemble } from "./store/reassemble";
import {
  accountDisciplines,
  communityName,
  countRegistrations,
  deleteRegistrations,
  insertRegistration,
  joinCodeByCode,
  listJoinCodes,
  listRegistrations,
  mintJoinCode,
  type RegistrationPayload,
} from "./store/join";
import { parseBackup, type BackupData } from "../src/data/transfer";
import { joinPage } from "./join-page";
import { collectCasRevision, collectInsertRevision, getRevision, listRevisions } from "./storage";
import { d1Database, type Database } from "./db";
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

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
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

  // ---- Community documents (the normalized store) ----

  if (pathname === "/api/documents" && method === "GET") {
    const accountId = await requireAccount(db, request);
    const summaries = await listRevisions(db, accountId);
    return json({
      documents: summaries.map((s) => ({ communityId: s.communityId, version: s.revision, updatedAt: s.updatedAt })),
    });
  }

  // ---- Cross-community queries (RB-5) ----
  //
  // Reads the blob store could not answer: leaderboards, player search,
  // session history. All three take the account from the token and the
  // selectors from the URL, never from a payload — same tenant rule as every
  // other route. The client UI that consumes them is a separate design task
  // (it touches the "no screen awaits a fetch" invariant), so nothing in src/
  // calls these yet.

  if (pathname.startsWith("/api/leaderboards/") && method === "GET") {
    const accountId = await requireAccount(db, request);
    const [disciplineId, attributeId] = pathname.slice("/api/leaderboards/".length).split("/").map(decodeURIComponent);
    if (!disciplineId || !attributeId) throw new ApiError(400, "That request names no discipline or attribute.");
    return json({ rows: await leaderboard(db, accountId, disciplineId, attributeId) });
  }

  if (pathname === "/api/players" && method === "GET") {
    const accountId = await requireAccount(db, request);
    const q = new URL(request.url).searchParams.get("q") ?? "";
    if (!q) throw new ApiError(400, "That request names no player to search for.");
    return json({ players: await searchPlayers(db, accountId, q) });
  }

  if (pathname === "/api/history" && method === "GET") {
    const accountId = await requireAccount(db, request);
    const disciplineId = new URL(request.url).searchParams.get("disciplineId") ?? "";
    if (!disciplineId) throw new ApiError(400, "That request names no discipline.");
    return json({ sessions: await sessionHistory(db, accountId, disciplineId) });
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
  // A community deletion: remove the revision row and the decomposed rows
  // together, so the document cannot resurrect at the next pull or sign-in.
  // Idempotent by design — the client's local cascade already succeeded
  // before this is called, so a retry after a lost response must succeed too.

  // ---- Public player registration (join codes) ----
  //
  // TASK-125. The Organizer mints a code per community; the public form at
  // /join/<code> reads and writes through these routes with no session. A
  // registration is a row, never a community-document write: the document's
  // compare-and-swap belongs to the Organizer, so the public's entry into the
  // roster is the Organizer pulling rows (below), not a push.

  // Mint a code. Any number may exist per community — minting a new one does
  // not invalidate the old, because "close sign-ups" is a later feature and a
  // silent revoke would break links the Organizer has already shared.
  if (pathname === "/api/join/codes" && method === "POST") {
    const accountId = await requireAccount(db, request);
    const body = await readJson<{ communityId?: string; disciplineId?: unknown }>(request);
    if (!body.communityId) throw new ApiError(400, "That request is missing its community.");
    // The account must have a revision row for the community: the code points
    // public traffic at it, and one that named an unknown community would
    // serve a form whose registrations could never be pulled.
    const revision = await getRevision(db, accountId, body.communityId);
    if (!revision) throw new ApiError(404, "No such community for this Account.");
    // A link may be minted FOR a discipline: the public form then registers
    // for that discipline alone. The id must be one the Account's catalog
    // holds — same rule as every other catalog reference the server checks.
    let disciplineId: string | undefined;
    if (typeof body.disciplineId === "string" && body.disciplineId) {
      const disciplines = await accountDisciplines(db, accountId);
      if (!disciplines.some((d) => d.id === body.disciplineId))
        throw new ApiError(404, "No such discipline for this Account.");
      disciplineId = body.disciplineId;
    }
    const code = await mintJoinCode(db, accountId, body.communityId, Date.now(), disciplineId);
    return json({ code: code.code, communityId: code.communityId, createdAt: code.createdAt });
  }

  if (pathname === "/api/join/codes" && method === "GET") {
    const accountId = await requireAccount(db, request);
    const codes = await listJoinCodes(db, accountId);
    return json({ codes });
  }

  if (pathname.startsWith("/api/join/") && method === "GET" && pathname !== "/api/join/codes") {
    const code = decodeURIComponent(pathname.slice("/api/join/".length));
    const record = await joinCodeByCode(db, code);
    if (!record) throw new ApiError(404, "That join code does not exist.");
    const name = await communityName(db, record.accountId, record.communityId);
    if (!name) throw new ApiError(404, "That join code does not exist.");
    const disciplines = await accountDisciplines(db, record.accountId);
    if (record.disciplineId) {
      // A bound link: the form offers exactly one discipline — the one the
      // Organizer chose at mint. A binding whose discipline was deleted
      // since (CASCADE removed the row) reads as unbound and falls back to
      // the whole catalog, which still registers fine.
      const bound = disciplines.find((d) => d.id === record.disciplineId);
      if (bound) return json({ community: { name }, disciplines: [bound] });
    }
    return json({ community: { name }, disciplines });
  }

  // The public form's submission. Rate-limited per code rather than per IP:
  // a Worker has no durable per-IP state, and the cap that matters is how
  // many rows an Organizer must review, not who sent them.
  if (pathname.startsWith("/api/join/") && method === "POST" && !pathname.startsWith("/api/join/registrations")) {
    const code = decodeURIComponent(pathname.slice("/api/join/".length));
    const record = await joinCodeByCode(db, code);
    if (!record) throw new ApiError(404, "That join code does not exist.");
    const body = await readJson<{
      name?: unknown;
      discipline?: unknown;
      role?: unknown;
      roles?: unknown;
      ratings?: unknown;
      notes?: unknown;
    }>(request);
    const name = typeof body.name === "string" ? body.name.trim() : "";
    let discipline = typeof body.discipline === "string" ? body.discipline.trim() : "";
    if (!name || name.length > 80) throw new ApiError(400, "A registration needs a name (at most 80 characters).");
    // The discipline must be one the community offers: the form's picker is a
    // convenience, not the validation, so the server checks the name against
    // the catalog rather than trusting the request. A BOUND link overrules
    // whatever the request says — the link names the discipline, not the
    // visitor (a bound form has no picker to disagree with anyway).
    const disciplines = await accountDisciplines(db, record.accountId);
    let offered = disciplines.filter((d) => d.name === discipline);
    if (record.disciplineId) {
      const bound = disciplines.filter((d) => d.id === record.disciplineId);
      if (bound.length > 0) {
        offered = bound;
        discipline = bound[0].name;
      }
      // A binding whose discipline was deleted falls back to the request's
      // discipline (still validated against the catalog), so the link
      // degrades to the unbound form instead of 400ing forever.
    }
    if (!discipline || discipline.length > 60) throw new ApiError(400, "A registration needs a discipline.");
    if (offered.length === 0) throw new ApiError(400, "That discipline is not one this community offers.");
    const role = typeof body.role === "string" && body.role.trim() ? body.role.trim() : null;
    if (role && !offered.some((d) => d.roles.includes(role)))
      throw new ApiError(400, "That role is not one the discipline offers.");
    // Every role the visitor says they can fill (the preferred one included,
    // by the domain rule that a preferred role is always among the eligible).
    // Same catalog rule as roles: offered names only, deduped, capped so a
    // hostile request cannot bloat the payload. Absent = old form tab, which
    // imports to eligible-for-everything exactly as before.
    let roles: string[] | null = null;
    if (Array.isArray(body.roles)) {
      const allowed = new Set(offered.flatMap((d) => d.roles));
      const seen = new Set<string>();
      roles = [];
      for (const entry of body.roles) {
        if (typeof entry !== "string" || !allowed.has(entry) || seen.has(entry)) continue;
        seen.add(entry);
        roles.push(entry);
        if (roles.length >= 12) break;
      }
      if (role && roles.length > 0 && !roles.includes(role)) roles.unshift(role);
      if (roles.length === 0) roles = null;
    }
    // Self-assessed ratings, same rule as roles: every key must name an
    // attribute the discipline defines (names merged across same-named
    // disciplines, exactly what the form offered) and every value must sit in
    // that attribute's bounds. Out-of-catalog keys are dropped, not rejected:
    // a stale tab from before a catalog edit should still register.
    const catalog = new Map<string, { min: number; max: number }>();
    for (const d of offered) for (const a of d.attributes) catalog.set(a.name, a);
    const ratings: Record<string, number> = {};
    if (isRecord(body.ratings)) {
      for (const [key, value] of Object.entries(body.ratings)) {
        const bounds = catalog.get(key);
        if (!bounds || typeof value !== "number" || !Number.isInteger(value)) continue;
        ratings[key] = Math.min(bounds.max, Math.max(bounds.min, value));
      }
    }
    const notes = typeof body.notes === "string" && body.notes.trim() ? body.notes.trim().slice(0, 500) : null;
    const now = Date.now();
    if ((await countRegistrations(db, code, now - 60_000)) >= 20)
      throw new ApiError(429, "That community's registration form is busy. Try again in a minute.");
    const payload: RegistrationPayload = { name, disciplineName: discipline, roleName: role, roles, ratings, notes };
    const registration = await insertRegistration(db, code, payload, now);
    return json({ id: registration.id }, 201);
  }

  // The Organizer's pull list for one code. Scoped by account: the code alone
  // must not list registrations, or a leaked code would leak names.
  if (pathname === "/api/join/registrations" && method === "POST") {
    const accountId = await requireAccount(db, request);
    const body = await readJson<{ code?: string }>(request);
    if (!body.code) throw new ApiError(400, "That request is missing its join code.");
    const record = await joinCodeByCode(db, body.code);
    if (!record || record.accountId !== accountId) throw new ApiError(404, "That join code does not exist.");
    const registrations = await listRegistrations(db, accountId, body.code);
    return json({ registrations });
  }

  // Acknowledge: the Organizer has handled these registrations (pulled them
  // into the roster or chosen to ignore them), so the server forgets them.
  // Idempotent — a retry after a lost response deletes nothing that matters.
  if (pathname === "/api/join/registrations/ack" && method === "POST") {
    const accountId = await requireAccount(db, request);
    const body = await readJson<{ ids?: unknown }>(request);
    const ids = Array.isArray(body.ids) ? body.ids.filter((v): v is string => typeof v === "string") : [];
    await deleteRegistrations(db, accountId, ids);
    return json({ ok: true });
  }

  if (pathname === "/api/documents/delete" && method === "POST") {
    const accountId = await requireAccount(db, request);
    const body = await readJson<{ communityId?: string }>(request);
    if (!body.communityId || typeof body.communityId !== "string")
      throw new ApiError(400, "That request is missing its community.");
    await db.batch(collectDeleteCommunity(db, accountId, body.communityId));
    return json({ ok: true });
   }

  return json({ error: "No such endpoint." }, 404);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const db = d1Database(env.DB);

    try {
      // The public registration page: served here rather than from the static
      // assets because its document is per-request (the URL names the code),
      // and reached at all because wrangler.jsonc routes /join/* to this
      // Worker ahead of the assets. Like every asset navigation it is a GET;
      // anything else is not a navigation and falls through to the API's 404.
      if (request.method === "GET" && url.pathname.startsWith("/join/")) {
        const code = decodeURIComponent(url.pathname.slice("/join/".length));
        if (!/^[A-Za-z0-9_-]{1,64}$/.test(code)) return new Response("Not found", { status: 404 });
        return new Response(joinPage(code), {
          headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
        });
      }
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
