/**
 * comp3tive service worker — classic worker, no imports, no bundler, no workbox.
 *
 * The three constants below are filled in at build time by the
 * `service-worker-build` plugin in vite.config.ts, each from exactly one place,
 * and each placeholder is named nowhere else in this file so that "is the
 * placeholder still there?" is a question with one answer. The version is a hash
 * of every precached file's path and bytes, so a deploy that changes anything
 * precached changes the cache name. That single coupling is the whole reason this
 * file is versioned: without it, a returning user is served a mix of two builds,
 * and nothing in the app — not a test, not a stack trace, not the UI — would say
 * so. It is the one file in this repo that persists across visits, survives a
 * reload, and cannot be fixed by the user.
 *
 * Scope is `/`, so one worker covers both documents: `/` (the Landing Page) and
 * `/app/` (the app). See docs/adr/0006-landing-page-and-app-paths.md.
 *
 * What "offline" means here, in one sentence a user could be told truthfully:
 * after one online visit, this app opens and runs a whole tournament on a device
 * with no network, because the shell, both documents, the fonts and the icons are
 * on the device and the teams were already in IndexedDB. It is not a sync story
 * and this worker does not pretend to be one — there is no server to sync with
 * (docs/adr/0001-client-only-first.md), and a caching strategy that only pays off
 * once a backend exists is a strategy for a product that does not exist yet.
 */
const VERSION = "__BUILD_VERSION__";
/** Hashed asset URLs the build emitted, plus the fonts and the icons. */
const PRECACHE_ASSETS = __PRECACHE_ASSETS__;
/** Every URL a document can legitimately be requested under. */
const DOCUMENTS = __PRECACHE_DOCUMENTS__;

const CACHE = "comp3tive-" + VERSION;
const CACHE_PREFIX = "comp3tive-";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // All-or-nothing on purpose. `addAll` fails the whole install if one URL is
      // missing, and a half-cached worker that installs is worse than no worker:
      // it claims to be offline and is not. The build refuses to emit a worker
      // whose document list is not on disk, so this is a loud failure at build
      // time where it can be fixed, rather than a silent one on a user's phone.
      .then((cache) => cache.addAll(DOCUMENTS.concat(PRECACHE_ASSETS)))
      // skipWaiting, but not clients.claim() — see the note on `activate`.
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  // Only this app's caches are purged. A cache on this origin that is not ours is
  // left alone: a service worker that deletes every key a browser happens to hold
  // for its origin is reaching outside its own name.
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      ),
  );
  // Deliberately NOT self.clients.claim().
  //
  // skipWaiting alone gives the half that matters: a returning user is not pinned
  // to the old build, because the new worker activates and purges the old cache
  // without waiting for every tab to close.
  //
  // claim is the half that costs. Claiming takes control of pages that are
  // already running, and this app loads code on demand: App.tsx reaches
  // `./data/sample-data` behind an `await import()`, and the roster JSON behind
  // that is a separate chunk. A tab on the old build that gets claimed
  // mid-session, and then presses "Sample" for the first time, is handed the NEW
  // build's chunk out of the NEW cache — an old document running a new module,
  // which is a crash or a duplicate copy of React rather than anything a test
  // here could see. What claim buys is "a new deploy takes over an open tab
  // immediately", and a user cannot use that: the tab keeps running the old
  // bundle it already has, and reaches the new one on their next navigation. The
  // cost is a mixed build; the benefit is nothing. So: skipWaiting, no claim.
});

/** What the worker sends a page that is running a build that is no longer deployed. */
const STALE_BUILD = "comp3tive:stale-build";
/** One report per worker lifetime, so a broken deploy cannot become a reload loop. */
let staleBuildReported = false;

/**
 * Store a response, and refuse to let a failure to store it become a failure of
 * the page.
 *
 * `Cache.put` rejects on a 206, on some opaque responses, and on a full disk —
 * and a full disk is precisely the user who installed the app and has every
 * precached byte on their device. A floating, unguarded put turns that user's
 * next load into an unhandled rejection and silently under-caches the one person
 * for whom any of this exists. The write is also deliberately not awaited: the
 * page is not waiting on a cache, it is waiting on a tournament.
 */
function store(request, response) {
  // A non-2xx is a real answer and is not stored: caching an error under an asset
  // URL would turn one bad deploy into a permanent one. Neither is a 206, which
  // is a slice of a body and would be served whole to the next reader.
  if (!response.ok || response.status === 206) return;
  void caches
    .open(CACHE)
    .then((cache) => cache.put(request, response.clone()))
    .catch(() => undefined);
}

/**
 * Tell the open pages that this one is running a build that is no longer there.
 *
 * A 404 for build output means the page asked for a URL from a deploy that has
 * been replaced: the file is gone from the server, and the cache that used to
 * hold it is either a previous build's — already purged by the worker that took
 * over — or gone under storage pressure. Nothing can make that request succeed,
 * and nothing inside the page can fix it except starting again on the current
 * build, so the one thing worth doing is say so.
 *
 * This is not a consequence of `skipWaiting`, and it is not fixed by dropping it.
 * A tab that stays open across a deploy runs no update check at all until it
 * navigates, so its chunk is already being served from a cache that the new
 * worker will purge out from under it. Removing `skipWaiting` narrows that
 * window; it does not close it, because the browser can evict Cache Storage on
 * its own schedule and nothing in this file can stop that.
 */
function reportStaleBuild() {
  if (staleBuildReported) return;
  staleBuildReported = true;
  void self.clients
    // includeUncontrolled, because the page that most needs this is a tab the
    // activation just handed back to the network.
    .matchAll({ includeUncontrolled: true, type: "window" })
    .then((clients) => Promise.all(clients.map((client) => client.postMessage(STALE_BUILD))))
    .catch(() => undefined);
}

/**
 * Cache-first for immutable build output, the fonts and the icons.
 *
 * The read is scoped to this worker's own cache and NOT the global
 * `caches.match`, and that is the whole difference between a stale tab and a
 * broken one. `caches.match` searches every cache on the origin, so a tab still
 * being served by the previous worker — which a `skipWaiting` activation leaves
 * in place, deliberately, because claiming it is worse — would ask for a chunk
 * URL that both builds happen to share and be handed the NEW build's bytes out
 * of the NEW cache. An old document running a new module is the bug this file
 * has spent the most comment on avoiding, and the global lookup reintroduces it
 * through the back door. Scoped, that request is a miss, and a miss is a 404 the
 * page can be told about.
 */
async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  store(request, response);
  if (response.status === 404) reportStaleBuild();
  return response;
}

/**
 * Network-first for documents, with the precached copy as the offline fallback.
 *
 * A document is served from the network whenever there is a network; the cache
 * only ever answers an offline navigation. That is not the same as "documents
 * cannot go stale" — a document is loaded once and lives in the page, and what a
 * page goes stale on is the chunk URLs it was handed, which is what the 404 above
 * is about. This shape is here because the two failure modes have opposite
 * fixes: a document must not be served from a cache when the network is up,
 * because a cached document names the asset URLs of the build that produced it;
 * and an asset must never be re-fetched when the cache already has it, because
 * the hashed name means the bytes cannot have changed.
 */
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    store(request, response);
    return response;
  } catch (err) {
    // The request itself, then the bare path, then a designed 404 rather than a
    // browser error. A navigation that is in no cache at all is a wrong URL, and
    // the 404 page is the honest answer to a wrong URL. Scoped to this worker's
    // cache for the reason given on `cacheFirst`: an offline tab on an old build
    // is better served the document it came with than the one it cannot run.
    const cache = await caches.open(CACHE);
    for (const key of [request, new URL(request.url).pathname, "/404.html"]) {
      const cached = await cache.match(key);
      if (cached) return cached;
    }
    throw err;
  }
}

// Two notes for whoever reads this in `vite dev`, where it does not work and is
// not meant to. `publicDir` is copied but nothing fills the placeholders, so the
// precache list is a bare identifier and the script throws when it is evaluated
// — the worker installs nothing, `register()` still resolves, and the app runs
// online-only, exactly as it did before this file existed. The swallow in
// src/registerServiceWorker.ts is what keeps that silent, so a developer on
// localhost does not meet a console error for a build artefact.

self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Everything below is a decision about what this worker will not touch, and the
  // default is the important one: a fetch event with no respondWith call is the
  // browser's own network fetch, untouched. So a request this handler does not
  // recognise — a POST, a HEAD, another origin, a Range request, or any
  // same-origin path outside the three prefixes below — is not answered from a
  // cache, not rewritten and not retried. It goes to the network exactly as if
  // this file did not exist.
  if (request.method !== "GET") return;
  // A 206 is a slice of a body, and storing one under the whole URL would serve
  // that slice to the next reader forever. Ranges pass through.
  if (request.headers.has("range")) return;

  const url = new URL(request.url);
  // The app reaches no third party; if it ever did, this cache is not its answer.
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }
  if (
    url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/fonts/") ||
    url.pathname.startsWith("/icons/")
  ) {
    event.respondWith(cacheFirst(request));
  }
  // Anything else falls out of this handler unhandled, which is the pass-through.
});
