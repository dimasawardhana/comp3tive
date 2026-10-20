// @ts-nocheck
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The Google sign-in module's one decision, pinned: when One Tap declines to
 * appear — a normal state, not an error (no Google session, blocked
 * third-party cookies, or Google's dismissal cooldown) — the credential
 * request must not dead-end. With a live fallback container it hands the
 * choice to Google's rendered button instead; without one it keeps the old
 * report-and-reject contract.
 *
 * No DOM environment: the module's whole DOM surface is script injection,
 * `window.google`, and the container's `isConnected`, so node with stubbed
 * globals covers it without a jsdom install.
 */

type ScriptStub = { src: string; async: boolean; defer: boolean; onload: () => void; onerror: () => void };
type GsiStub = {
  initialize: ReturnType<typeof vi.fn>;
  prompt: ReturnType<typeof vi.fn>;
  renderButton: ReturnType<typeof vi.fn>;
};

let script: ScriptStub | null = null;

function stubDocument() {
  globalThis.document = {
    createElement: () => {
      script = { src: "", async: false, defer: false, onload: () => {}, onerror: () => {} };
      return script;
    },
    head: { appendChild: () => {} },
  };
}

/** A GSI double whose prompt reports the given moment on the next tick. */
function stubGsi(promptResult: { notDisplayed?: boolean; skipped?: boolean }): GsiStub {
  const gsi: GsiStub = {
    initialize: vi.fn(),
    prompt: vi.fn((listener: (n: never) => void) => {
      queueMicrotask(() => {
        listener({
          isNotDisplayed: () => !!promptResult.notDisplayed,
          isSkippedMoment: () => !!promptResult.skipped,
        });
      });
    }),
    renderButton: vi.fn(),
  };
  globalThis.window = { google: { accounts: { id: gsi } } };
  return gsi;
}

beforeEach(() => {
  vi.resetModules();
  stubDocument();
});

afterEach(() => {
  delete globalThis.document;
  delete globalThis.window;
  vi.restoreAllMocks();
});

async function loadModule() {
  // Dynamic on purpose: resetModules() between tests means the module-level
  // scriptPromise must re-resolve per test, so a fresh binding per call.
  const mod = await import("./google-signin");
  // Start a request so the (stubbed) GIS script loads; keep every rejection
  // awaited somewhere so the run has no unhandled rejections.
  const ready = mod.requestGoogleCredential("client-id");
  script.onload();
  return { mod, ready };
}

describe("requestGoogleCredential", () => {
  it("resolves with the credential when One Tap displays and the user picks", async () => {
    const gsi = stubGsi({});
    const { ready } = await loadModule();
    gsi.initialize.mock.calls[0][0].callback({ credential: "tok-1" });
    await expect(ready).resolves.toBe("tok-1");
    expect(gsi.renderButton).not.toHaveBeenCalled();
  });

  it("renders Google's button into a live fallback container when One Tap is suppressed", async () => {
    const gsi = stubGsi({ skipped: true });
    const container = { isConnected: true };
    const { ready } = await loadModule();
    const mod = await import("./google-signin");
    const second = mod.requestGoogleCredential("client-id", container);
    // Let the module's awaited loadScript() resolve so initialize/prompt run.
    await Promise.resolve();
    await Promise.resolve();
    gsi.initialize.mock.calls.at(-1)[0].callback({ credential: "tok-2" });
    await expect(second).resolves.toBe("tok-2");
    expect(gsi.renderButton).toHaveBeenCalledWith(container, expect.objectContaining({ type: "standard" }));
    // The first (containerless) call kept the old contract: it rejected.
    await expect(ready).rejects.toThrow("did not offer a sign-in");
  });

  it("still reports when One Tap is suppressed and no live container was given", async () => {
    const gsi = stubGsi({ notDisplayed: true });
    const { ready } = await loadModule();
    await expect(ready).rejects.toThrow("Google did not offer a sign-in. Try a passkey instead.");
    expect(gsi.renderButton).not.toHaveBeenCalled();
  });

  it("reports rather than renders into a container that is no longer in the document", async () => {
    const gsi = stubGsi({ skipped: true });
    const { ready } = await loadModule();
    const mod = await import("./google-signin");
    const detached = mod.requestGoogleCredential("client-id", { isConnected: false });
    await expect(detached).rejects.toThrow("did not offer a sign-in");
    // The primer call had no container either; its rejection is awaited too.
    await expect(ready).rejects.toThrow("did not offer a sign-in");
    expect(gsi.renderButton).not.toHaveBeenCalled();
  });
});
describe("googleClientId", () => {
  it("returns the deployment's client id from /api/config", async () => {
    stubGsi({});
    globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ googleClientId: "cid-1" }) }));
    const { mod } = await loadModule();
    await expect(mod.googleClientId()).resolves.toBe("cid-1");
  });

  it("returns null when the deployment configured nothing", async () => {
    stubGsi({});
    globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ googleClientId: null }) }));
    const { mod } = await loadModule();
    await expect(mod.googleClientId()).resolves.toBe(null);
  });

  it("returns null when /api/config does not answer", async () => {
    stubGsi({});
    globalThis.fetch = vi.fn(async () => ({ ok: false, json: async () => ({}) }));
    const { mod } = await loadModule();
    await expect(mod.googleClientId()).resolves.toBe(null);
  });
});
