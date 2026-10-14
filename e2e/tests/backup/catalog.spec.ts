/**
 * The catalog survives a backup (Phase E ticket 01, step 6's write half).
 *
 * The format change is proven in `src/data/transfer.test.ts`, which is where
 * `parseBackup` and `serializeBackup` are unit-testable. What no unit test can
 * reach is the other half: **the merge actually writing the catalog into the
 * store**, because it happens inside `usePlayerImport`'s `apply` closure and
 * the unit environment runs no effects and no event handlers.
 *
 * The defect this covers is the one the ticket opens with. Export on one
 * device, import on another, and every custom Discipline is gone while the
 * capabilities naming it survive as orphans. `parseBackup` returning the right
 * array is necessary and not sufficient: a merge that parses the catalog and
 * never writes it reproduces the original bug exactly, with green unit tests.
 *
 * The assertions are taken from IndexedDB rather than from the screen, because
 * the screen is not where the loss happened. A restored catalog that renders
 * but is not persisted is lost again on the next reload, and only the store can
 * tell the difference.
 */
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { DB_VERSION, gotoHubSeeded, type SeedWorld } from "../../support/seed";

/** A device that has never seen volleyball: only the three seeded disciplines. */
const world = (): SeedWorld => ({
  communities: [{ id: "comm-catalog", name: "Catalog Crew", createdAt: 100 }],
  players: [],
  sessions: [],
  tournaments: [],
  squads: [],
  activeCommunityId: "comm-catalog",
});

/** A custom discipline whose every field differs from anything the code ships. */
const volleyball = {
  id: "volleyball",
  name: "Volleyball",
  shortName: "VB",
  roles: [
    { id: "setter", name: "Setter" },
    { id: "spiker", name: "Spiker" },
  ],
  attributes: [{ id: "serve", name: "Serve", min: 1, max: 5 }],
  strengthModel: { kind: "mean" },
  team: { minTeamSize: 6, maxTeamSize: 6, rolesRequired: true },
};

/**
 * A v5 backup carrying the custom discipline and a player who uses it, so the
 * merge has something to hang the catalog on. The player is what makes the
 * ordering requirement observable: a capability resolves its discipline through
 * the local catalog.
 */
const backupWithCatalog = () =>
  JSON.stringify({
    version: 5,
    exportedAt: new Date().toISOString(),
    communities: [{ id: "comm-catalog", name: "Catalog Crew", createdAt: 100 }],
    players: [
      {
        id: "vb-1",
        communityId: "comm-catalog",
        name: "Setter One",
        capabilities: [
          {
            disciplineId: "volleyball",
            attributeRatings: { serve: 4 },
            eligibleRoles: ["setter"],
            preferredRole: "setter",
          },
        ],
      },
    ],
    sessions: [],
    tournaments: [],
    savedSquads: [],
    disciplines: [volleyball],
  });

/** Every discipline id in the store, sorted. Read in the browser. */
function storedDisciplineIds(page: Page) {
  return page.evaluate(
    (version) =>
      new Promise<string[]>((resolve) => {
        const request = indexedDB.open("comp3tive", version);
        request.onerror = () => resolve([]);
        request.onsuccess = () => {
          const db = request.result;
          const all = db.transaction("disciplines", "readonly").objectStore("disciplines").getAll();
          all.onerror = () => resolve([]);
          all.onsuccess = () => {
            resolve((all.result as { id: string }[]).map((d) => d.id).sort());
            db.close();
          };
        };
      }),
    DB_VERSION,
  );
}

/** The stored volleyball row, or null if the merge never wrote it. */
function storedVolleyball(page: Page) {
  return page.evaluate(
    (version) =>
      new Promise<Record<string, unknown> | null>((resolve) => {
        const request = indexedDB.open("comp3tive", version);
        request.onerror = () => resolve(null);
        request.onsuccess = () => {
          const db = request.result;
          const get = db.transaction("disciplines", "readonly").objectStore("disciplines").get("volleyball");
          get.onerror = () => resolve(null);
          get.onsuccess = () => {
            resolve((get.result as Record<string, unknown>) ?? null);
            db.close();
          };
        };
      }),
    DB_VERSION,
  );
}

test("a merged backup writes the custom discipline into the store", async ({ page }) => {
  await gotoHubSeeded(page, world(), "Roster");
  // The app seeds its own catalog on first open, so the starting point is the
  // three built-ins and nothing else.
  await expect.poll(() => storedDisciplineIds(page)).toEqual(["badminton", "futsal", "mlbb"]);

  await page.setInputFiles('input[type="file"]', {
    name: "with-catalog.json",
    mimeType: "application/json",
    buffer: Buffer.from(backupWithCatalog(), "utf8"),
  });
  // The banner names what is new before anything is written. This is also the
  // assertion that the catalog is *counted*: a merge that wrote disciplines
  // without counting them would name a plan the user never sees.
  const banner = page.locator(".status-banner");
  await expect(banner).toContainText("1 new discipline");
  await expect(banner).toContainText("1 new player");
  await banner.getByRole("button", { name: "Import", exact: true }).click();

  // The write. The three built-ins must survive alongside it: the merge adds
  // ids, and a catalog replaced rather than merged would take futsal with it.
  await expect.poll(() => storedDisciplineIds(page)).toEqual([
    "badminton",
    "futsal",
    "mlbb",
    "volleyball",
  ]);

  // Every field, not just the id: a merge that wrote a skeleton entry would
  // leave the app with a discipline whose roles and attributes are missing.
  expect(await storedVolleyball(page)).toEqual(volleyball);
});

test("importing the same backup twice writes the discipline once", async ({ page }) => {
  await gotoHubSeeded(page, world(), "Roster");
  await page.setInputFiles('input[type="file"]', {
    name: "with-catalog.json",
    mimeType: "application/json",
    buffer: Buffer.from(backupWithCatalog(), "utf8"),
  });
  await page.locator(".status-banner").getByRole("button", { name: "Import", exact: true }).click();
  await expect.poll(() => storedDisciplineIds(page)).toContain("volleyball");

  // The second import of the same file has nothing new: an existing id is left
  // alone, so no banner is offered at all. `totalNew === 0` returns early.
  await page.setInputFiles('input[type="file"]', {
    name: "with-catalog.json",
    mimeType: "application/json",
    buffer: Buffer.from(backupWithCatalog(), "utf8"),
  });
  await expect(page.locator(".status-banner")).toHaveCount(0);

  // And the store still holds exactly one entry per id, with the definition
  // unmoved. The built-ins are seeded once and never rewritten here, which is
  // the same resurrect-a-deleted-discipline rule the DB upgrade observes.
  await expect.poll(() => storedDisciplineIds(page)).toEqual([
    "badminton",
    "futsal",
    "mlbb",
    "volleyball",
  ]);
  expect(await storedVolleyball(page)).toEqual(volleyball);
});

test("a v4 backup imports with the built-in catalog and no banner surprise", async ({ page }) => {
  await gotoHubSeeded(page, world(), "Roster");
  // A file predating the field. It carries no catalog, and it must not import
  // one: the built-ins are the code's, and they are already on the device.
  await page.setInputFiles('input[type="file"]', {
    name: "v4.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        version: 4,
        exportedAt: new Date().toISOString(),
        communities: [{ id: "comm-catalog", name: "Catalog Crew", createdAt: 100 }],
        players: [
          { id: "p-1", communityId: "comm-catalog", name: "V4 Player", capabilities: [] },
        ],
        sessions: [],
        tournaments: [],
        savedSquads: [],
      }),
      "utf8",
    ),
  });
  const banner = page.locator(".status-banner");
  await expect(banner).toContainText("1 new player");
  // Zero on the disciplines count: nothing in the file is new, so the catalog
  // is untouched rather than re-seeded.
  await expect(banner).toContainText("0 new discipline");
  await banner.getByRole("button", { name: "Import", exact: true }).click();

  await expect.poll(() => storedDisciplineIds(page)).toEqual(["badminton", "futsal", "mlbb"]);
});
