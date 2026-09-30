/**
 * B15: the group is a Community in the strings this file pins.
 *
 * B15 replaced five user-visible strings. Two of them render on a seeded,
 * empty-roster screen, and these two are what this file asserts: the
 * empty-roster copy and the CTA under it. The other three — "then the roster",
 * "Tournament teams", "Save teams to tournament →" — are not asserted here, so
 * this header does not claim them.
 *
 * "Squad" survives only where it names the curated, named split (Saved Squad),
 * which CONTEXT.md deliberately calls a squad.
 */
import { test, expect } from "@playwright/test";
import { gotoHubSeeded } from "../../support/seed";

/** One community with no players, so the Roster renders its empty state. */
const emptyRoster = {
  communities: [{ id: "comm-noun", name: "Noun Crew", createdAt: 100 }],
  players: [],
  sessions: [],
  tournaments: [],
  squads: [],
  activeCommunityId: "comm-noun",
};

test("the roster calls the group a community, not a squad", async ({ page }) => {
  await gotoHubSeeded(page, emptyRoster, "Roster");
  await expect(page.locator(".screen h1")).toHaveText("comp3tive");

  // "No players in this community": the empty-roster copy. An empty roster is
  // the only state that renders it. Phase C moves this string into
  // src/shell/RosterScreen.tsx — carry it verbatim, do not re-derive it.
  await expect(page.locator(".empty .big")).toHaveText("No players in this community");
  // And the CTA below it speaks about the roster, not a squad ("Split the
  // roster"; likewise moved by Phase C).
  await expect(page.locator(".cta-label")).toContainText("Split the roster");
  await expect(page.locator(".cta-label")).not.toContainText("squad");
});
