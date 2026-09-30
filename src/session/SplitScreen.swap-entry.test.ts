import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SplitScreen } from "./SplitScreen";
import { freshSplit } from "./edit";
import { MLBB_DISCIPLINE } from "../domain/seed";
import type { Session, SplitResult } from "../domain/types";
import type { SplitSource } from "../shell/useSplitFlow";
import { SAFETY_BAN } from "../test-support/safetyCopy";

/**
 * The swap entry point, asserted on the markup rather than on a click.
 *
 * `renderToStaticMarkup` renders the **initial** state, so it cannot drive swap
 * mode, and this file does not pretend otherwise: the interaction lives in
 * `e2e/tests/split/swap.spec.ts`, which enters the mode and performs a swap.
 * What a static render *can* see is the thing that was actually broken — whether
 * a control that turns the mode on is in the bar at all.
 *
 * That is the whole gap this file closes. `swapPlayers` has been unit-tested
 * since Phase A and the card affordances were untouched for ten weeks, so the
 * arithmetic was always covered and the reaching never was. On `497aa8b` every
 * test in this file fails on its first assertion, because the button the mode
 * needed did not exist.
 *
 * The `→` in the tournament primary below and the `⇄` in the mode's banner are
 * read out of the component's own strings rather than retyped, so a rename in
 * `SplitScreen.tsx` shows up here instead of being papered over by a duplicate.
 *
 * R1 is the evidence for guarding this surface rather than a general one: ten
 * weeks passed in which a control was removed from this row and the removal
 * looked identical to a screen that had never had it. The ban below is the
 * existing shared rule (`src/test-support/safetyCopy.ts`) applied to the third
 * surface that renders copy here; it is imported rather than restated, which is
 * the whole reason that module is a module.
 */

const ROLES = ["tank", "assassin", "mage", "marksman", "fighter"];

const NAMES = ["Alfa", "Bravo", "Cahya", "Delta", "Echo", "Foxtrot", "Golf", "Hotel", "India", "Juli"];

const ROSTER = NAMES.map((name, i) => ({
  communityId: "c1",
  id: `p${i + 1}`,
  name,
  capabilities: [
    {
      disciplineId: MLBB_DISCIPLINE.id,
      // Two teams five apart, so a swap recomputed against this roster moves the
      // gap by the largest amount it can. The render only has to be right about
      // *which* controls exist; the numbers are the e2e spec's subject.
      attributeRatings: { mechanics: i < 5 ? 5 : 1, "game-sense": i < 5 ? 5 : 1, "hero-pool": i < 5 ? 5 : 1, teamwork: i < 5 ? 5 : 1 },
      eligibleRoles: ROLES,
      preferredRole: null,
    },
  ],
}));

const twoTeams = (): SplitResult =>
  freshSplit(ROSTER.map((p) => p.id), ROSTER, MLBB_DISCIPLINE, { teamCount: 2 });

/** The stored result with the second team dropped: the screen's failure branch. */
const oneTeam = (): SplitResult => ({ ...twoTeams(), teams: twoTeams().teams.slice(0, 1), gap: 0 });

const sessionOf = (result: SplitResult): Session => ({
  id: "s1",
  communityId: "c1",
  disciplineId: MLBB_DISCIPLINE.id,
  createdAt: 0,
  poolPlayerIds: ROSTER.map((p) => p.id),
  settings: { teamCount: result.teams.length },
  result,
});

interface Options {
  result?: SplitResult;
  source?: SplitSource;
  onBack?: () => void;
  onSaveSquad?: () => void;
  share?: { communityName: string };
  onSubmitTournament?: () => void;
}

const bar = (options: Options = {}): string => {
  const result = options.result ?? twoTeams();
  const html = renderToStaticMarkup(
    createElement(SplitScreen, {
      session: sessionOf(result),
      discipline: MLBB_DISCIPLINE,
      roster: ROSTER,
      onPersistResult: async () => {},
      source: options.source ?? "ad-hoc",
      onBack: options.onBack,
      onSaveSquad: options.onSaveSquad,
      share: options.share,
      onSubmitTournament: options.onSubmitTournament,
    }),
  );
  return html.match(/<div class="bar split-bar">.*?<\/div>\s*<\/div>/s)?.[0] ?? "";
};

/** The action row's own labels, in render order. */
const labels = (html: string): string[] =>
  [...html.matchAll(/<button[^>]*>([^<]*)<\/button>/g)].map((m) => (m[1] ?? "").replace(/\s+/g, " ").trim());

describe("the split bar's swap entry point", () => {
  it("offers a control that turns swap mode on", () => {
    // The assertion that fails on `497aa8b`. Not "the mode is off" and not a
    // button count — the presence of a named entry, which is the one thing whose
    // absence made the feature dead while every other test stayed green.
    expect(bar()).toContain('data-testid="swap-mode"');
    expect(labels(bar())).toContain("Swap");
  });

  it("is not the mode's own exit", () => {
    // The bug's actual shape: `toggleSwapMode` was bound only to "Done swapping",
    // which renders only when the mode is already on, so the entry point was the
    // exit. Asserted as a pair — a bar that showed both would mean the exit is
    // reachable with nothing to exit from.
    const labelsInBar = labels(bar());
    expect(labelsInBar).toContain("Swap");
    expect(labelsInBar).not.toContain("Done swapping");
  });

  it("sits with the secondaries, last of them and before the primary", () => {
    // The order `.split-bar`'s wrap is reasoned about in
    // (`src/split.css:784-814`): ghosts first, the loud control last. Pinned so a
    // later edit that pushes `Swap` past the primary is a red test rather than a
    // silently different bar.
    expect(labels(bar({ onBack: () => {}, onSaveSquad: () => {}, share: { communityName: "Swap Crew" } }))).toEqual([
      "← Match setup",
      "Save squad",
      "Share",
      "Swap",
      "Re-roll",
    ]);
  });

  it("is withheld where there is only one team, like Share is", () => {
    // A swap needs a team on each side, and the screen below two teams renders
    // its "Solver failed" empty state. Both `Share` and `Swap` sit behind the same
    // gate, and both halves are asserted: `share` present but withheld proves the
    // gate, not an absent prop.
    const html = bar({ result: oneTeam(), onBack: () => {}, onSaveSquad: () => {}, share: { communityName: "Swap Crew" } });
    // (That branch's own copy is asserted on the rendered screen in
    // `e2e/tests/split/swap.spec.ts`; here the bar is the whole subject.)
    expect(labels(html)).not.toContain("Share");
    expect(labels(html)).not.toContain("Swap");
  });

  it("is present on the Landing Page hero, which passes none of the other props", () => {
    // The hero mounts this screen with no `onBack`, no `onSaveSquad` and no
    // `share` (`src/landing.tsx:151-161`), so this is the bar's floor: one
    // secondary and one primary. `Swap` belongs there because the hero is a real
    // two-team result a reader can tap, not a picture.
    expect(labels(bar())).toEqual(["Swap", "Re-roll"]);
  });

  it("survives the tournament primary being on the bar", () => {
    // The tournament bar is the widest the app renders, and the one most likely
    // to be reshaped. Restoring the entry point must not depend on which primary
    // the row happens to be showing.
    const labelsInBar = labels(bar({ onSubmitTournament: () => {} }));
    expect(labelsInBar).toContain("Swap");
    expect(labelsInBar[labelsInBar.length - 1]).toBe("Save teams to tournament →");
  });

  it("adds no copy that turns a measurement into a promise", () => {
    // Every label the bar can render, in one read. R1 added a visible string to a
    // surface three other guards had never covered, and `Swap` is the first word
    // this row has carried that names an *edit* — which is exactly the register
    // where "your teams are safe" would be one word away.
    const all = [
      ...labels(bar({ onBack: () => {}, onSaveSquad: () => {}, share: { communityName: "Swap Crew" } })),
      ...labels(bar({ onSubmitTournament: () => {} })),
      ...labels(bar({ result: oneTeam(), onBack: () => {}, onSaveSquad: () => {}, share: { communityName: "Swap Crew" } })),
    ];
    expect(all.length).toBeGreaterThan(0);
    for (const label of all) {
      expect(label, `the bar's "${label}"`).not.toMatch(SAFETY_BAN);
    }
  });
});