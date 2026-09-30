import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { Script, createContext } from "node:vm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
// `vite.config.ts` exports `serviceWorkerBuild` and `substitute` for this file
// and for nothing else. A second plugin instance bound to the real `dist` is
// therefore expected here, not a surprise: the tests never call the default.
import { serviceWorkerBuild, substitute } from "../vite.config";
import { registerServiceWorker, SERVICE_WORKER_URL, STALE_BUILD_MESSAGE } from "./registerServiceWorker";

/**
 * The service worker, exercised without a browser.
 *
 * There is no ServiceWorker API in a node vitest environment, so the worker is run
 * the way a browser runs it: the emitted script is compiled and executed in a
 * fresh vm context whose `self`, `caches` and `fetch` are the only globals it is
 * given, and the install, activate and fetch events are dispatched by hand. That
 * covers the routing, the sequencing, the cache naming and the pass-through rules
 * against the real bytes of the file that ships — not a re-description of them.
 *
 * What it does NOT cover, and what no test in this file claims to: real Cache
 * Storage semantics, real HTTP, the browser's byte-comparison update check, the
 * `Cache-Control` rules in public/_headers, and whether an installed launcher
 * really does open `/app/` with no network. Those are observed in a browser, by
 * Task 12.
 */
const root = new URL("../", import.meta.url);
const read = (relative: string) => readFileSync(new URL(relative, root), "utf8");
const ORIGIN = "https://comp3tive.test";
const tmp = mkdtempSync(join(tmpdir(), "comp3tive-sw-"));
let built = 0;

interface FakeResponse {
  readonly ok: boolean;
  readonly status: number;
  readonly body: string;
  clone(): FakeResponse;
}
const respond = (status: number, body = `body ${status}`): FakeResponse => ({
  ok: status >= 200 && status < 300,
  status,
  body,
  clone: () => respond(status, body),
});

/** The network the harness is standing in for. Re-pointed by every scenario. */
const net: { fetch: (url: string) => Promise<FakeResponse> } = { fetch: async () => respond(200) };

/** A `caches` whose `match` searches every store in creation order, as the real one does. */
class FakeCaches {
  readonly stores = new Map<string, Map<string, FakeResponse>>();
  /** Set to make the next `put` reject, as a full disk or a 206 would. */
  refuseNextPut = false;
  private store = (name: string) => {
    const found = this.stores.get(name) ?? new Map<string, FakeResponse>();
    this.stores.set(name, found);
    return found;
  };
  readonly urls = (name: string) => [...this.store(name).keys()];
  readonly open = async (name: string) => ({
    // All-or-nothing, exactly like the real `addAll`: one bad response rejects
    // the whole call and nothing is written.
    addAll: async (urls: string[]) => {
      const answers = await Promise.all(urls.map((url) => net.fetch(new URL(url, ORIGIN).href)));
      if (answers.some((answer) => !answer.ok)) throw new Error("addAll: a response was not ok");
      urls.forEach((url, index) => this.store(name).set(new URL(url, ORIGIN).href, answers[index]!));
    },
    put: async (key: { url: string }, response: FakeResponse) => {
      if (this.refuseNextPut) {
        this.refuseNextPut = false;
        throw new Error("QuotaExceededError: the cache is full");
      }
      this.store(name).set(key.url, response);
    },
    // Scoped to this one cache, which is the point: the real `Cache.match` never
    // looks at another cache, and the global `caches.match` always does.
    match: async (key: string | { url: string }) => {
      const url = typeof key === "string" ? new URL(key, ORIGIN).href : key.url;
      return this.store(name).get(url);
    },
  });
  readonly keys = async () => [...this.stores.keys()];
  readonly match = async (key: string | { url: string }) => {
    const url = typeof key === "string" ? new URL(key, ORIGIN).href : key.url;
    for (const store of this.stores.values()) {
      const hit = store.get(url);
      if (hit) return hit;
    }
    return undefined;
  };
  readonly delete = async (name: string) => this.stores.delete(name);
}

interface FakeRequest {
  url: string;
  method: string;
  mode: string;
  headers: Headers;
}
const request = (path: string, over: { method?: string; mode?: string; origin?: string; range?: string } = {}): FakeRequest => ({
  url: new URL(path, over.origin ?? ORIGIN).href,
  method: over.method ?? "GET",
  mode: over.mode ?? "no-cors",
  headers: new Headers(over.range ? { range: over.range } : {}),
});

interface Worker {
  readonly caches: FakeCaches;
  readonly skipWaiting: () => number;
  readonly claimed: () => number;
  /** Everything the worker has posted to an open page, in order. */
  readonly messages: string[];
  /** Resolves with whatever `respondWith` was given, or undefined for a pass-through. */
  dispatch(type: "install" | "activate" | "fetch", key?: FakeRequest): Promise<FakeResponse | undefined>;
}

/**
 * `storage` is shared so a second generation can be started over the first one's
 * cache — which is the only state in which the purge, and the stale tab it
 * strands, exist at all. A fresh `FakeCaches` per worker could never see it.
 */
function startWorker(source: string, storage = new FakeCaches()): Worker {
  const caches = storage;
  const listeners = new Map<string, (event: unknown) => void>();
  const calls = { skipWaiting: 0, claim: 0 };
  const messages: string[] = [];
  const context = {
    self: {
      addEventListener: (type: string, handler: (event: unknown) => void) => void listeners.set(type, handler),
      skipWaiting: async () => void (calls.skipWaiting += 1),
      clients: {
        claim: async () => void (calls.claim += 1),
        // includeUncontrolled is the point: the page that most needs to hear
        // about a dead build is one the activation has just handed to the network.
        matchAll: async () => [{ postMessage: (data: string) => void messages.push(data) }],
      },
      location: { origin: ORIGIN },
    },
    caches,
    URL,
    fetch: (key: FakeRequest) => net.fetch(key.url),
  };
  createContext(context);
  new Script(source, { filename: "sw.js" }).runInContext(context);

  return {
    caches,
    messages,
    skipWaiting: () => calls.skipWaiting,
    claimed: () => calls.claim,
    async dispatch(type, key) {
      const handler = listeners.get(type);
      if (!handler) throw new Error(`the worker registered no ${type} listener`);
      const waits: Promise<unknown>[] = [];
      let answered: Promise<FakeResponse> | undefined;

      handler({
        request: key,
        waitUntil: (work: Promise<unknown>) => void waits.push(Promise.resolve(work)),
        respondWith: (answer: Promise<FakeResponse>) => void (answered = Promise.resolve(answer)),
      });
      await Promise.all(waits);
      return answered ? await answered : undefined;
    },
  };
}

const ASSET_FIXTURES = [
  ["app-DkiMwHQd.js", "the app entry"],
  ["landing-B9taTx0Y.css", "the landing styles"],
  ["sample-data-DhS_gulj.js", "a chunk reached behind an await import()"],
] as const;
const STATIC_FIXTURES = [
  ["404.html", "<!doctype html><title>404</title>"],
  ["manifest.webmanifest", '{"name":"comp3tive","start_url":"/app/","scope":"/"}'],
  ["fonts/outfit-latin-6c18d579.woff2", "font bytes"],
  ["fonts/outfit-OFL.txt", "a licence, which is not a font"],
  ["icons/icon-192.png", "png 192"],
  ["icons/icon-512.png", "png 512"],
  ["icons/maskable-512.png", "png maskable"],
] as const;
const DOCUMENT_FIXTURES = [
  ["index.html", "<!doctype html><title>landing</title>"],
  ["app/index.html", "<!doctype html><title>app</title>"],
] as const;

/** A `dist` shaped like the real one, so the plugin's own inputs are the real ones. */
function syntheticDist(realPublic = false): string {
  const dir = join(tmp, `dist-${built++}`);
  const write = (file: string, body: string) => {
    mkdirSync(dirname(join(dir, file)), { recursive: true });
    writeFileSync(join(dir, file), body);
  };
  mkdirSync(join(dir, "assets"), { recursive: true });
  if (realPublic) cpSync(new URL("public/", root), dir, { recursive: true });
  write("sw.js", read("public/sw.js"));
  for (const [file, body] of STATIC_FIXTURES) if (!realPublic) write(file, body);
  for (const [file, body] of DOCUMENT_FIXTURES) write(file, body);
  for (const [name, body] of ASSET_FIXTURES) writeFileSync(join(dir, "assets", name), body);
  return dir;
}

function build(dir: string): string {
  serviceWorkerBuild(dir).closeBundle();
  return readFileSync(join(dir, "sw.js"), "utf8");
}

const EMITTED = build(syntheticDist());
const versionOf = (source: string) => /const VERSION = "([0-9a-f]{12})";/.exec(source)![1]!;
/** The cache name the shipped worker opens, read out of the file it ships in. */

/** Everything a built worker will hold, as absolute URLs, read off its own source. */
const precacheOf = (source: string) =>
  [
    ...(JSON.parse(/const PRECACHE_ASSETS = (\[[^\]]*\]);/.exec(source)![1]!) as string[]),
    ...(JSON.parse(/const DOCUMENTS = (\[[^\]]*\]);/.exec(source)![1]!) as string[]),
  ].map((url) => new URL(url, ORIGIN).href);
const CACHE_NAME = `comp3tive-${versionOf(EMITTED)}`;

/** Install over a working network: the state every user is in once, online. */
async function installed(): Promise<Worker> {
  net.fetch = async () => respond(200);
  const worker = startWorker(EMITTED);
  await worker.dispatch("install");
  return worker;
}
const offline = () => {
  net.fetch = async () => {
    throw new Error("offline");
  };
};

/**
 * A cache write is deliberately not awaited by the page, so a test that asserts
 * one happened has to let the microtask and the promise it opened run first.
 */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeAll(() => vi.spyOn(console, "log").mockImplementation(() => undefined));
afterAll(() => {
  vi.restoreAllMocks();
  rmSync(tmp, { recursive: true, force: true });
});

describe("the build that fills the worker in", () => {
  it("leaves no placeholder and emits a cache named for the build", () => {
    // Fail: a token surviving into dist, or a cache name without a build hash —
    // and every deploy then reuses one cache, so a user is served two builds.
    expect(EMITTED).not.toMatch(/__BUILD_VERSION__|__PRECACHE_ASSETS__|__PRECACHE_DOCUMENTS__/);
    // The emitted file is what Workers parses, so it has to be valid JavaScript.
    expect(() => new Script(EMITTED)).not.toThrow();
    expect(CACHE_NAME).toMatch(/^comp3tive-[0-9a-f]{12}$/);
  });

  it("precaches the hashed assets, the woff2 fonts and the icons, and not the licence texts", () => {
    // Fail: a hand-maintained list, a drifted hashed name, or a filter that let
    // the OFL texts in — they are not fonts, and they carry their own rule.
    expect(EMITTED).toContain(
      JSON.stringify([
        "/assets/app-DkiMwHQd.js",
        "/assets/landing-B9taTx0Y.css",
        "/assets/sample-data-DhS_gulj.js",
        "/fonts/outfit-latin-6c18d579.woff2",
        "/icons/icon-192.png",
        "/icons/icon-512.png",
        "/icons/maskable-512.png",
      ]),
    );
    expect(EMITTED).not.toContain("OFL.txt");
  });

  it("precaches `/app/`, which is the one request the installed icon makes", () => {
    // `start_url` is `/app/` and `scope` is `/`, so `/` and `/app/` are two
    // different documents and the launcher asks for the second. Fail: caching
    // only the file name, and an installed app opens offline to the 404 page.
    const documents = JSON.parse(/const DOCUMENTS = (\[[^\]]*\]);/.exec(EMITTED)![1]!) as string[];
    expect(documents).toEqual(["/", "/index.html", "/app/", "/app/index.html", "/404.html", "/manifest.webmanifest"]);
  });

  it("moves the version when a document's bytes change, not only an asset's", () => {
    // Fail: hashing the precache assets alone. The document is precached under a
    // stable URL, so a copy-only deploy would produce an identical version, the
    // worker would keep opening the cache it already has, and the new `/app/`
    // would sit on the server being ignored. "The document changed but the cache
    // did not" is the bug the version exists to prevent.
    const edited = syntheticDist();
    writeFileSync(join(edited, "app/index.html"), "<!doctype html><title>a different app</title>");
    expect(build(edited)).not.toBe(EMITTED);
  });

  it("gives an identical build the same version, and a changed file a different one", () => {
    // Fail: hashing anything that varies between two identical builds, or not
    // varying when a precached byte changes. `/icons/*.png` and the manifest keep
    // their names across a redesign, so the names alone cannot carry this.
    expect(build(syntheticDist())).toBe(EMITTED);
    const redrawn = syntheticDist();
    writeFileSync(join(redrawn, "icons/icon-192.png"), "a redrawn icon, same filename");
    expect(build(redrawn)).not.toBe(EMITTED);
  });

  it("refuses to build a worker that has no placeholder to fill", () => {
    // Fail: public/sw.js edited so a token is gone. The build would emit a
    // worker still reading `undefined` as its version.
    const dir = syntheticDist();
    writeFileSync(join(dir, "sw.js"), read("public/sw.js").replaceAll("__BUILD_VERSION__", '"hand-written"'));
    expect(() => build(dir)).toThrow(/no __BUILD_VERSION__ placeholder/);
  });

  it("proves a placeholder did not survive the value it was given", () => {
    // Fail: a precache list or a version containing its own token, which ships
    // a worker whose source still names an unbuilt constant.
    expect(() => substitute("const A = __TOK__;", "__TOK__", "x__TOK__y")).toThrow(/survived/);
    expect(() => substitute("const A = 1;", "__TOK__", "x")).toThrow(/no __TOK__ placeholder/);
  });

  it("fails the build when the worker was not copied into dist", () => {
    // Fail: publicDir no longer copying sw.js. Silently, the deploy ships no
    // worker and the old one goes on serving an old build.
    const dir = syntheticDist();
    rmSync(join(dir, "sw.js"));
    expect(() => build(dir)).toThrow(/dist\/sw\.js is missing/);
  });

  it("fails the build when no hashed assets were emitted", () => {
    // Fail: a config change that stops emitting /assets, which would precache a
    // shell that can load nothing.
    const dir = syntheticDist();
    rmSync(join(dir, "assets"), { recursive: true });
    expect(() => build(dir)).toThrow(/no hashed assets/);
  });

  it("fails the build when a document it precaches has no file behind it", () => {
    // Fail: a removed or renamed document. The alternative is a worker that
    // installs nothing on any device, because addAll is all-or-nothing.
    const dir = syntheticDist();
    rmSync(join(dir, "404.html"));
    expect(() => build(dir)).toThrow(/dist\/404\.html is missing.*\/404\.html/s);
  });
});

describe("what the worker does when it installs", () => {
  it("caches every document and every precached URL, then takes over", async () => {
    // Fail: a document or an asset missing from the set — a roster chunk left out
    // here is an app that works online and is broken offline — or skipWaiting
    // moved out of install, which pins a returning user to the old build until
    // every tab is closed.
    const worker = await installed();
    expect(worker.caches.urls(CACHE_NAME)).toEqual(
      [
        "/",
        "/index.html",
        "/app/",
        "/app/index.html",
        "/404.html",
        "/manifest.webmanifest",
        "/assets/app-DkiMwHQd.js",
        "/assets/landing-B9taTx0Y.css",
        "/assets/sample-data-DhS_gulj.js",
        "/fonts/outfit-latin-6c18d579.woff2",
        "/icons/icon-192.png",
        "/icons/icon-512.png",
        "/icons/maskable-512.png",
      ].map((path) => new URL(path, ORIGIN).href),
    );
    expect(worker.skipWaiting()).toBe(1);
  });

  it("installs nothing at all when one URL is missing", async () => {
    // Fail: precaching item by item with a swallowed error, which produces a
    // worker that claims to be offline and is not.
    const worker = startWorker(EMITTED);
    net.fetch = async (url) => (url.endsWith("/app/") ? respond(404) : respond(200));
    await expect(worker.dispatch("install")).rejects.toThrow();
    expect(worker.caches.stores.size).toBe(0);
    expect(worker.skipWaiting()).toBe(0);
  });
});

describe("what the worker does when it activates", () => {
  it("deletes the previous build's caches and keeps its own", async () => {
    // Fail: a filter that keeps everything, or drops the wrong one, so a user
    // carries two builds' storage forever and a rollback cannot clear it.
    const worker = await installed();
    worker.caches.stores.set("comp3tive-000000000000", new Map());
    worker.caches.stores.set("comp3tive-aaaaaaaaaaaa", new Map());
    await worker.dispatch("activate");
    expect([...worker.caches.stores.keys()]).toEqual([CACHE_NAME]);
  });

  it("leaves a cache on this origin that is not ours alone", async () => {
    // Fail: deleting every key the browser holds for the origin, which is a
    // service worker reaching outside its own name.
    const worker = await installed();
    worker.caches.stores.set("someone-elses-cache", new Map());
    await worker.dispatch("activate");
    expect([...worker.caches.stores.keys()]).toEqual([CACHE_NAME, "someone-elses-cache"]);
  });

  it("does not claim the pages that are already open", async () => {
    // Fail: adding clients.claim(). A claimed tab on the old build that then
    // presses "Sample" is handed the new build's lazily imported chunk, and one
    // page ends up running two builds. Nothing in this repo would show that.
    const worker = await installed();
    await worker.dispatch("activate");
    expect(worker.claimed()).toBe(0);
  });
});

/**
 * The state that only exists across two worker generations sharing one Cache
 * Storage, which is the state the purge creates and the state a returning user's
 * stale tab is stranded in. Nothing above this line can see it: each worker in
 * isolation is a clean install.
 */
describe("what a tab left on the previous build experiences", () => {
  /**
   * Two generations over one storage, with only the second one deployed. The
   * `deployed` set is the server: anything not in it is a 404, which is exactly
   * what happens to a build's files when the next deploy replaces them.
   */
  async function twoGenerations() {
    const storage = new FakeCaches();
    const first = syntheticDist();
    const firstSource = build(first);
    const previousName = `comp3tive-${versionOf(firstSource)}`;

    // The second build changes the roster chunk, so it gets a new URL and the
    // first build's URL stops existing on the server. That is what a deploy does
    // to a hashed asset, and it is the case that strands an open tab.
    const second = syntheticDist();
    rmSync(join(second, "assets/sample-data-DhS_gulj.js"));
    writeFileSync(join(second, "assets/sample-data-Cx9new2.js"), "the roster chunk of the second build");
    const secondSource = build(second);
    const currentName = `comp3tive-${versionOf(secondSource)}`;
    expect(currentName).not.toBe(previousName);

    // The served body names who served it — "first"/"second" for what each build
    // installed, "network" for what the server returns afterwards — so "was this
    // read out of my own cache or somebody else's?" has an observable answer
    // rather than a plausible one.
    const deployed = new Set<string>(precacheOf(firstSource));
    let servedBy = "first";
    net.fetch = async (url) => (deployed.has(url) ? respond(200, `${servedBy} ${url}`) : respond(404, "gone"));
    const previous = startWorker(firstSource, storage);
    await previous.dispatch("install");
    await previous.dispatch("activate");
    const previouslyCached = previous.caches.urls(previousName);

    deployed.clear();
    for (const url of precacheOf(secondSource)) deployed.add(url);
    servedBy = "second";
    const current = startWorker(secondSource, storage);
    await current.dispatch("install");
    await current.dispatch("activate");
    servedBy = "network";
    return { storage, previous, previousName, currentName, previouslyCached };
  }

  it("serves its chunk before the deploy, then loses it and is told the build is gone", async () => {
    // The state the harness could not express before: two generations over one
    // storage. Before the deploy the chunk is a cache hit. After it the chunk is
    // gone from the server and the cache that held it has been purged, so the tab
    // gets a 404 — and the page is told to start again rather than sitting on a
    // dead build with nothing but a manual refresh.
    const { storage, previous, previousName, currentName, previouslyCached } = await twoGenerations();
    expect(previouslyCached).toContain(`${ORIGIN}/assets/sample-data-DhS_gulj.js`);
    expect(storage.stores.has(previousName)).toBe(false);
    expect([...storage.stores.keys()]).toEqual([currentName]);

    expect((await previous.dispatch("fetch", request("/assets/sample-data-DhS_gulj.js")))?.status).toBe(404);
    expect(previous.messages).toEqual([STALE_BUILD_MESSAGE]);
  });

  it("is never answered out of the current build's cache", async () => {
    // Fail: the global `caches.match`. A tab still being served by the previous
    // worker asks for a URL the current build has, and a global lookup finds the
    // current build's copy of it — so the old document is handed a module it was
    // never given. Scoped to its own cache, the read misses and the bytes come
    // from the network, which is the truth about where they came from.
    const { previous, currentName } = await twoGenerations();
    // It IS in the current build's cache, so a global lookup would find it...
    expect(previous.caches.stores.get(currentName)?.get(`${ORIGIN}/assets/sample-data-Cx9new2.js`)?.body).toMatch(
      /^second /,
    );
    // ...and this is what the tab actually gets.
    expect((await previous.dispatch("fetch", request("/assets/sample-data-Cx9new2.js")))?.body).toMatch(/^network /);
  });

  it("is never answered the current build's document while it is offline", async () => {
    // The same rule on the document path. The previous worker's cache has been
    // purged, so its offline fallback must come up empty and rethrow rather than
    // quietly serve the next build's HTML to a page that cannot run its assets.
    const { previous } = await twoGenerations();
    offline();
    await expect(previous.dispatch("fetch", request("/app/", { mode: "navigate" }))).rejects.toThrow();
  });

  it("says it once, so a deploy that keeps 404ing cannot become a reload loop", async () => {
    // Fail: the once-per-lifetime guard removed. A worker that posts on every
    // 404 reloads a page forever, and the user watches a spinner instead of a
    // tournament.
    const { previous } = await twoGenerations();
    const url = request("/assets/sample-data-DhS_gulj.js");
    await previous.dispatch("fetch", url);
    await previous.dispatch("fetch", url);
    await previous.dispatch("fetch", request("/assets/never-existed-9f2c.js"));
    expect(previous.messages).toEqual([STALE_BUILD_MESSAGE]);
  });
});

describe("what the fetch handler answers", () => {
  it("serves a precached asset without touching the network", async () => {
    // Fail: dropping /assets/ from the cache-first prefixes, which turns every
    // offline load of the app into a blank page.
    const worker = await installed();
    offline();
    expect((await worker.dispatch("fetch", request("/assets/app-DkiMwHQd.js")))?.body).toBe("body 200");
  });

  it("fetches an asset it has not seen, and never stores an error or a slice", async () => {
    // Fail: caching a non-2xx, which turns one bad deploy into a permanent one
    // under an asset URL; or caching a 206, which serves one reader's slice to
    // the next reader whole.
    const worker = await installed();
    net.fetch = async () => respond(200, "the new chunk");
    expect((await worker.dispatch("fetch", request("/assets/new-9f2c.js")))?.body).toBe("the new chunk");
    await settle();
    expect(worker.caches.urls(CACHE_NAME)).toContain(`${ORIGIN}/assets/new-9f2c.js`);

    net.fetch = async () => respond(500);
    expect((await worker.dispatch("fetch", request("/assets/broken-9f2c.js")))?.status).toBe(500);
    net.fetch = async () => respond(206, "bytes 0-99 of something");
    expect((await worker.dispatch("fetch", request("/assets/sliced-9f2c.js")))?.status).toBe(206);
    await settle();
    expect(worker.caches.urls(CACHE_NAME)).not.toContain(`${ORIGIN}/assets/broken-9f2c.js`);
    expect(worker.caches.urls(CACHE_NAME)).not.toContain(`${ORIGIN}/assets/sliced-9f2c.js`);
  });

  it("still answers the page when the cache refuses to store what it was given", async () => {
    // Fail: a floating, unguarded `cache.put`. `Cache.put` rejects on a full
    // disk, and a full disk is exactly the user who installed the app and has
    // every precached byte on their device — the one user this whole file exists
    // for. The rejection is caught here rather than left to the runner to notice,
    // because a run that merely happens not to fail is not a guard.
    const unhandled: unknown[] = [];
    const record = (reason: unknown) => void unhandled.push(reason);
    process.on("unhandledRejection", record);
    try {
      const worker = await installed();
      worker.caches.refuseNextPut = true;
      net.fetch = async () => respond(200, "the new chunk");
      expect((await worker.dispatch("fetch", request("/assets/quota-9f2c.js")))?.body).toBe("the new chunk");
      await settle();
      expect(unhandled).toEqual([]);
      expect(worker.caches.urls(CACHE_NAME)).not.toContain(`${ORIGIN}/assets/quota-9f2c.js`);
    } finally {
      process.off("unhandledRejection", record);
    }
  });

  it("prefers the network for a document, and stores what it gets", async () => {
    // Fail: cache-first for documents, which serves a document naming asset URLs
    // that no longer exist — a broken page until something purges the cache.
    const worker = await installed();
    net.fetch = async () => respond(200, "the new document");
    expect((await worker.dispatch("fetch", request("/app/", { mode: "navigate" })))?.body).toBe("the new document");
    await settle();
    expect(worker.caches.stores.get(CACHE_NAME)?.get(`${ORIGIN}/app/`)?.body).toBe("the new document");
  });

  it("falls back to the precached documents when the network is gone", async () => {
    // Fail: not precaching `/app/`, which is the request an installed app makes
    // and the reason a broken icon on a home screen is worse than no icon.
    const worker = await installed();
    offline();
    expect((await worker.dispatch("fetch", request("/app/", { mode: "navigate" })))?.body).toBe("body 200");
    expect((await worker.dispatch("fetch", request("/", { mode: "navigate" })))?.body).toBe("body 200");
    expect((await worker.dispatch("fetch", request("/app/index.html", { mode: "navigate" })))?.body).toBe("body 200");
  });

  it("answers a navigation it has never cached with the 404 page", async () => {
    // Fail: rethrowing, which shows a browser error instead of a page that says
    // what happened.
    const worker = await installed();
    offline();
    expect((await worker.dispatch("fetch", request("/app/nope", { mode: "navigate" })))?.body).toBe("body 200");
  });

  it("leaves alone every request it does not recognise", async () => {
    // Each must reach the browser's own network path: no respondWith call, no
    // cache write, no rewrite. A handler that answers one of these turns a cache
    // miss into a broken page.
    const worker = await installed();
    const before = worker.caches.urls(CACHE_NAME).length;
    net.fetch = async () => respond(200);
    for (const unrecognised of [
      request("/app/roster", { method: "POST" }),
      request("/icons/icon-192.png", { method: "HEAD" }),
      request("/assets/app-DkiMwHQd.js", { origin: "https://cdn.example" }),
      request("/icons/icon-512.png", { range: "bytes=0-99" }),
      request("/manifest.webmanifest"),
      request("/_headers"),
    ]) {
      expect(await worker.dispatch("fetch", unrecognised), "this request was answered, not passed through").toBeUndefined();
    }
    expect(worker.caches.urls(CACHE_NAME)).toHaveLength(before);
  });
});

describe("registering the worker", () => {
  /** A container that records the message listener so a test can post to it. */
  function container(register = vi.fn(async () => undefined)) {
    const listeners = new Map<string, (event: { data: unknown }) => void>();
    return {
      register,
      addEventListener: (type: string, handler: (event: { data: unknown }) => void) => void listeners.set(type, handler),
      post: (data: unknown) => listeners.get("message")?.({ data }),
      heard: () => [...listeners.keys()],
    };
  }

  it("registers it at the root, which is the scope the manifest declares", () => {
    // Fail: a URL outside the scope. The browser rejects it, and an install
    // prompt that leads nowhere is worse than no prompt.
    const box = container();
    registerServiceWorker({ serviceWorker: box });
    expect(box.register).toHaveBeenCalledWith(SERVICE_WORKER_URL);
    expect(new URL(SERVICE_WORKER_URL, ORIGIN).pathname.startsWith("/")).toBe(true);
  });

  it("does nothing at all in a browser with no service worker support", () => {
    // This is the path every e2e in this repo runs today. Fail: any use of
    // `navigator` at module scope, or a thrown TypeError, and the app does not
    // start at all in exactly the browsers it must still work in.
    expect(() => registerServiceWorker({})).not.toThrow();
  });

  it("swallows a registration the browser refuses", async () => {
    // Fail: an unhandled rejection, which surfaces as an error the user cannot
    // act on. The app renders and works; it just will not open offline.
    const register = vi.fn(async () => {
      throw new Error("SecurityError: the script has an unsupported MIME type");
    });
    expect(() => registerServiceWorker({ serviceWorker: container(register) })).not.toThrow();
    await vi.waitFor(() => expect(register).toHaveBeenCalledOnce());
  });

  it("reloads when the worker says this page is on a build that is gone", () => {
    // Fail: no listener, or a listener that ignores the message. A tab whose
    // chunk URL 404ed cannot repair itself; the reload is the only way back, and
    // without it the user is on a dead build until they reload by hand.
    const reload = vi.fn();
    const box = container();
    registerServiceWorker({ serviceWorker: box }, reload);
    box.post("something else entirely");
    expect(reload).not.toHaveBeenCalled();
    box.post(STALE_BUILD_MESSAGE);
    expect(reload).toHaveBeenCalledOnce();
  });
});

describe("what the precache has to cover for the promise to be true", () => {
  it("caches every file both documents actually ask for", async () => {
    // The offline story is only as good as this set, and it is a set nobody reads
    // by hand. Fail: a document referencing a font, an icon or the manifest the
    // precache does not carry, and the offline load is an unstyled page under a
    // blank icon.
    const source = build(syntheticDist(true));
    net.fetch = async () => respond(200);
    const worker = startWorker(source);
    await worker.dispatch("install");
    const cached = worker.caches.urls(`comp3tive-${versionOf(source)}`);

    for (const [document, html] of [
      ["index.html", read("index.html")],
      ["app/index.html", read("app/index.html")],
    ] as const) {
      const referenced = [...html.matchAll(/(?:href|src)="(\/[^"]+)"/g)]
        .map((match) => match[1]!)
        // `/src/*` is the dev entry; the build rewrites it to a hashed
        // `/assets/*` URL, and the precache is generated from those.
        .filter((url) => !url.startsWith("/src/"));
      expect(referenced.length, `${document} references nothing to check`).toBeGreaterThan(0);
      for (const url of referenced) {
        expect(cached, `${document} asks for ${url}`).toContain(new URL(url, ORIGIN).href);
      }
    }
  });
});
