import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  API_BASE,
  apiFetch,
  getSession,
  mayReachNetwork,
  refresh,
  setSession,
  signOut,
  SESSION_KEY,
} from "./session";

/**
 * The session module's two promises, and the guard between them.
 *
 * **A signed-out device makes no request.** That is a claim about the network,
 * and it is the one a Guest's experience rests on: the app must not start
 * talking to a server because an Account exists somewhere else. It is asserted
 * by counting the fetches a signed-out call attempts, not by reading the guard's
 * return value — a guard nothing consults would pass the second kind of test.
 *
 * **A dead token never destroys anything.** Refresh with a 401 closes the guard
 * and leaves the session in place, so the Organizer keeps a readable app.
 * Clearing here is the failure ADR-0008 names: an empty app at the moment
 * somebody cannot sign back in.
 *
 * The unit environment is `node`, so there is no `localStorage`. That is not a
 * gap to work around — it is the "storage blocked" case, which the module is
 * required to survive, and it exercises that path on every run.
 */

const calls: string[] = [];

function stubFetch(handler: (url: string, init?: RequestInit) => Response): void {
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    calls.push(url);
    return handler(url, init);
  });
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

beforeEach(() => {
  calls.length = 0;
  // Module state survives between tests, so every case starts signed out.
  setSession(null);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("a signed-out device", () => {
  it("reports no session", () => {
    expect(getSession()).toBeNull();
  });

  it("closes the guard", () => {
    expect(mayReachNetwork()).toBe(false);
  });

  it("makes no request, even when something asks it to", async () => {
    stubFetch(() => json({ ok: true }));
    const response = await apiFetch("/api/communities/c1", { method: "POST", body: "{}" });
    expect(response).toBeNull();
    // The assertion that matters: not that the call returned null, but that
    // nothing left the process.
    expect(calls).toEqual([]);
  });
});

describe("a signed-in device", () => {
  beforeEach(() => {
    setSession({ accountId: "a1", token: "live-token", expiresAt: Date.now() + 60_000 });
  });

  it("opens the guard", () => {
    expect(mayReachNetwork()).toBe(true);
  });

  it("sends the token as a bearer header", async () => {
    let seen: string | null = null;
    stubFetch((_url, init) => {
      seen = new Headers(init?.headers).get("authorization");
      return json({ ok: true });
    });
    await apiFetch("/api/session");
    expect(seen).toBe("Bearer live-token");
  });

  it("targets the configured API base", async () => {
    stubFetch(() => json({ ok: true }));
    await apiFetch("/api/session");
    expect(calls[0]).toBe(`${API_BASE}/api/session`);
  });

  it("returns null rather than throwing when the network is gone", async () => {
    // Offline is the expected state for this product, not an error path. A throw
    // here would land in a render, and the split screen is downstream.
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("Failed to fetch");
    });
    await expect(apiFetch("/api/session")).resolves.toBeNull();
  });
});

describe("a stale token", () => {
  it("closes the guard rather than clearing the session", async () => {
    stubFetch(() => new Response("", { status: 401 }));
    setSession({ accountId: "a1", token: "stale", expiresAt: Date.now() + 60_000 });

    await refresh();

    // The session survives, so the Account panel can still name who is signed in
    // and the local data is untouched — nothing in this module reads or writes
    // domain stores at all.
    expect(getSession()).not.toBeNull();
    expect(getSession()?.accountId).toBe("a1");
    // And the guard is shut, so no write will carry the dead token.
    expect(mayReachNetwork()).toBe(false);
  });

  it("leaves the session intact when the server cannot be reached", async () => {
    // The offline case, which must not be confused with the rejected case.
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("Failed to fetch");
    });
    setSession({ accountId: "a1", token: "live", expiresAt: Date.now() + 60_000 });
    await refresh();
    expect(mayReachNetwork()).toBe(true);
  });

  it("closes the guard on its own once the expiry passes", () => {
    // Expiry is enforced locally too, so a device that has not heard from the
    // server in a month stops sending rather than collecting 401s.
    setSession({ accountId: "a1", token: "live", expiresAt: 1_000 });
    expect(mayReachNetwork(2_000)).toBe(false);
  });

  it("makes no request at all once signed out", async () => {
    // The write path after a sign-out: `signOut` is local and synchronous, and
    // the very next request must already be refused.
    stubFetch(() => json({ ok: true }));
    setSession({ accountId: "a1", token: "live", expiresAt: Date.now() + 60_000 });
    signOut();
    expect(await apiFetch("/api/communities/c1", { method: "POST" })).toBeNull();
    expect(calls).toEqual([]);
  });
});

describe("signOut", () => {
  it("clears the session and makes no request of its own", () => {
    stubFetch(() => json({ ok: true }));
    setSession({ accountId: "a1", token: "live", expiresAt: Date.now() + 60_000 });
    signOut();
    expect(getSession()).toBeNull();
    // Signing out is a local decision. The server's copy of the session is
    // allowed to expire on its own; making this a request would mean sign-out
    // fails when offline, which is exactly when someone wants it to work.
    expect(calls).toEqual([]);
  });
});

describe("storage", () => {
  it("keeps the session key namespaced with the app's other preferences", () => {
    // `tb-` is the existing convention (`tb-theme`, `tb-community`, ...), and a
    // second prefix would be a second thing to clear.
    expect(SESSION_KEY).toBe("tb-session");
  });

  it("survives a storage that throws on every read", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    });
    expect(() => setSession({ accountId: "a1", token: "t", expiresAt: 1 })).not.toThrow();
    expect(getSession()).not.toBeNull();
  });
});
