/**
 * The swap banner's live region, and the check that `role="status"` was the
 * right attribute rather than the plausible-looking one.
 *
 * ## Why this file exists
 *
 * The banner's text changes under the user's finger and nothing told a screen
 * reader. It reads *Tap one player on each team to swap them.* until a card is
 * tapped, and *Now tap a player on the other team to swap with X* after, and
 * that second sentence is the only place in the app naming **which player is
 * now the half of the swap that has happened**. A sighted user reads it in the
 * same viewport as the tap; a non-sighted user got no confirmation at all, and
 * the next tap completes a swap of a player they cannot name.
 *
 * ## The check, which is the substance of the finding
 *
 * The obvious fix was `role="status"`, and before shipping it the question is
 * whether this element has the shape that made Task 4 *remove* a `role="status"`
 * from the bench advisory (`src/DashboardScreen.nudge.test.ts:88-100`). That
 * removal's recorded reason is that the advisory is *inserted into the DOM with
 * its sentence already inside it*, so a live region announces nothing and the
 * attribute would be inert.
 *
 * The banner has that shape for exactly one of its four transitions, and not for
 * the three that matter:
 *
 * 1. `swapMode` false → true: the div is inserted with its first sentence
 *    already inside. The advisory's shape. Silent, and no attribute would help.
 * 2. `pick` null → a player: `swapMode` stays true, so the div is **already
 *    mounted** and only the text of its child `<span>` mutates. Announced.
 * 3. a completed swap clears `pick`: same mounted node, text mutates back.
 *    Announced.
 * 4. `pick` → a different `pick`: same mounted node, text mutates. Announced.
 *
 * So `role="status"` is correct here rather than merely plausible, and the test
 * below **establishes that from the rendered DOM rather than from the argument**:
 * it renders in each state and checks whether the banner element is the same
 * node, because "the text mutated inside a region that was already there" is
 * the precondition for an announcement and "the node was inserted with its
 * text" is the thing that defeats one.
 *
 * `renderToStaticMarkup` renders one state per call, so node identity across
 * states is asserted structurally (the banner is a conditional *wrapper* around
 * a `pick` ternary, not a per-`pick` remount) and the two halves are pinned
 * separately below. The interaction itself lives in
 * `e2e/tests/split/swap.spec.ts`, which drives the mode in a real browser and
 * tags the node to prove the identity half there.
 *
 * ## What this file does not claim
 *
 * **It does not claim the entry announcement works.** Transition 1 is still
 * silent and this amendment does not fix it. Fixing it needs a permanently
 * mounted live region, which collides with `e2e/tests/split/swap.spec.ts:326`
 * (`.swap-banner` has count 0 when the mode is off) and with `.swap-banner` as a
 * styled hook at `src/split.css:636`. Both are design decisions with a
 * measurement behind them, so the entry announcement is recorded as known-open
 * in `contracts.md` rather than smuggled in here. The first test below is
 * written so that a future fix for it has something to change.
 */
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import * as ts from "typescript";
import { MLBB_DISCIPLINE } from "../domain/seed";
import { SplitScreen } from "./SplitScreen";
import { freshSplit } from "./edit";
import type { Player, Session, SplitResult } from "../domain/types";

const ROLES = ["tank", "assassin", "mage", "marksman", "fighter"];

const ROSTER: Player[] = ["Alfa", "Bravo", "Cahya", "Delta", "Echo", "Foxtrot", "Golf", "Hotel", "India", "Juli"].map(
  (name, i) => ({
    communityId: "c1",
    id: `p${i + 1}`,
    name,
    capabilities: [
      {
        disciplineId: MLBB_DISCIPLINE.id,
        attributeRatings: { mechanics: 5, "game-sense": 5, "hero-pool": 5, teamwork: 5 },
        eligibleRoles: ROLES,
        preferredRole: null,
      },
    ],
  }),
);

const twoTeams = (): SplitResult =>
  freshSplit(ROSTER.map((p) => p.id), ROSTER, MLBB_DISCIPLINE, { teamCount: 2 });

const sessionOf = (result: SplitResult): Session => ({
  id: "s1",
  communityId: "c1",
  disciplineId: MLBB_DISCIPLINE.id,
  createdAt: 0,
  poolPlayerIds: ROSTER.map((p) => p.id),
  settings: { teamCount: result.teams.length },
  result,
});

const screen = (): string =>
  renderToStaticMarkup(
    createElement(SplitScreen, {
      session: sessionOf(twoTeams()),
      discipline: MLBB_DISCIPLINE,
      roster: ROSTER,
      onPersistResult: async () => {},
      source: "ad-hoc",
    }),
  );

const banner = (html: string): string | null => {
  const found = /<div class="swap-banner"[^>]*>([\s\S]*?)<\/div>/.exec(html);
  return found ? found[0] : null;
};

/** A JSX attribute's name, which the AST types as possibly namespaced. */
const attributeName = (attribute: ts.JsxAttribute): string | undefined =>
  ts.isIdentifier(attribute.name) ? attribute.name.text : undefined;


function walk(node: ts.Node, visit: (node: ts.Node) => void): void {
  visit(node);
  ts.forEachChild(node, (child) => walk(child, visit));
}

/**
 * The JSX attributes on the element carrying `className="swap-banner"`, read off
 * the source rather than off a render, because the banner renders only in swap
 * mode and a static render cannot enter it. Attribute presence is a structural
 * fact about the element, so reading it structurally is not a weaker claim than
 * reading the markup.
 */
function bannerAttributes(): Record<string, string> {
  const path = new URL("./SplitScreen.tsx", import.meta.url);
  const source = readFileSync(path, "utf8");
  const file = ts.createSourceFile("SplitScreen.tsx", source, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TSX);
  const found: Record<string, string> = {};
  walk(file, (node) => {
    if (!ts.isJsxOpeningElement(node) && !ts.isJsxSelfClosingElement(node)) return;
    const attributes = node.attributes.properties;
    if (!attributes.some((a) => ts.isJsxAttribute(a) && attributeName(a) === "className" && a.initializer?.getText(file) === '"swap-banner"')) {
      return;
    }
    for (const attribute of attributes) {
      if (!ts.isJsxAttribute(attribute)) continue;
      found[attributeName(attribute) ?? "spread"] = attribute.initializer?.getText(file)?.replace(/^"|"$/g, "") ?? "true";
    }
  });
  return found;
}

describe("the swap banner's live region", () => {
  it("is a polite status region, so a change of its text is announced", () => {
    // The attribute, and nothing else about it. `role="status"` rather than a
    // bare `aria-live`: it carries `aria-live="polite"` implicitly, and it is
    // the role that says what the element is rather than restating the
    // politeness the browser would infer anyway.
    expect(bannerAttributes()).toMatchObject({ role: "status" });
  });

  it("carries no aria-live of its own, because the role already sets it", () => {
    // Two spellings of one thing is a second thing to keep in agreement. If a
    // future edit wants assertive, that is a decision and not an accident.
    expect(bannerAttributes().ariaLive).toBeUndefined();
  });

  it("is mounted by the mode rather than by the pick, so its text mutates in place", () => {
    // **This is the check the finding asked for, made mechanical.** The banner's
    // text lives inside a `pick` ternary nested in a `swapMode` wrapper, so the
    // element React keeps across a pick is the one the mode mounted. That is the
    // whole difference from the bench advisory, whose element is inserted with
    // its sentence and never changes afterwards, and the reason `role="status"`
    // is inert there and load-bearing here.
    //
    // Asserted on the source because a static render cannot hold two states:
    // what matters is that one element wraps the ternary, not that two renders
    // produced two nodes. The browser half, which can actually tap, is
    // `e2e/tests/split/swap.spec.ts`.
    const source = readFileSync(new URL("./SplitScreen.tsx", import.meta.url), "utf8");
    const file = ts.createSourceFile("SplitScreen.tsx", source, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TSX);
    let wrappedByMode = false;
    walk(file, (node) => {
      if (!ts.isJsxExpression(node) || !node.expression || !ts.isBinaryExpression(node.expression)) return;
      if (node.expression.operatorToken.kind !== ts.SyntaxKind.AmpersandAmpersandToken) return;
      if (node.expression.left.getText(file) !== "swapMode") return;
      const rendered = node.expression.right.getText(file);
      // The mode's wrapper is the banner itself, not some element *around* a
      // banner that is itself conditional: the pick ternary must sit inside
      // the mounted div, and a second `swapMode &&` around the banner would
      // mean the node is recreated rather than mutated.
      wrappedByMode = rendered.includes('className="swap-banner"') && !rendered.trimStart().startsWith("swapMode &&");
    });
    expect(wrappedByMode).toBe(true);
  });

  it("keeps the ⇄ out of the announcement, because the sentence is the message", () => {
    // `role="status"` announces the region's contents, so an un-hidden icon
    // would read as a glyph before every instruction. It is already
    // `aria-hidden`, and that is worth holding: it is the one attribute in this
    // element that a well-meaning edit strips as redundant.
    //
    // Read off the source rather than a render, because the icon lives inside
    // the `swapMode` guard and a static render of the initial state has the
    // mode off, so there is no banner in the markup to look at. That is the
    // same reason `bannerAttributes` reads the element structurally.
    const source = readFileSync(new URL("./SplitScreen.tsx", import.meta.url), "utf8");
    expect(source).toContain('<span className="swap-banner-icon" aria-hidden="true">');
  });

  it("renders no banner at all when the mode is off, and so announces no entry", () => {
    // **The residual, pinned rather than hidden.** With the mode off the element
    // is absent, so there is nothing mounted to announce its arrival. This is
    // the transition `role="status"` cannot reach, and the reason the fix is
    // honest about its scope: a live region announces *changes*, and an
    // insertion of the region itself is not one.
    //
    // The test exists to be broken on purpose by whoever fixes it properly, with
    // a permanently mounted region (which collides with the count-0 assertion in
    // `e2e/tests/split/swap.spec.ts:326` and with `.swap-banner` as a styled
    // hook at `src/split.css:636`, and needs its own contract amendment).
    expect(banner(screen())).toBeNull();
  });

  it("holds the two sentences apart, so the change that needs announcing is a real change", () => {
    // The copy itself is not this file's subject, but the *difference* between
    // the two states is: a live region only announces what actually changes, and
    // a banner whose text were constant would be a live region with nothing to
    // say. These are the two strings the e2e asserts in the two states.
    const source = readFileSync(new URL("./SplitScreen.tsx", import.meta.url), "utf8");
    expect(source).toContain("Tap one player on each team to swap them.");
    expect(source).toContain("Now tap a player on the other team to swap with");
    expect(source).not.toContain("Now tap a player on the other team to swap with ?");
  });

  it("names the picked player through the one resolver, not a lookup of its own", () => {
    // The `:397` conversion, asserted where the banner is the subject rather
    // than in the resolver's own file. `nameOf` is the single definition of what
    // a roster prints for an id (`src/session/flow.ts:44`), and this surface
    // calls it rather than restating the fallback a ninth time. If the banner
    // went back to `roster.find(...)?.name ?? "?"` this fails on the spot.
    const source = readFileSync(new URL("./SplitScreen.tsx", import.meta.url), "utf8");
    expect(source).toContain("nameOf(roster, pick.playerId)");
    expect(source).not.toContain('roster.find((p) => p.id === pick.playerId)?.name ?? "?"');
  });

  it("leaves the player-row lookup alone, because it is not the same work", () => {
    // `:91` is the other `?? "?"` in this file and it is reported by every
    // sweep. It is **not** a duplicate that survived the resolver's arrival:
    // `player` is bound at `:71` by the lookup that `:73` needs the whole
    // `Player` for, so calling `nameOf(roster, slot.playerId)` here would scan
    // the roster a second time to reprint a value already in hand. Held on
    // purpose; the reason is recorded at `src/session/flow.test.ts`'s header and
    // in `contracts.md`. Asserted so the next sweep reads the reason here too.
    const source = readFileSync(new URL("./SplitScreen.tsx", import.meta.url), "utf8");
    expect(source).toContain('{player?.name ?? "?"}');
    expect(source).not.toContain("nameOf(roster, slot.playerId)");
  });
});
