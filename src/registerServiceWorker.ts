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
  readonly serviceWorker?: { register(url: string): Promise<unknown> };
}

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
 * not an error the user can act on, and the app says nothing false either way:
 * the Landing Page makes no offline or install claim of its own, because the
 * claim belongs to the next task, which proves it first.
 *
 * Nothing is awaited either. `register()` resolves once the worker is
 * *registered*; activation happens on the browser's own schedule, which no
 * promise here can shorten, and the render must not queue behind a file it does
 * not need.
 */
export function registerServiceWorker(nav: WorkerCapable = navigator): void {
  if (!("serviceWorker" in nav)) return;
  void nav.serviceWorker?.register(SERVICE_WORKER_URL).catch(() => undefined);
}
