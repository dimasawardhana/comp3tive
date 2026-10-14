import { defineConfig } from "@playwright/test";

/**
 * Gates 2 and 3 of `docs/ROADMAP.md`, run against the DEPLOYED origin instead of
 * `vite preview`.
 *
 * **Deliberately outside the default suite.** `e2e/playwright.config.ts` points at
 * `./tests`, so `npm run e2e` never reaches this file: it needs the network, it
 * needs a deploy to already exist, and its target is a real origin rather than a
 * build on this disk. Run it by hand after a deploy:
 *
 * ```bash
 * npx playwright test --config=e2e/live.playwright.config.ts
 * ```
 *
 * There is no `webServer` here on purpose. The claim under test is the Landing
 * Page's — "after comp3tive has run with a network, it opens and runs a whole
 * tournament with no signal" — and `README.md` scopes it to a deployed origin.
 * A preview server cannot answer that question, which is the whole reason gates 2
 * and 3 were open.
 */
export default defineConfig({
  testDir: "./live",
  fullyParallel: false,
  retries: 0,
  workers: 1,
  timeout: 180_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: {
    baseURL: "https://comp3tive.dimasawardhana.workers.dev/app/",
    viewport: { width: 1280, height: 720 },
  },
});
