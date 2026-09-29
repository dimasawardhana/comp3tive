import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  decideDurability,
  probePersistence,
  readDurabilityPrefs,
  useDurability,
  type Durability,
  type DurabilityFacts,
  type StorageProbe,
} from "./useDurability";

/** A day, so the cadence assertions read as policy rather than as arithmetic. */
const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 8, 29);

const STORED_EXPORT = "tb-last-export";
const STORED_DISMISSAL = "tb-export-nudge-dismissed";

/**
 * The node test environment has no DOM and no jsdom, so the hook's shape is
 * proven by a static render. Two consequences, and both matter:
 *
 *  - `renderToStaticMarkup` does not run effects, so every value below is what
 *    the hook holds *before* any browser has answered. That is exactly the state
 *    a consumer must not mistake for bad news, so it is worth pinning.
 *  - `shouldNudge === true` is unreachable this way: it needs `persisted === false`,
 *    and nothing can produce that without an effect. The browser conversation is
 *    therefore tested at its own seam, `probePersistence`, and the decision at
 *    `decideDurability`.
 */
let latest: Durability | null = null;

function Probe({ playerCount }: { playerCount: number }) {
  const d = useDurability({ playerCount });
  latest = d;
  return createElement("span", {
    "data-persisted": String(d.persisted),
    "data-granted": String(d.granted),
    "data-last-export": String(d.lastExportAt),
    "data-should-nudge": String(d.shouldNudge),
  });
}

/** The hook's return from the last render, for the two callbacks — whose effects land in storage. */
function rendered(): Durability {
  if (latest === null) throw new Error("the probe has not rendered");
  return latest;
}

/** A `localStorage` stand-in. In node there is none, and a blocked one must not throw. */
function seedStorage(seed: Record<string, string> = {}): Record<string, string> {
  const store: Record<string, string> = { ...seed };
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
  });
  return store;
}

/** A browser with no Storage API at all — the case that must degrade to "unknown". */
function noStorage(): void {
  vi.stubGlobal("navigator", {});
}

function facts(over: Partial<DurabilityFacts> = {}): DurabilityFacts {
  return { persisted: false, granted: false, playerCount: 6, lastExportAt: null, dismissed: null, now: NOW, ...over };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  latest = null;
});

describe("useDurability through a static render", () => {
  it("reports unknown persistence when the browser has no storage API", () => {
    noStorage();
    expect((navigator as unknown as { storage?: unknown }).storage).toBeUndefined();
    const html = renderToStaticMarkup(createElement(Probe, { playerCount: 6 }));
    // Effects do not run in a static render, so persistence is unknown here, not refused.
    expect(html).toContain('data-persisted="null"');
  });

  it("never touches the storage API while rendering, so a locked-down browser still renders", () => {
    // A browser may throw merely on reading `navigator.storage`, and the render
    // path must survive that: reading it is an effect's job, not the shell's.
    vi.stubGlobal("navigator", {
      get storage(): never {
        throw new Error("storage access can throw");
      },
    });
    expect(() => renderToStaticMarkup(createElement(Probe, { playerCount: 6 }))).not.toThrow();
  });

  it("never conflates unknown with refused", () => {
    noStorage();
    const html = renderToStaticMarkup(createElement(Probe, { playerCount: 6 }));
    // `null` is "this browser did not answer"; only `false` is a refusal.
    expect(html).toContain('data-persisted="null"');
    expect(html).not.toContain('data-persisted="false"');
    expect(html).toContain('data-granted="null"');
    expect(html).not.toContain('data-granted="false"');
  });

  it("never nudges while persistence is unknown, so an unanswered browser is not nagged", () => {
    noStorage();
    expect(renderToStaticMarkup(createElement(Probe, { playerCount: 6 }))).toContain('data-should-nudge="false"');
  });

  it("never nudges on a small roster, because there is nothing worth losing", () => {
    noStorage();
    expect(renderToStaticMarkup(createElement(Probe, { playerCount: 2 }))).toContain('data-should-nudge="false"');
  });

  it("has no last export before one has happened", () => {
    noStorage();
    expect(renderToStaticMarkup(createElement(Probe, { playerCount: 6 }))).toContain('data-last-export="null"');
  });

  it("reads a stored export back, so a returning organizer is not asked again on sight", () => {
    noStorage();
    seedStorage({ [STORED_EXPORT]: String(NOW - DAY) });
    expect(renderToStaticMarkup(createElement(Probe, { playerCount: 6 }))).toContain(`data-last-export="${NOW - DAY}"`);
  });

  it("refuses a stored export that is not a number — a string is not a date", () => {
    noStorage();
    seedStorage({ [STORED_EXPORT]: "last tuesday" });
    expect(renderToStaticMarkup(createElement(Probe, { playerCount: 6 }))).toContain('data-last-export="null"');
  });
});

describe("what is stored", () => {
  it("a dismissal records when and at what size, because the scope is the whole design", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    seedStorage();
    renderToStaticMarkup(createElement(Probe, { playerCount: 7 }));
    rendered().dismissNudge();
    // A bare `"1"` cannot say which roster it was about, so it can only ever be permanent.
    expect(JSON.parse(String(localStorage.getItem(STORED_DISMISSAL)))).toEqual({ at: NOW, playerCount: 7 });
  });

  it("an export stamps the time and lifts the dismissal, because acting outranks closing", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const store = seedStorage({ [STORED_DISMISSAL]: JSON.stringify({ at: NOW - DAY, playerCount: 7 }) });
    renderToStaticMarkup(createElement(Probe, { playerCount: 7 }));
    rendered().recordExport();
    expect(store[STORED_EXPORT]).toBe(String(NOW));
    expect(store[STORED_DISMISSAL]).toBeUndefined();
  });

  it("reads back a dismissal this app wrote", () => {
    seedStorage({ [STORED_DISMISSAL]: JSON.stringify({ at: NOW - DAY, playerCount: 7 }) });
    expect(readDurabilityPrefs().dismissed).toEqual({ at: NOW - DAY, playerCount: 7 });
  });

  it("a dismissal it cannot read is not a dismissal — it must never mean 'never again'", () => {
    // The plan's shape, a hand-edited value and a truncated write all land here.
    for (const raw of ["1", "{}", '{"at":"now","playerCount":7}', "null", '{"at":1e999,"playerCount":7}']) {
      seedStorage({ [STORED_DISMISSAL]: raw });
      expect(readDurabilityPrefs().dismissed).toBeNull();
    }
  });

  it("a blocked store costs the preference, not the session", () => {
    const blocked = () => {
      throw new Error("blocked");
    };
    vi.stubGlobal("localStorage", { getItem: blocked, setItem: blocked, removeItem: blocked });
    expect(readDurabilityPrefs()).toEqual({ lastExportAt: null, dismissed: null });
    renderToStaticMarkup(createElement(Probe, { playerCount: 6 }));
    expect(() => {
      rendered().dismissNudge();
      rendered().recordExport();
    }).not.toThrow();
  });
});

describe("probePersistence — what the browser does, and when the app asks", () => {
  it("does not ask a browser to persist before there is a roster worth keeping", async () => {
    // Firefox puts a permission popup in front of the user the first time a site asks.
    // At two players there is nothing to keep, so there is nothing to interrupt them for.
    const persist = vi.fn(async () => true);
    const storage: StorageProbe = { persisted: async () => false, persist };
    const verdict = await probePersistence(storage, false);
    expect(persist).not.toHaveBeenCalled();
    expect(verdict).toEqual({ persisted: false, granted: null });
  });

  it("never asks an origin that is already persistent", async () => {
    const persist = vi.fn(async () => true);
    const storage: StorageProbe = { persisted: async () => true, persist };
    const verdict = await probePersistence(storage, true);
    expect(persist).not.toHaveBeenCalled();
    // Installed apps are granted this without anyone asking, so `granted` is null, not true.
    expect(verdict).toEqual({ persisted: true, granted: null });
  });

  it("asks once there is a roster, and reports the grant and the bucket behind it", async () => {
    let bucketIsPersistent = false;
    const persist = vi.fn(async () => {
      bucketIsPersistent = true;
      return true;
    });
    const storage: StorageProbe = { persisted: async () => bucketIsPersistent, persist };
    const verdict = await probePersistence(storage, true);
    expect(persist).toHaveBeenCalledTimes(1);
    expect(verdict).toEqual({ persisted: true, granted: true });
  });

  it("reports the bucket, not the grant, when the two stop agreeing", async () => {
    // A grant can outlive the grant: the permission stays granted and the user
    // clears site data, so the bucket is still best-effort. Copy that reads the
    // grant here is the Phase B defect, one level down.
    const storage: StorageProbe = { persisted: async () => false, persist: async () => true };
    await expect(probePersistence(storage, true)).resolves.toEqual({ persisted: false, granted: true });
  });

  it("falls back to the grant when the browser has no read API at all", async () => {
    const storage: StorageProbe = { persist: async () => true };
    await expect(probePersistence(storage, true)).resolves.toEqual({ persisted: true, granted: true });
  });

  it("a refusal is a definite no on both counts, and that is what allows the nudge", async () => {
    const storage: StorageProbe = { persisted: async () => false, persist: async () => false };
    const verdict = await probePersistence(storage, true);
    expect(verdict).toEqual({ persisted: false, granted: false });
    expect(decideDurability(facts(verdict)).shouldNudge).toBe(true);
  });

  it("a request that cannot be answered is a refusal, not a grant", async () => {
    // persist() rejects when the origin cannot get a storage shelf at all.
    const storage: StorageProbe = {
      persisted: async () => false,
      persist: () => Promise.reject(new Error("no shelf")),
    };
    await expect(probePersistence(storage, true)).resolves.toEqual({ persisted: false, granted: false });
  });

  it("a rejected read is unknown, and an unknown never raises the nudge", async () => {
    const persist = vi.fn(async () => true);
    const storage: StorageProbe = { persisted: () => Promise.reject(new Error("no answer")), persist };
    const verdict = await probePersistence(storage, false);
    // A throw is not an answer. Nothing was read, nothing was asked, so both
    // fields stay unknown — and unknown must not read as "at risk".
    expect(verdict).toEqual({ persisted: null, granted: null });
    expect(persist).not.toHaveBeenCalled();
    expect(decideDurability(facts(verdict)).shouldNudge).toBe(false);
  });

  it("a read that throws is still answered by the grant, because the spec says so", async () => {
    // The spec resolves `persist()` to true only when permission was granted *and*
    // the bucket is persistent, so a grant is not a second opinion being trusted
    // over the first — it is the same fact, spelled with fewer words.
    const storage: StorageProbe = { persisted: () => Promise.reject(new Error("no answer")), persist: async () => true };
    await expect(probePersistence(storage, true)).resolves.toEqual({ persisted: true, granted: true });
  });

  it("a browser that can read but not be asked reports the refusal it did give", async () => {
    const storage: StorageProbe = { persisted: async () => false };
    const verdict = await probePersistence(storage, true);
    expect(verdict).toEqual({ persisted: false, granted: null });
    expect(decideDurability(facts(verdict)).shouldNudge).toBe(true);
  });
});

describe("decideDurability — the truth table behind shouldNudge", () => {
  it("nudges only when all four hold: refused, big enough, stale, and not dismissed", () => {
    expect(decideDurability(facts()).shouldNudge).toBe(true);
    expect(decideDurability(facts({ persisted: true })).shouldNudge).toBe(false);
    expect(decideDurability(facts({ persisted: null })).shouldNudge).toBe(false);
    expect(decideDurability(facts({ playerCount: 4 })).shouldNudge).toBe(false);
    expect(decideDurability(facts({ lastExportAt: NOW - DAY })).shouldNudge).toBe(false);
    expect(decideDurability(facts({ dismissed: { at: NOW - DAY, playerCount: 6 } })).shouldNudge).toBe(false);
  });

  it("the floor is five players, not four and not six", () => {
    expect(decideDurability(facts({ playerCount: 4 })).shouldNudge).toBe(false);
    expect(decideDurability(facts({ playerCount: 5 })).shouldNudge).toBe(true);
  });

  it("the cadence is a fortnight: not a second early, and asked again after", () => {
    const fortnight = NOW - 14 * DAY;
    expect(decideDurability(facts({ lastExportAt: fortnight })).shouldNudge).toBe(false);
    expect(decideDurability(facts({ lastExportAt: fortnight - 1 })).shouldNudge).toBe(true);
  });

  it("a dismissal covers the roster it was given for", () => {
    const dismissal = { at: NOW - 20 * DAY, playerCount: 6 };
    expect(decideDurability(facts({ dismissed: dismissal })).shouldNudge).toBe(false);
    // Same dismissal, fewer players — still covered.
    expect(decideDurability(facts({ dismissed: dismissal, playerCount: 5 })).shouldNudge).toBe(false);
  });

  it("a dismissal is a snooze, not a silence", () => {
    // Past the month the prompt is allowed back, even though the roster never grew.
    expect(decideDurability(facts({ dismissed: { at: NOW - 31 * DAY, playerCount: 6 } })).shouldNudge).toBe(true);
  });

  it("a dismissal stops covering once the roster grows by another batch", () => {
    // Dismissed at six with five more people arriving: inside the month, so only
    // the size clause can lift it, and not one player short of that.
    const dismissed = { at: NOW - DAY, playerCount: 6 };
    expect(decideDurability(facts({ dismissed, playerCount: 10 })).shouldNudge).toBe(false);
    expect(decideDurability(facts({ dismissed, playerCount: 11 })).shouldNudge).toBe(true);
  });

  it("a grant is reported but never becomes a nudge on its own", () => {
    // `granted: true, persisted: null` — the app was granted and the bucket was
    // never measured. There is nothing to warn about, so nothing is warned about.
    expect(decideDurability(facts({ granted: true, persisted: null }))).toEqual({
      persisted: null,
      granted: true,
      shouldNudge: false,
    });
  });
});
