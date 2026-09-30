/// <reference types="vitest/config" />
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * The documents the worker precaches, each paired with the file in `dist` that has
 * to back it. The worker holds no copy of this list: the build writes it, so
 * there is one list, it lives where the filesystem is, and a URL with no file
 * behind it fails the build instead of failing the install on a user's phone.
 *
 * `/` and `/app/` are what a browser and a launcher ask for — the manifest's
 * `start_url` is `/app/`, and that is the request the installed icon makes.
 * `/index.html` and `/app/index.html` are the same two documents under the names
 * the build emitted, so a pasted link that names the file still opens offline.
 * `/404.html` is the last-resort answer to a navigation that is cached nowhere.
 * `/manifest.webmanifest` is here so an installed app's own name and icons stay
 * reachable with no network.
 */
const DOCUMENTS: ReadonlyArray<readonly [url: string, file: string]> = [
  ["/", "index.html"],
  ["/index.html", "index.html"],
  ["/app/", "app/index.html"],
  ["/app/index.html", "app/index.html"],
  ["/404.html", "404.html"],
  ["/manifest.webmanifest", "manifest.webmanifest"],
];

/** Replace every occurrence, then prove none survived. */
export function substitute(source: string, token: string, value: string): string {
  if (!source.includes(token)) throw new Error(`service-worker-build: sw.js has no ${token} placeholder.`);
  const next = source.split(token).join(value);
  if (next.includes(token)) throw new Error(`service-worker-build: ${token} survived substitution.`);
  return next;
}

/**
 * Write the emitted precache list and a build-derived version into dist/sw.js.
 *
 * The precache list is generated, never hand-maintained: a hand-written list
 * would drift from the hashed filenames and 404 on every offline fetch.
 *
 * The version is a hash of a URL and the bytes behind it, over EVERY precached
 * URL — the documents included, not just the assets. Two reasons, and the second
 * one was a real defect in the first cut of this file:
 *
 *  - `/icons/*.png` and `/manifest.webmanifest` keep their names across a
 *    redesign, so hashing asset names alone cannot see a redrawn icon.
 *  - A document changed on disk changes what `/app/` serves, and a version that
 *    ignored that would leave the new document sitting in a cache the worker
 *    never re-opens. "The document changed but the cache did not" is exactly the
 *    bug the version exists to prevent.
 *
 * The cost is a full re-precache on a deploy that changes copy only and no asset
 * — one download of a few hundred kB per returning user, on a visit they were
 * going to make anyway. That is the right trade: the promise of a
 * content-derived version is that a changed byte produces a new cache, and
 * honouring it everywhere is cheaper than being right about files and wrong
 * about the page.
 *
 * A worker-only change does not move the version and does not need to: no
 * precached URL or byte changed, and the browser updates the script itself on its
 * own byte comparison, whatever the cache is called.
 */
export function serviceWorkerBuild(outDir = resolve(import.meta.dirname, "dist")) {
  return {
    name: "service-worker-build",
    apply: "build" as const,
    closeBundle() {
      const swPath = join(outDir, "sw.js");
      if (!existsSync(swPath)) {
        throw new Error("service-worker-build: dist/sw.js is missing; public/sw.js was not copied.");
      }
      const list = (dir: string, keep: (name: string) => boolean = () => true) =>
        existsSync(join(outDir, dir))
          ? readdirSync(join(outDir, dir)).filter(keep).map((name) => `/${dir}/${name}`).sort()
          : [];
      const assets = list("assets");
      if (assets.length === 0) {
        throw new Error("service-worker-build: no hashed assets were emitted, so the precache list would be empty.");
      }
      for (const [url, file] of DOCUMENTS) {
        if (!existsSync(join(outDir, file))) {
          throw new Error(
            `service-worker-build: dist/${file} is missing, so the worker would precache ${url} and fail to install on every device.`,
          );
        }
      }
      // The licence texts beside the fonts are not fonts: they are not precached,
      // and they keep Cloudflare's own Content-Type (public/_headers).
      const precache = [...assets, ...list("fonts", (name) => name.endsWith(".woff2")), ...list("icons")];
      // A URL and a hash of the bytes behind it — the unit the version is made
      // of. A precache URL is already a path inside `dist`; a document URL is not,
      // so its file is named in DOCUMENTS.
      const fingerprint = (url: string, file: string) =>
        `${url}\n${createHash("sha256").update(readFileSync(join(outDir, file))).digest("hex")}`;
      const version = createHash("sha256")
        .update(
          [
            ...DOCUMENTS.map(([url, file]) => fingerprint(url, file)),
            ...precache.map((url) => fingerprint(url, url)),
          ].join("\n"),
        )
        .digest("hex")
        .slice(0, 12);
      let source = readFileSync(swPath, "utf8");
      source = substitute(source, "__BUILD_VERSION__", version);
      source = substitute(source, "__PRECACHE_ASSETS__", JSON.stringify(precache));
      source = substitute(source, "__PRECACHE_DOCUMENTS__", JSON.stringify(DOCUMENTS.map(([url]) => url)));
      writeFileSync(swPath, source);
      console.log(`  sw.js  version ${version}  precache ${precache.length} urls`);
    },
  };
}

export default defineConfig({
  // Two documents, not a router (ADR-0006): the Landing Page at `/`, the app at `/app`.
  // `mpa` removes the SPA fallback, so an unmatched path 404s instead of being
  // rewritten to the Landing Page — which is what Cloudflare does in production.
  appType: "mpa",
  // `serviceWorkerBuild()` fills the three placeholders in public/sw.js once the
  // hashed assets are on disk. Nothing else about the build changes.
  plugins: [react(), serviceWorkerBuild()],
  build: {
    rollupOptions: {
      input: {
        landing: resolve(import.meta.dirname, "index.html"),
        app: resolve(import.meta.dirname, "app/index.html"),
      },
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
