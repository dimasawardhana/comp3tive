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
