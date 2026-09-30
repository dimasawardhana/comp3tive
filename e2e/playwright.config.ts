import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  retries: 0,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:4173/app/",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    viewport: { width: 1280, height: 720 },
  },
  webServer: {
    // Playwright spawns this relative to the config file's own directory (e2e/),
    // which has no package.json — so without `cwd` the command fails ENOENT and
    // the whole suite cannot start. `reuseExistingServer` hid that for months:
    // every recorded run had a preview server already up, so the broken command
    // was never exercised. CI runs this cold, on a fresh runner.
    cwd: "..",
    command: "npm run preview",
    url: "http://localhost:4173/app/",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
