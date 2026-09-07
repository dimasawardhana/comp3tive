import { test, expect } from "@playwright/test";

test("inspect3: split screen in tournament mode", async ({ page }) => {
  await page.goto("http://localhost:4173/");
  await expect(page.locator(".app")).toBeVisible({ timeout: 15000 });

  // Create community
  await page.getByTitle("New community").click();
  await page.locator(".add-community input").fill("Inspect3");
  await page.locator(".add-community .btn-primary").click();
  await expect(page.locator(".add-community")).not.toBeVisible({ timeout: 3000 });

  // Create a tournament
  await page.locator(".bottom-nav .nav-link").nth(1).click();
  await page.locator("button:has-text('+ New tournament')").click();
  await page.locator("#tournament-name").fill("Inspect3");
  await page.locator(".chip", { hasText: "Series" }).click();
  await page.locator(".modal-card .btn-primary").click();
  await expect(page.locator(".modal-card")).not.toBeVisible({ timeout: 5000 });

  // Inject a split result session directly into IndexedDB with tournamentId
  // to simulate being in the split screen after tournament split
  await page.evaluate(async () => {
    // Get the current tournament
    const dbReq = indexedDB.open("team-builder", 1);
    await new Promise<void>((resolve) => {
      dbReq.onsuccess = () => {
        const db = dbReq.result;
        const tx = db.transaction("tournaments", "readonly");
        const store = tx.objectStore("tournaments");
        const req = store.getAll();
        req.onsuccess = () => {
          const tournaments = req.result;
          if (tournaments.length === 0) {
            resolve();
            return;
          }
          const t = tournaments[0];
          // Add a split result session
          const tx2 = db.transaction("sessions", "readwrite");
          const store2 = tx2.objectStore("sessions");
          store2.put({
            id: "test-split-session",
            communityId: t.communityId,
            disciplineId: t.disciplineId,
            createdAt: Date.now(),
            poolPlayerIds: ["p1", "p2"],
            settings: { teamCount: 2 },
            result: {
              teams: [
                { index: 0, slots: [{ playerId: "p1", roleId: null }], avgStrength: 4.0 },
                { index: 1, slots: [{ playerId: "p2", roleId: null }], avgStrength: 4.0 },
              ],
              gap: 0.1,
            },
          });
          tx2.oncomplete = () => resolve();
        };
      };
    });
  });

  // Take screenshot of the draft page
  await page.waitForTimeout(500);
  await page.screenshot({ path: "/tmp/split-tourney.png", fullPage: true });
  console.log("Screenshot saved to /tmp/split-tourney.png");
});
