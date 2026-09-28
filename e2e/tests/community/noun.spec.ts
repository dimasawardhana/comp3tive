/**
 * B15: the group is a Community in every string a user reads.
 *
 * "Squad" survives only where it names the curated, named split (Saved Squad),
 * which CONTEXT.md deliberately calls a squad. These two assertions cover the
 * two replaced strings that render on a seeded, empty-roster screen.
 */
import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

/** Seed an empty community so the Roster renders its empty state. */
async function gotoSeededEmptyRoster(page: Page) {
  const script = `(() => {
    const STORES = ["communities", "players", "sessions", "tournaments", "saved-squads", "disciplines"];
    const request = indexedDB.open("comp3tive", 6);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const name of STORES) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: "id" });
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      localStorage.setItem("tb-community", "comm-noun");
      const tx = db.transaction("communities", "readwrite");
      tx.objectStore("communities").put({ id: "comm-noun", name: "Noun Crew", createdAt: 100 });
      db.close();
    };
    request.onerror = () => console.error("seed failed");
  })();`;
  await page.addInitScript(script);
  await page.goto("./");
  await expect(page.locator(".app")).toBeVisible({ timeout: 15000 });
}

test("the roster calls the group a community, not a squad", async ({ page }) => {
  await gotoSeededEmptyRoster(page);

  await page.getByRole("button", { name: "Roster", exact: true }).click();
  await expect(page.locator(".screen h1")).toHaveText("comp3tive");

  // src/App.tsx:1061. An empty roster is the only state that renders this.
  await expect(page.locator(".empty .big")).toHaveText("No players in this community");
  // And the CTA below it speaks about the roster, not a squad (src/App.tsx:1123).
  await expect(page.locator(".cta-label")).toContainText("Split the roster");
  await expect(page.locator(".cta-label")).not.toContainText("squad");
});
