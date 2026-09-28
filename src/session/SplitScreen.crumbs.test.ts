import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SplitScreen } from "./SplitScreen";
import { freshSplit } from "./edit";
import { FUTSAL_DISCIPLINE } from "../domain/seed";
import type { Session } from "../domain/types";
import type { SplitSource } from "../shell/useSplitFlow";

const ROLES = ["goalkeeper", "defender", "winger", "pivot"];

const NAMES = ["Budi", "Andi", "Cici", "Dedi", "Eka", "Fitri", "Gita", "Hadi", "Intan", "Joko"];

const ROSTER = NAMES.map((name, i) => ({
  communityId: "c1",
  id: `p${i}`,
  name,
  capabilities: [
    {
      disciplineId: FUTSAL_DISCIPLINE.id,
      attributeRatings: { technical: 5 - (i % 4), fitness: 4 - (i % 3), "game-iq": 3 + (i % 3) },
      eligibleRoles: ROLES,
      preferredRole: null,
    },
  ],
}));

const SESSION: Session = {
  id: "s1",
  communityId: "c1",
  disciplineId: FUTSAL_DISCIPLINE.id,
  createdAt: 0,
  poolPlayerIds: ROSTER.map((p) => p.id),
  settings: { teamCount: 2 },
  result: freshSplit(
    ROSTER.map((p) => p.id),
    ROSTER,
    FUTSAL_DISCIPLINE,
    { teamCount: 2 },
  ),
};

const split = (source: SplitSource, onBack?: () => void) =>
  renderToStaticMarkup(
    createElement(SplitScreen, {
      session: SESSION,
      discipline: FUTSAL_DISCIPLINE,
      roster: ROSTER,
      onPersistResult: async () => {},
      source,
      onBack,
    }),
  );

const crumbOf = (html: string) => html.match(/<div class="breadcrumb">.*?<\/div>/)?.[0] ?? "";

const backButtonOf = (html: string) => html.match(/data-testid="back-button"[^>]*>(.*?)<\/button>/)?.[1] ?? "";

describe("SplitScreen breadcrumb", () => {
  it.each([
    ["ad-hoc", "Match setup"],
    ["tournament", "Match setup"],
    ["session", "History"],
    ["squad", "Squad detail"],
  ] as const)("a %s split names the destination it actually returns to", (source, label) => {
    const html = split(source, () => {});
    // One separator, two segments, and the first is a live link — the block it
    // replaced called preventDefault and nothing else.
    expect(crumbOf(html)).toBe(
      `<div class="breadcrumb"><a href="#">${label}</a><span class="sep">/</span><span>Split result</span></div>`,
    );
    // The crumb and the button claim the same destination, from one source.
    expect(backButtonOf(html)).toBe(`← ${label}`);
  });

  it("renders the first crumb as text when there is nowhere to go back to", () => {
    // The Landing Page mounts this screen with onBack undefined.
    expect(crumbOf(split("ad-hoc", undefined))).toBe(
      '<div class="breadcrumb"><span>Match setup</span><span class="sep">/</span><span>Split result</span></div>',
    );
    expect(backButtonOf(split("ad-hoc", undefined))).toBe("");
  });
});
