import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TournamentScreen } from "./TournamentScreen";
import { applyResult, buildBracket, champion, standings } from "./bracket";
import type { Tournament, TournamentFormat, TournamentTeam } from "../domain/types";
import { FUTSAL_DISCIPLINE } from "../domain/seed";

/**
 * A round robin has no final, so nothing on its screen may name one.
 *
 * That is a copy contract, not a layout one, and it is the same class of bug as
 * the completion bug Task 7 fixed: a surface naming a thing the format does not
 * have. The word arrives from `BracketView`, which labels the last column "Final"
 * — correct there, false here — so what is pinned is that the round-robin
 * tournament renders on the standings side of that choice and never reaches the
 * word. The single-elimination case is asserted too, so a test that stopped
 * rendering any bracket at all could not pass.
 */

const team = (id: string, strength: number): TournamentTeam => ({
  id,
  bibIndex: 0,
  name: `Team ${id}`,
  strength,
  players: [],
});

const tourney = (format: TournamentFormat, n: number, seriesLength: 1 | 3 | 5 = 1): Tournament => ({
  id: "tour",
  communityId: "c1",
  disciplineId: FUTSAL_DISCIPLINE.id,
  name: "Tournament",
  format,
  seriesLength,
  teamCount: n,
  thirdPlace: true,
  createdAt: 1,
  status: "draft",
  teams: Array.from({ length: n }, (_, i) => team(`t${i + 1}`, n - i)),
  matches: [],
});

/** A match won by the team listed first, across the whole series length. */
const wins = (m: Tournament["matches"][number], seriesLength: number) =>
  Array.from({ length: seriesLength }, () => ({ winnerTeamId: m.teamAId! }));

const playEveryMatch = (t: Tournament): Tournament =>
  t.matches.reduce((acc, m) => applyResult(acc, m.id, wins(m, acc.seriesLength)), t);

/** The screen as the browser would get it, for a tournament that has been played. */
const render = (t: Tournament): string =>
  renderToStaticMarkup(
    createElement(TournamentScreen, {
      tournament: t,
      disciplines: [FUTSAL_DISCIPLINE],
      onBack: () => {},
      onSplit: () => {},
      onRecord: async () => {},
      onUndo: async () => {},
      onDelete: async () => {},
    }),
  );

/** One recorded match is enough to leave the review panel and show the table. */
const started = (t: Tournament): Tournament => applyResult(t, t.matches[0].id, wins(t.matches[0], t.seriesLength));

describe("TournamentScreen: a round robin names no final", () => {
  it("renders its rounds and its table, and never the word Final", () => {
    const html = render(started(buildBracket(tourney("round-robin", 3))));

    // Three teams, three rounds, one match each: every team plays every other.
    expect(html).toContain("Round 1");
    expect(html).toContain("Round 2");
    expect(html).toContain("Round 3");
    expect(html.match(/class="standings-row"/g)).toHaveLength(3);
    expect(html).not.toContain("Final");
  });

  it("crowns the standings leader when the last fixture is recorded", () => {
    const played = playEveryMatch(buildBracket(tourney("round-robin", 3)));
    expect(played.status).toBe("complete");

    const html = render(played);
    const leader = champion(played)!;
    expect(leader).not.toBeNull();
    expect(html).toContain(leader.name);
    expect(html).not.toContain("Final");
  });

  it("stays out of the word on a 5-team field too, where the byes are", () => {
    // Five teams is the size that used to dead-end, and its five rounds are the
    // ones with a bye in four of them: no round is a final because no round
    // decides the field.
    const html = render(started(buildBracket(tourney("round-robin", 5))));
    expect(html).toContain("Round 5");
    expect(html.match(/class="standings-row"/g)).toHaveLength(5);
    expect(html).not.toContain("Final");
  });

  it("leaves the word exactly where it is true: a single-elim final", () => {
    // The contrast case. Without it, "no Final" would pass on a screen that
    // renders no bracket at all, which is not the claim being made.
    const html = render(started(buildBracket(tourney("single-elim", 4))));
    expect(html).toContain("Final");
    expect(html).toContain("Round 1");
  });
});

describe("TournamentScreen: a round robin's standings order is the table's", () => {
  it("lists the leader first, from the same standings() the champion reads", () => {
    const played = playEveryMatch(buildBracket(tourney("round-robin", 3)));
    const order = standings(played).map((r) => r.teamId);
    const html = render(played);

    const positions = order.map((id) => html.indexOf(`Team ${id}`));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(order[0]).toBe(champion(played)!.id);
  });
});
