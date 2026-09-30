import { test, expect, type Page } from "@playwright/test";
import { gotoHubSeeded, type SeedWorld } from "../../support/seed";

/**
 * The button family, measured where it renders.
 *
 * `DESIGN.md`'s Buttons section claims one family at one height, 52px, and
 * records three numbers beside it: the `.btn` base at 50, the bordered variants
 * at 52, and the `.small` tier at 34. A document that claims one height and
 * records three is a document nobody can hold, so this file holds it: on every
 * screen it visits, every button is either the family height or the named tier,
 * and the 50px base is asserted never to ship at all.
 *
 * ## The webfont is load-bearing here, and waiting for it is not optional
 *
 * A button's `line-height` is `normal`, so its box is whatever its own font's
 * metrics say. Measured before `Familjen Grotesk` is applied, the 16px line box
 * is 21 rather than 20 and every ghost measures 53 instead of 52. That is not a
 * rounding detail to be tolerated: it is a spec that reads 52 and fails on a
 * cold cache, which is how a geometry guard gets deleted. So the font is waited
 * for and then asserted applied, and the assertion is what makes the number
 * below mean something.
 *
 * ## Why the Squads detail is the screen
 *
 * Its action row is the only one in the app holding three variants at once: two
 * `btn-ghost`, one `btn-primary` and one `btn-danger-ghost`. It is also the row
 * a claim about "a primary over a plain button" would be about, and there is no
 * plain button on it to be shorter than, which is the point.
 */
/** The five hub destinations, the same set `seed.ts` navigates by. */
const HUBS = ["Home", "Roster", "Squads", "Games", "History"] as const;

const names = ["Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot", "Golf", "Hotel", "India", "Juliet"];
const roles = ["tank", "assassin", "mage", "marksman", "fighter"];

const world = (): SeedWorld => {
  const players = names.map((name, i) => ({
    id: `p${i + 1}`,
    communityId: "comm-family",
    name,
    capabilities: [
      {
        disciplineId: "mlbb",
        attributeRatings: { mechanics: 4, "game-sense": 4, "hero-pool": 4, teamwork: 4 },
        eligibleRoles: roles,
        preferredRole: roles[i % 5],
      },
    ],
  }));
  const result = {
    teams: [0, 1].map((index) => ({
      index,
      slots: players.slice(index * 5, index * 5 + 5).map((p) => ({ playerId: p.id, roleId: roles[index] })),
      totalStrength: 20,
      avgStrength: 4,
    })),
    gap: 0,
    flags: [],
    unassigned: [],
    solver: { optimal: true, nodesExplored: 12, elapsedMs: 3 },
  };
  return {
    communities: [{ id: "comm-family", name: "Family Test", createdAt: 100 }],
    players,
    sessions: [],
    tournaments: [],
    squads: [
      {
        id: "sq-family",
        communityId: "comm-family",
        name: "Friday Scrims",
        disciplineId: "mlbb",
        createdAt: 200,
        poolPlayerIds: players.map((p) => p.id),
        settings: { teamCount: 2 },
        result,
      },
    ],
    activeCommunityId: "comm-family",
  };
};

/** One button as the browser laid it out: the class string it was given and the box it got. */
interface ButtonBox {
  cls: string;
  height: number;
  label: string;
}

const readButtons = (page: Page): Promise<ButtonBox[]> =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLButtonElement>(".btn")].map((b) => ({
      cls: b.className,
      height: b.getBoundingClientRect().height,
      label: (b.textContent ?? "").replace(/\s+/g, " ").trim(),
    })),
  );

/** Settle the webfont, and prove it settled, before anything is measured. */
async function withFamilyFont(page: Page): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  expect(
    await page.evaluate(() => document.fonts.check('600 16px "Familjen Grotesk"')),
    "the family height is only 52 with the app's own face loaded",
  ).toBe(true);
}

/**
 * Each variant's own box, measured where nothing stretches it.
 *
 * A row cannot answer this. Every action row is a flex line, and a flex line
 * stretches its items to the tallest of them, so a ghost that lost its border
 * still measures 52 beside a 52px primary and the defect is invisible on screen.
 * That is the whole reason the primary's 47px survived an audit, and it is why
 * the numbers in `DESIGN.md` are recorded "out of flow". A block wrapper is what
 * takes a button out of flow, so that is what this measures: the box each class
 * string actually produces, which is the table the document publishes.
 */
const measureOutOfFlow = (page: Page, classes: readonly string[]): Promise<Record<string, number>> =>
  page.evaluate((wanted) => {
    const host = document.createElement("div");
    host.style.cssText = "position:absolute;left:-9999px;top:0;width:600px;";
    document.body.appendChild(host);
    const out: Record<string, number> = {};
    for (const cls of wanted) {
      // A block wrapper, so the button is laid out on its own rather than as a
      // flex item, and `flex: 1` on `.btn` has nothing to divide.
      const block = document.createElement("div");
      block.style.cssText = "display:block;width:400px;";
      const button = document.createElement("button");
      button.type = "button";
      button.className = cls;
      button.textContent = "Measure me";
      block.appendChild(button);
      host.appendChild(block);
      out[cls] = button.getBoundingClientRect().height;
      block.remove();
    }
    host.remove();
    return out;
  }, classes);

test.describe("the button family", () => {
  test("each variant's own box is the height the document records", async ({ page }) => {
    await gotoHubSeeded(page, world(), "Roster");
    await withFamilyFont(page);

    const measured = await measureOutOfFlow(page, [
      "btn",
      "btn btn-ghost",
      "btn btn-primary",
      "btn btn-danger-ghost",
      "btn btn-ghost small",
    ]);
    // The family, its floor and its tier, exactly as `DESIGN.md`'s Buttons
    // section publishes them. The 50 is asserted as well as the 52s, because
    // the document's claim rests on the base being 50 and never shipping: a
    // change that quietly made the base 52 would still be one number, and would
    // still need the document to say so.
    expect(measured).toEqual({
      btn: 50,
      "btn btn-ghost": 52,
      "btn btn-primary": 52,
      "btn btn-danger-ghost": 52,
      "btn btn-ghost small": 34,
    });
  });

  test("the four-variant row is one height, and none of them is the 50px base", async ({ page }) => {
    await gotoHubSeeded(page, world(), "Squads");
    await page.getByText("Friday Scrims").click();
    await expect(page.getByRole("button", { name: "Re-split" })).toBeVisible();
    await withFamilyFont(page);

    const bar = await readButtons(page);
    const row = bar.filter((b) => ["← Squads", "Re-split", "New tournament with these teams", "Delete"].includes(b.label));
    // Four is not a guess: the Squads detail's action row is the only one in the
    // app carrying three variants at once, and a row that lost a button would
    // quietly stop being the case this file is about.
    expect(row.map((b) => b.label)).toEqual(["← Squads", "Re-split", "New tournament with these teams", "Delete"]);
    for (const button of row) {
      expect(button.height, `${button.cls} "${button.label}"`).toBe(52);
    }
    // And the base is not on this row, which is the claim the document now
    // rests on: the 50px `.btn` is a floor, not a member of the family.
    expect(row.map((b) => b.cls)).not.toContain("btn");
  });

  test("every button on the hub is the family height or the named tier", async ({ page }) => {
    const byHub: Record<string, ButtonBox[]> = {};
    for (const hub of HUBS) {
      await gotoHubSeeded(page, world(), hub);
      await withFamilyFont(page);
      const buttons = await readButtons(page);
      byHub[hub] = buttons;
      for (const button of buttons) {
        // The two heights the document names, and nothing between or outside
        // them. A variant that arrives with the wrong padding fails here rather
        // than in a thumb.
        expect([52, 34], `${hub}: ${button.cls} "${button.label}"`).toContain(button.height);
        expect(button.cls, `${hub}: a bare .btn would render at 50px`).not.toBe("btn");
      }
    }
    // Four of the five hubs carry the family; History carries none, and that is
    // a fact rather than a gap. Its only per-row control is a `link danger`, not
    // a `.btn`, so a sweep that demanded a button here would be demanding one
    // the design does not have.
    for (const hub of ["Home", "Roster", "Squads", "Games"] as const) {
      expect(byHub[hub].length, `${hub} rendered no buttons to measure`).toBeGreaterThan(0);
    }
    expect(byHub.History, "History grew a .btn outside the family").toEqual([]);
    // The tier is not a comment in the document: the roster's select-all is the
    // one place the family is deliberately not 52, and it is 34.
    const small = byHub.Roster.find((b) => b.cls === "btn btn-ghost small");
    expect(small, "the roster's select-all lost the .small tier").toBeTruthy();
    expect(small!.height).toBe(34);
  });
});
