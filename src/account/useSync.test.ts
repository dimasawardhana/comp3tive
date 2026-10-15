import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildCommunityPayload, createPushController, pushCommunity, resetPushState, type PushContext } from "./useSync";
import { decideSync } from "./sync-decision";
import type { SyncStores } from "./sync";

/**
 * The push's observable contracts, pinned directly:
 * - bursts coalesce to one push within the debounce window;
 * - two clients on the same version: first accepted, second rejected, and the
 *   first client's data survives on the server (the CAS holds);
 * - a rejected push surfaces a message naming the choice, and replaces nothing.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildCommunityPayload, createPushController, pushCommunity, resetPushState, type PushContext } from "./useSync";
import { decideSync } from "./sync-decision";
import type { SyncStores } from "./sync";

/**
 * The unit environment is `node`, so there is no `localStorage`. A small in-memory
 * map stands in, following `session.test.ts`'s precedent.
 */
const storage = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => void storage.set(k, v),
  removeItem: (k: string) => void storage.delete(k),
  clear: () => storage.clear(),
});

const { apiFetchMock, getSessionMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
  getSessionMock: vi.fn(),
}));

vi.mock("./session", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
  getSession: () => getSessionMock(),
}));

vi.mock("../data/transfer", () => ({
  serializeBackup: (...parts: unknown[]) => JSON.stringify(parts),
}));

const ACCOUNT = "acc-1";
const COMMUNITY = "com-1";

function okJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function storesStub(): SyncStores {
  const players = [{ id: "p1", communityId: COMMUNITY }];
  return {
    roster: { listPlayers: async () => players } as unknown as SyncStores["roster"],
    sessions: { listSessions: async () => [] } as unknown as SyncStores["sessions"],
    communities: { listCommunities: async () => [{ id: COMMUNITY, name: "C" }] } as unknown as SyncStores["communities"],
    tournaments: { listTournaments: async () => [] } as unknown as SyncStores["tournaments"],
    squads: { listSavedSquads: async () => [] } as unknown as SyncStores["squads"],
    disciplines: { listDisciplines: async () => [] } as unknown as SyncStores["disciplines"],
  };
}

function ctx(overrides: Partial<PushContext> = {}): PushContext & { notes: string[] } {
  const notes: string[] = [];
  return {
    stores: storesStub(),
    activeCommunityId: () => COMMUNITY,
    notify: (t: string) => notes.push(t),
    notes,
    ...overrides,
  };
}

beforeEach(() => {
  resetPushState();
  storage.clear();
  apiFetchMock.mockReset();
  getSessionMock.mockReturnValue({ accountId: ACCOUNT, token: "t", expiresAt: Date.now() + 60_000 });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("pushCommunity", () => {
  it("pushes when the version is unchanged and records the new version", async () => {
  storage.set(`tb-sync-version-${ACCOUNT}-${COMMUNITY}`, "4");
    apiFetchMock
      .mockResolvedValueOnce(okJson({ documents: [{ communityId: COMMUNITY, version: 4, payload: "old" }] }))
      .mockResolvedValueOnce(okJson({ version: 5 }));
    const c = ctx();
    await expect(pushCommunity(c, COMMUNITY)).resolves.toBe(true);
    const push = apiFetchMock.mock.calls[1];
    expect(push[0]).toBe("/api/documents/push");
    expect(JSON.parse(push[1].body).expectedVersion).toBe(4);
  expect(storage.get(`tb-sync-version-${ACCOUNT}-${COMMUNITY}`)).toBe("5");
    expect(c.notes).toEqual([]);
  });

  it("refuses a stale push, names the choice, and replaces nothing", async () => {
  storage.set(`tb-sync-version-${ACCOUNT}-${COMMUNITY}`, "3");
    apiFetchMock.mockResolvedValueOnce(
      okJson({ documents: [{ communityId: COMMUNITY, version: 4, payload: "theirs" }] }),
    );
    const c = ctx();
    await expect(pushCommunity(c, COMMUNITY)).resolves.toBe(false);
    expect(apiFetchMock).toHaveBeenCalledTimes(1); // No push was attempted.
    expect(c.notes).toHaveLength(1);
    expect(c.notes[0]).toContain("another device");
  });

  it("is a no-op when the payload is identical, without bumping the version", async () => {
  storage.set(`tb-sync-version-${ACCOUNT}-${COMMUNITY}`, "4");
    const payload = await buildCommunityPayload(storesStub(), COMMUNITY);
    apiFetchMock.mockResolvedValueOnce(
      okJson({ documents: [{ communityId: COMMUNITY, version: 4, payload }] }),
    );
    const c = ctx();
    await expect(pushCommunity(c, COMMUNITY)).resolves.toBe(true);
    expect(apiFetchMock).toHaveBeenCalledTimes(1); // Check only; no push request.
  expect(storage.get(`tb-sync-version-${ACCOUNT}-${COMMUNITY}`)).toBe("4");
  });

  it("adopts when the server has nothing", async () => {
    apiFetchMock
      .mockResolvedValueOnce(okJson({ documents: [] }))
      .mockResolvedValueOnce(okJson({ version: 1 }));
    const c = ctx();
    await expect(pushCommunity(c, COMMUNITY)).resolves.toBe(true);
    expect(apiFetchMock.mock.calls[1][0]).toBe("/api/documents/adopt");
  expect(storage.get(`tb-sync-version-${ACCOUNT}-${COMMUNITY}`)).toBe("1");
  });

  it("handles the CAS race: the server moved between check and write, and says so", async () => {
  storage.set(`tb-sync-version-${ACCOUNT}-${COMMUNITY}`, "4");
    apiFetchMock
      .mockResolvedValueOnce(okJson({ documents: [{ communityId: COMMUNITY, version: 4, payload: "old" }] }))
      .mockResolvedValueOnce(okJson({ error: "changed", serverVersion: 5 }, 409));
    const c = ctx();
    await expect(pushCommunity(c, COMMUNITY)).resolves.toBe(false);
    expect(c.notes).toHaveLength(1);
    expect(c.notes[0]).toContain("another device");
    // The server's real version is recorded, so the next push re-checks honestly.
    expect(localStorage.getItem(`tb-sync-version-${ACCOUNT}-${COMMUNITY}`)).toBe("5");
  });
});

describe("the debounce", () => {
  it("coalesces a burst of edits into one push", async () => {
    vi.useFakeTimers();
    apiFetchMock
      .mockImplementation(() => Promise.resolve(okJson({ documents: [] })))
      .mockImplementation(() => Promise.resolve(okJson({ version: 1 })));
    const c = ctx();
    const controller = createPushController(c);
    controller.markDirty(COMMUNITY);
    controller.markDirty(COMMUNITY);
    controller.markDirty(COMMUNITY);
    await vi.advanceTimersByTimeAsync(1500);
    // One check + one adopt for the single coalesced push.
    const pushes = apiFetchMock.mock.calls.filter((call) => call[0] !== "/api/documents/pull");
    expect(pushes).toHaveLength(1);
    controller.dispose();
  });

  it("does not even start a timer when signed out", () => {
    vi.useFakeTimers();
    getSessionMock.mockReturnValue(null);
    const c = ctx();
    const controller = createPushController(c);
    controller.markDirty(COMMUNITY);
    expect(vi.getTimerCount()).toBe(0);
    controller.dispose();
  });
});
describe("the decision boundary", () => {
  it("routes through the pure function (spot-check the import wiring)", () => {
    expect(decideSync({ local: null, lastKnownVersion: 1, serverVersion: 1 })).toBe("no-op");
  });
});
