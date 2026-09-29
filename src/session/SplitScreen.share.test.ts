import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SplitScreen } from "./SplitScreen";
import { freshSplit, recomputeResult } from "./edit";
import { FUTSAL_DISCIPLINE } from "../domain/seed";
import type { Player, Session, SplitResult } from "../domain/types";
import type { SplitSource } from "../shell/useSplitFlow";

const ROLES = ["goalkeeper", "defender", "winger", "pivot"];

const ROSTER: Player[] = ["Andi", "Budi", "Citra", "Dewi", "Eka", "Fajar", "Gita", "Hana", "Irfan", "Joko"].map(
  (name, i) => ({
    id: `p${i + 1}`,
    communityId: "c1",
    name,
    capabilities: [
      {
        disciplineId: FUTSAL_DISCIPLINE.id,
        attributeRatings: { technical: 5 - (i % 4), fitness: 4 - (i % 3), "game-iq": 3 + (i % 3) },
        eligibleRoles: ROLES,
        preferredRole: null,
      },
    ],
  }),
);

const TWO_TEAMS = freshSplit(ROSTER.map((p) => p.id), ROSTER, FUTSAL_DISCIPLINE, { teamCount: 2 });

/** Exactly what `fairSplit` returns for an empty pool (`src/solver/solver.ts:455`). */
const NO_TEAMS: SplitResult = {
  teams: [],
  gap: 0,
  flags: [],
  unassigned: [],
  solver: { optimal: true, nodesExplored: 0, elapsedMs: 0 },
};

/**
 * One team, proven, with five roster players left off — the shape a partial
 * role cover produces. `recomputeResult` is what stamps it, so the totals,
 * the `leftover` flags and the unassigned ids come from the module that owns
 * them rather than from this file. The screen renders this as "Solver failed"
 * (the ternary is `=== 2`, then `> 2`, else empty), so the bar above it must
 * not offer to share it.
 */
const ONE_TEAM: SplitResult = recomputeResult(
  [{ index: 0, slots: ROSTER.slice(0, 5).map((p) => ({ playerId: p.id, roleId: null })), totalStrength: 0, avgStrength: 0 }],
  FUTSAL_DISCIPLINE,
  ROSTER.slice(5).map((p) => p.id),
  ROSTER,
  { optimal: true, nodesExplored: 2, elapsedMs: 1 },
);

const session = (result: SplitResult): Session => ({
  id: "s1",
  communityId: "c1",
  disciplineId: FUTSAL_DISCIPLINE.id,
  createdAt: 0,
  poolPlayerIds: ROSTER.map((p) => p.id),
  settings: { teamCount: result.teams.length },
  result,
});

const screen = (share: { communityName: string } | undefined, result: SplitResult = TWO_TEAMS, source: SplitSource = "ad-hoc") =>
  renderToStaticMarkup(
    createElement(SplitScreen, {
      session: session(result),
      discipline: FUTSAL_DISCIPLINE,
      roster: ROSTER,
      onPersistResult: async () => {},
      source,
      share,
    }),
  );

describe("the Share control on the split screen", () => {
  it("offers Share when the app passes a community to share into", () => {
    // Fails if the `share` prop is not destructured, or the button is gated on
    // something the app does not supply — the entry point is then unreachable
    // and the sheet ships with nothing that ever opens it.
    const html = screen({ communityName: "Thursday Crew" });
    expect(html).toContain('data-testid="share-teams"');
    expect(html).toMatch(/data-testid="share-teams"[^>]*>\s*Share\s*<\/button>/);
  });

  it("offers no Share control where the prop is absent, as on the landing hero", () => {
    // The Landing Page mounts this same screen (`src/landing.tsx:151-161`) with
    // no `share`, and `e2e/tests/landing/landing.spec.ts` requires the hero to
    // render. Asserted on the whole document rather than a testid lookup, so a
    // renamed attribute cannot make this pass vacuously — the same reasoning as
    // `SplitScreen.crumbs.test.ts:83`. Fails if the prop's absence stops mattering
    // and every split screen grows a Share button, including the public one.
    expect(screen(undefined)).not.toContain("share-teams");
  });

  it("offers no Share control when the solver produced fewer than two teams", () => {
    // The empty state ("Solver failed") and `.split-bar` coexist: the bar
    // renders outside the teams ternary. Sharing there would emit a team count
    // and a gap verdict for an arrangement the screen itself is calling a
    // failure, under the app's own fairness claim, in a group chat.
    // Fails if the gate is dropped back to `share && !swapMode`, or loosened to
    // `> 0` — a one-team result renders this same empty state, and would send
    // "1 teams" with a "proven minimum" verdict for one team plus five
    // benched players.
    expect(screen({ communityName: "Thursday Crew" }, NO_TEAMS)).not.toContain("share-teams");
    expect(screen({ communityName: "Thursday Crew" }, ONE_TEAM)).not.toContain("share-teams");
  });

  it("keeps the sheet closed until Share is pressed", () => {
    // Fails if the sheet is mounted unconditionally — it would cover the split
    // on arrival, and a share surface nobody asked for is a share surface that
    // can be dismissed without reading.
    const html = screen({ communityName: "Thursday Crew" });
    expect(html).not.toContain("share-preview");
    expect(html).not.toContain("modal-overlay");
  });
});
