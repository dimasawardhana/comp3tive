/**
 * The shape of a navigator that can host a service worker.
 *
 * It is declared structurally rather than as `Navigator` so the no-support path —
 * the one every e2e in this repo runs today — can be exercised by passing `{}`,
 * and so a browser that has the property but refuses the registration can be
 * exercised by passing a container whose `register` rejects. Both are things this
 * app must survive, and neither is reachable through a real `Navigator` in a node
 * test environment.
 */
export interface WorkerCapable {
  readonly serviceWorker?: {
    register(url: string): Promise<unknown>;
    addEventListener(type: "message", handler: (event: { data: unknown }) => void): void;
  };
}

/** The worker's message for a page that is running a build which is no longer deployed. */
export const STALE_BUILD_MESSAGE = "comp3tive:stale-build";

/** The worker's scope is `/` (vite.config.ts), so the script sits at the root. */
export const SERVICE_WORKER_URL = "/sw.js";

/**
 * Register the service worker, or do nothing at all.
 *
 * The app has no server and makes no request it needs: everything it reads is in
 * IndexedDB and everything it runs is in the bundle (docs/adr/0001-client-only-first.md).
 * So a browser that refuses the worker, a browser with no worker support at all,
 * and a registration that rejects are the same non-event — the app renders and
 * works, it simply cannot open with no network.
 *
 * Nothing is reported, and that is a decision rather than an omission. The one
 * thing this could report is "you will not get the offline experience", which is
 * not an error the user can act on. What it would be wrong to do is stay silent
 * in the other direction: the Landing Page now says comp3tive opens and runs a
 * tournament with no signal once it has run with a network, and that sentence is
 * scoped to a worker being installed — by this file, and only by this file. A
 * browser that refuses the registration is the one case where the sentence stops
 * being true, and it is also the one case no user can act on.
 *
 * Nothing is awaited either. `register()` resolves once the worker is
 * *registered*; activation happens on the browser's own schedule, which no
 * promise here can shorten, and the render must not queue behind a file it does
 * not need.
 *
 * `reload` is why the message listener is here and not in main.tsx. A page that
 * is running a build which is no longer deployed cannot repair itself — the chunk
 * URL it holds is gone from the server — so the only way back to a working app is
 * to start again, and the worker is the only party that knows. It reports at most
 * once per worker lifetime, so a deploy that is broken in a way which keeps 404ing
 * costs this user one reload and not a loop.
 */
export function registerServiceWorker(nav: WorkerCapable = navigator, reload: () => void = () => window.location.reload()): void {
  if (!("serviceWorker" in nav)) return;
  const container = nav.serviceWorker;
  if (!container) return;
  void container.register(SERVICE_WORKER_URL).catch(() => undefined);
  container.addEventListener("message", (event) => {
    if (event.data === STALE_BUILD_MESSAGE) reload();
  });
}
