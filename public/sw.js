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

/** Cache-first for immutable build output, the fonts and the icons. */
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  // A non-2xx is a real answer and is not stored: caching an error under an asset
  // URL would turn one bad deploy into a permanent one.
  if (response.ok) {
    const cache = await caches.open(CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

/**
 * Network-first for documents, with the precached copy as the offline fallback.
 *
 * A document is the one thing that must never go stale, because a stale document
 * names the asset URLs of the build that produced it, and those are gone.
 */
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    // The request itself, then the bare path, then a designed 404 rather than a
    // browser error. A navigation that is in no cache at all is a wrong URL, and
    // the 404 page is the honest answer to a wrong URL.
    for (const key of [request, new URL(request.url).pathname, "/404.html"]) {
      const cached = await caches.match(key);
      if (cached) return cached;
    }
    throw err;
  }
}

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
