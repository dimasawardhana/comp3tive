import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DashboardScreen } from "./DashboardScreen";
import { SAFETY_BAN } from "./test-support/safetyCopy";
import type { Community, Player } from "./domain/types";

/**
 * The nudge is a request, the note on the roster is a status, and this file
 * pins the request's half: it appears when the hook says it should, it says one
 * thing, and the only way out of it is a button the caller supplied.
 *
 * What a static render cannot see, and where each piece of that is covered
 * instead: whether the hook decided to raise it at all (`useDurability.test.ts`
 * and `decideDurability` there), what the browser answered (`probePersistence`),
 * whether the Dismiss button survives a reload (e2e), and whether the two
 * sit where they are supposed to (e2e, which has layout — this does not).
 */

const COMMUNITY: Community = { id: "c1", name: "Thursday Crew", createdAt: 0 };

/** Six players, so the roster is over the nudge's floor; the screen only counts. */
const PLAYERS: Player[] = Array.from({ length: 6 }, (_, i) => ({
  id: `p${i + 1}`,
  communityId: "c1",
  name: `Player ${i + 1}`,
  capabilities: [],
}));

const NUDGE_COPY =
  "This browser does not promise to keep this app's data. Export a backup from Roster.";

const screen = (nudge: { onDismiss: () => void } | null): string =>
  renderToStaticMarkup(
    createElement(DashboardScreen, {
      community: COMMUNITY,
      players: PLAYERS,
      squads: [],
      tournaments: [],
      disciplines: [],
      onSplitMatch: () => {},
      onNewTournament: () => {},
      onBrowseSquads: () => {},
      onAddPlayer: () => {},
      onOpenPlayer: () => {},
      onOpenTournament: () => {},
      nudge,
    }),
  );

/** The nudge's own sentence, decoded out of the markup and nothing else. */
const nudgeText = (html: string): string => {
  const msg = /<span class="nudge-msg">([\s\S]*?)<\/span>/.exec(html);
  if (msg === null) throw new Error("the nudge did not render");
  return msg[1].replace(/\s+/g, " ").replaceAll("&#x27;", "'").trim();
};

describe("the dashboard's export nudge", () => {
  it("renders no row at all when the hook raised nothing", () => {
    // Not hidden, not collapsed: absent. A `display: none` nudge is still in the
    // accessibility tree and still read by a screen reader.
    expect(screen(null)).not.toContain("nudge");
  });

  it("says one thing, and it is not a promise", () => {
    expect(nudgeText(screen({ onDismiss: () => {} }))).toBe(NUDGE_COPY);
    // The shared ban, so this file and the note's cannot drift apart.
    expect(NUDGE_COPY).not.toMatch(SAFETY_BAN);
  });

  it("asks for a backup the app can actually produce, and says where", () => {
    // "from Roster" is not decoration: the Export control lives in the roster
    // toolbar, so a nudge that said only "export" would be a request with no
    // address.
    expect(NUDGE_COPY).toContain("Export a backup from Roster.");
  });

  it("offers the caller's dismissal, and nothing else", () => {
    const html = screen({ onDismiss: () => {} });
    expect(html).toMatch(/<button type="button" class="link">Dismiss<\/button>/);
    // One button. A nudge that also offered "Remind me later" would be a
    // second policy wearing the first one's clothes.
    expect(html.match(/<button/g) ?? []).toHaveLength(
      (screen(null).match(/<button/g) ?? []).length + 1,
    );
  });

  it("is not a live region, and should not become one without a change here", () => {
    // Recorded because the attribute is a plausible-looking "accessibility
    // improvement" to add back. It is not one. A live region announces its
    // *changes*: the nudge is inserted into the DOM with its sentence already
    // inside it, in the same commit, so `role="status"` would announce nothing
    // — and to make it announce, the row would have to first be rendered empty
    // and filled in afterwards, which costs every session a permanently present
    // wrapper to serve a case this markup does not currently meet. The nudge is
    // in reading order with a real 44px button, which is what a screen reader
    // needs to reach it.
    // Scoped to the nudge: the Dashboard's other rows legitimately carry roles.
    expect(screen({ onDismiss: () => {} })).toMatch(/<div class="nudge">/);
  });

  it("sits between the stat cards and the first teaser, leaving both in place", () => {
    const html = screen({ onDismiss: () => {} });
    const stats = html.indexOf('class="dashboard-stats"');
    const nudge = html.indexOf('class="nudge"');
    const teasers = html.indexOf('class="dashboard-teasers"');
    expect(nudge).toBeGreaterThan(stats);
    expect(nudge).toBeLessThan(teasers);
    expect(html.match(/dashboard-stat"/g) ?? []).toHaveLength(3);
  });
});
