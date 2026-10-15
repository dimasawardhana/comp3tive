/**
 * The client's account session: who is signed in, and the one answer to "may
 * this write reach the network".
 *
 * **One module, because the question has one answer.** Whether a request may
 * leave the device while signed out is not a per-call-site judgement: if two
 * call sites answer it differently, one of them is wrong and the failure is a
 * request made on behalf of a Guest. So the token, the state, and the guard all
 * live here, and everything else asks.
 *
 * ## What this module does NOT do
 *
 * It does not render, and it never gates the read path. ADR-0007 keeps reads on
 * IndexedDB: `list*()` is answered from the local store, signed in or not, so a
 * signed-in Organizer on a court with no signal opens an app with their roster
 * in it. Nothing here may be awaited before something is drawn.
 *
 * It also does not clear anything on a failure. ADR-0008: a stale token leaves
 * the local data readable and writable, because clearing on expiry hands a
 * signed-in Organizer an empty app at exactly the moment they cannot sign back
 * in. Only an explicit `signOut()` is destructive, and that is the caller's
 * deliberate act.
 */

import type { Id } from "../domain/types";

export interface Session {
  accountId: Id;
  /** The bearer token. Only its digest is stored server-side. */
  token: string;
  /** Epoch ms. Advisory: expiry never clears data, it only closes the guard. */
  expiresAt: number;
}

/** Where the session lives between loads. Same `tb-` prefix as the other prefs. */
export const SESSION_KEY = "tb-session";

/**
 * The API base.
 *
 * The repository's **first** Vite environment read, and deliberately the only
 * one: the server's other configuration is server-side (a Worker secret), and a
 * second client-side read would be a second thing to get wrong at deploy time.
 *
 * An empty default means same-origin, which is what development (`vite` proxying
 * nothing) and production (`assets.run_worker_first: ["/api/*"]`) both want. The
 * variable exists for the one case that is neither: a client served from a
 * different host than the API, during a preview.
 */
export const API_BASE: string = (import.meta.env?.VITE_API_BASE as string | undefined) ?? "";

let current: Session | null = null;

/** True once localStorage has been consulted, so the first `getSession` may load. */
let loaded = false;

function readStored(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as Session).accountId === "string" &&
      typeof (parsed as Session).token === "string"
    ) {
      return {
        accountId: (parsed as Session).accountId,
        token: (parsed as Session).token,
        expiresAt: typeof (parsed as Session).expiresAt === "number" ? (parsed as Session).expiresAt : 0,
      };
    }
    return null;
  } catch {
    // A blocked or corrupt store means "no session", which is the signed-out
    // path — the safe direction, since it can only cause an extra sign-in.
    return null;
  }
}

function writeStored(session: Session | null): void {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    // In-memory only. The session still works for this load; the next one asks
    // the user to sign in again, which is the reversible failure.
  }
}

/**
 * The current session, or null.
 *
 * Reads through to storage on the first call so a reload keeps the Organizer
 * signed in without any caller having to remember to restore it.
 */
export function getSession(): Session | null {
  if (!loaded) {
    loaded = true;
    current = readStored();
  }
  return current;
}

/** Record a session. Signing in is the only production caller. */
export function setSession(next: Session | null): void {
  loaded = true;
  current = next;
  writeStored(next);
}

/**
 * Whether a write may reach the network.
 *
 * **The guard, and the only one.** Signed out is false — no token, so no request
 * — and a session past its expiry is false too, because a request carrying a
 * dead token produces a 401 the caller would have to handle per call site. Note
 * what is *not* here: nothing about the local data. This answers a question
 * about the network, and the read path does not consult it.
 */
export function mayReachNetwork(now = Date.now()): boolean {
  const session = getSession();
  if (!session) return false;
  return session.expiresAt > now;
}

/**
 * Attach the session to a request.
 *
 * Returns null when the guard is closed, so a caller's `if (!response)` handles
 * "signed out" and "the request failed" the same way — both degrade the sync and
 * neither breaks a screen.
 */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response | null> {
  const session = getSession();
  if (!session || !mayReachNetwork()) return null;
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${session.token}`);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  try {
    return await fetch(`${API_BASE}${path}`, { ...init, headers });
  } catch {
    // Offline, DNS, TLS: the same class of failure as a signed-out write as far
    // as every caller is concerned, and it must not throw into a render path.
    return null;
  }
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? "That did not work.");
  return payload;
}

/** Sign out on this device. Local and synchronous; it makes no request. */
export function signOut(): void {
  setSession(null);
}

export interface SignedIn {
  accountId: Id;
  expiresAt: number;
}

async function adopt(token: string, expiresAt: number): Promise<SignedIn> {
  // The token alone does not say which Account it is for, so the identity is
  // confirmed before it is stored: a session the client cannot name is a session
  // the Account panel cannot render.
  const response = await fetch(`${API_BASE}/api/session`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error("That sign-in could not be completed.");
  const body = (await response.json()) as { account?: { id?: string } };
  const accountId = body.account?.id;
  if (!accountId) throw new Error("That sign-in could not be completed.");
  setSession({ accountId, token, expiresAt });
  return { accountId, expiresAt };
}

/**
 * Re-read the session from the server.
 *
 * **A failure here never clears the session and never clears data.** A 401 means
 * the token is dead, which closes the guard — and that is all it does. The
 * Organizer keeps a readable, writable app and the next successful sign-in
 * restores the sync. ADR-0008 records why: expiry must not hand someone an empty
 * app on a court with no signal.
 */
export async function refresh(): Promise<void> {
  const session = getSession();
  if (!session) return;
  try {
    const response = await fetch(`${API_BASE}/api/session`, {
      headers: { authorization: `Bearer ${session.token}` },
    });
    if (response.status === 401) {
      // Dead token: keep the session for reading, and let the guard decide.
      setSession({ ...session, expiresAt: 0 });
      return;
    }
    if (!response.ok) return;
  } catch {
    // Offline. The session stands.
  }
}

/**
 * A failed ceremony, in words an Organizer can act on.
 *
 * The browser's own text is accurate and useless: `NotAllowedError` covers the
 * user cancelling, no matching credential, and a timeout, and its message names
 * all three without naming a next step. The commonest real cause here is the
 * honest one, so it is the one the message leads with.
 */
function ceremonyFailure(err: unknown, action: "create" | "sign in"): Error {
  if (err instanceof Error) {
    if (err.name === "NotAllowedError" || err.name === "AbortError") {
      return action === "create"
        ? new Error("Your device did not create a passkey. Try again, or use a device with a screen lock.")
        : new Error("No passkey matched. If you have not created an account on this device yet, choose Create an account.");
    }
    if (err.name === "InvalidStateError") {
      return new Error("This device already has a passkey for this origin. Sign in with it instead.");
    }
    return err;
  }
  return new Error("That did not work. Try again.");
}

// ---- Passkeys ----

/** The options/verify pair for one WebAuthn ceremony, over the API. */
export async function startPasskeyRegistration(): Promise<SignedIn> {
  const { startRegistration } = await import("@simplewebauthn/browser");
  const ceremony = await post<{ ceremonyId: string; options: never }>("/api/passkey/register/options", {});
  let response;
  try {
    response = await startRegistration({ optionsJSON: ceremony.options });
  } catch (err) {
    throw ceremonyFailure(err, "create");
  }
  const result = await post<{ account: { id: string }; token: string; expiresAt: number }>(
    "/api/passkey/register/verify",
    { ceremonyId: ceremony.ceremonyId, response },
  );
  setSession({ accountId: result.account.id, token: result.token, expiresAt: result.expiresAt });
  return { accountId: result.account.id, expiresAt: result.expiresAt };
}

export async function signInWithPasskey(): Promise<SignedIn> {
  const { startAuthentication } = await import("@simplewebauthn/browser");
  const ceremony = await post<{ ceremonyId: string; options: never }>("/api/passkey/signin/options", {});
  let response;
  try {
    response = await startAuthentication({ optionsJSON: ceremony.options });
  } catch (err) {
    throw ceremonyFailure(err, "sign in");
  }
  const result = await post<{ token: string; expiresAt: number }>("/api/passkey/signin/verify", {
    ceremonyId: ceremony.ceremonyId,
    response,
  });
  return adopt(result.token, result.expiresAt);
}

/**
 * Sign in with a Google credential.
 *
 * `credential` is the ID token from Google Identity Services. It is verified
 * server-side; the client's copy of it is never trusted for anything.
 */
export async function signInWithGoogle(credential: string): Promise<SignedIn> {
  const result = await post<{ token: string; expiresAt: number }>("/api/google/signin", { credential });
  return adopt(result.token, result.expiresAt);
}

/** Attach Google to the signed-in Account. Requires a session. */
export async function attachGoogle(credential: string): Promise<void> {
  const response = await apiFetch("/api/google/attach", {
    method: "POST",
    body: JSON.stringify({ credential }),
  });
  if (!response) throw new Error("Sign in first.");
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "That did not work.");
  }
}
