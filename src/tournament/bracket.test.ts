import { describe, expect, it } from "vitest";
import { applyResult, buildBracket, standings } from "./bracket";
import type { GameResult, Tournament, TournamentTeam } from "../domain/types";

const team = (id: string, strength: number): TournamentTeam => ({
  id,
  bibIndex: 0,
  name: `Team ${id}`,
  strength,
  players: [],
});

/** Teams t1..tN with t1 strongest (seed 1). */
const seeded = (n: number): TournamentTeam[] =>
  Array.from({ length: n }, (_, i) => team(`t${i + 1}`, n - i));

const tourney = (
  format: Tournament["format"],
  teamCount: number,
  opts: { seriesLength?: 1 | 3 | 5; thirdPlace?: boolean } = {},
): Tournament => {
  const t = tourneyWith(format, seeded(teamCount), opts);
  return t;
};

const tourneyWith = (
  format: Tournament["format"],
  teams: TournamentTeam[],
  opts: { seriesLength?: 1 | 3 | 5; thirdPlace?: boolean } = {},
): Tournament => {
  const thirdPlace = opts.thirdPlace ?? true;
  return {
    id: "tour",
    communityId: "c1",
    disciplineId: "futsal",
    name: "Tournament",
    format,
    seriesLength: opts.seriesLength ?? 3,
    teamCount: teams.length,
    thirdPlace,
    createdAt: 1,
    status: "draft",
    teams,
    matches: [],
  };
};

const game = (winnerTeamId: string): GameResult => ({ winnerTeamId });

const ids = (m: Tournament["matches"][number]) => m.id;

describe("buildBracket: series", () => {
  it("builds a single best-of-N match between the two teams", () => {
    const t = buildBracket(tourney("series", 2, { seriesLength: 5 }));
    expect(t.matches).toHaveLength(1);
    const m = t.matches[0];
    expect(ids(m)).toBe("m-1-0");
    expect(m.round).toBe(1);
    expect(m.teamAId).toBe("t1");
    expect(m.teamBId).toBe("t2");
    expect(m.winnerNext).toBeNull();
    expect(m.loserNext).toBeNull();
    expect(t.status).toBe("active");
  });
});

describe("buildBracket: single elimination", () => {
  it("builds a 4-team bracket: semifinals, final, 3rd-place", () => {
    const t = buildBracket(tourney("single-elim", 4));
    const m = new Map(t.matches.map((x) => [x.id, x]));
    expect(t.matches).toHaveLength(4);
    // round 1: bit-reversal seeding 1v3, 2v4
    expect([m.get("m-1-0")!.teamAId, m.get("m-1-0")!.teamBId]).toEqual(["t1", "t3"]);
    expect([m.get("m-1-1")!.teamAId, m.get("m-1-1")!.teamBId]).toEqual(["t2", "t4"]);
    // final and 3rd-place have empty slots
    expect(m.get("m-2-0")!.teamAId).toBeNull();
    expect(m.get("m-2-0")!.teamBId).toBeNull();
    expect(m.get("m-2-1")!.isThirdPlace).toBe(true);
    // routing
    expect(m.get("m-1-0")!.winnerNext).toEqual({ matchId: "m-2-0", slot: "A" });
    expect(m.get("m-1-1")!.winnerNext).toEqual({ matchId: "m-2-0", slot: "B" });
    expect(m.get("m-1-0")!.loserNext).toEqual({ matchId: "m-2-1", slot: "A" });
    expect(m.get("m-1-1")!.loserNext).toEqual({ matchId: "m-2-1", slot: "B" });
  });

  it("omits the 3rd-place match when disabled", () => {
    const t = buildBracket(tourney("single-elim", 4, { thirdPlace: false }));
    expect(t.matches).toHaveLength(3);
    expect(t.matches.some((x) => x.isThirdPlace)).toBe(false);
  });

  it("builds an 8-team bracket with correct seeding and routing", () => {
    const t = buildBracket(tourney("single-elim", 8));
    const m = new Map(t.matches.map((x) => [x.id, x]));
    expect(t.matches).toHaveLength(8); // 4 + 2 + 1 + 1
    // round 1: bit-reversal positions [1,5,3,7,2,6,4,8]
    expect([m.get("m-1-0")!.teamAId, m.get("m-1-0")!.teamBId]).toEqual(["t1", "t5"]);
    expect([m.get("m-1-1")!.teamAId, m.get("m-1-1")!.teamBId]).toEqual(["t3", "t7"]);
    expect([m.get("m-1-2")!.teamAId, m.get("m-1-2")!.teamBId]).toEqual(["t2", "t6"]);
    expect([m.get("m-1-3")!.teamAId, m.get("m-1-3")!.teamBId]).toEqual(["t4", "t8"]);
    // semis feed the final; semi losers feed 3rd-place
    expect(m.get("m-2-0")!.winnerNext).toEqual({ matchId: "m-3-0", slot: "A" });
    expect(m.get("m-2-1")!.winnerNext).toEqual({ matchId: "m-3-0", slot: "B" });
    expect(m.get("m-2-0")!.loserNext).toEqual({ matchId: "m-3-1", slot: "A" });
    expect(m.get("m-2-1")!.loserNext).toEqual({ matchId: "m-3-1", slot: "B" });
    expect(m.get("m-3-1")!.isThirdPlace).toBe(true);
  });

  it("2 teams is a single match with no 3rd-place", () => {
    const t = buildBracket(tourney("single-elim", 2));
    expect(t.matches).toHaveLength(1);
    expect(t.matches[0].winnerNext).toBeNull();
  });
});

describe("buildBracket: swiss", () => {
  it("builds only round 1, pairing adjacent seeds", () => {
    const t = buildBracket(tourney("swiss", 4));
    expect(t.matches).toHaveLength(2);
    expect([t.matches[0].teamAId, t.matches[0].teamBId]).toEqual(["t1", "t2"]);
    expect([t.matches[1].teamAId, t.matches[1].teamBId]).toEqual(["t3", "t4"]);
  });

  it("rounds = ceil(log2 N): 4 teams -> 2, 6 -> 3, 8 -> 3", () => {
    expect(buildBracket(tourney("swiss", 4)).matches.filter((m) => m.round === 1)).toHaveLength(2);
    expect(buildBracket(tourney("swiss", 6)).matches.filter((m) => m.round === 1)).toHaveLength(3);
    expect(buildBracket(tourney("swiss", 8)).matches.filter((m) => m.round === 1)).toHaveLength(4);
  });
});

describe("applyResult: series resolution", () => {
  it("best-of-3 resolves at two wins", () => {
    const t = buildBracket(tourney("series", 2, { seriesLength: 3 }));
    const r = applyResult(t, "m-1-0", [game("t1"), game("t1")]);
    expect(r.matches[0].games).toHaveLength(2);
    expect(r.matches[0].winnerTeamId).toBe("t1");
    expect(r.status).toBe("complete");
  });

  it("best-of-5 needs three wins and records all played games", () => {
    const t = buildBracket(tourney("series", 2, { seriesLength: 5 }));
    const r = applyResult(t, "m-1-0", [game("t1"), game("t2"), game("t1"), game("t2"), game("t1")]);
    expect(r.matches[0].games).toHaveLength(5);
    expect(r.matches[0].winnerTeamId).toBe("t1");
    expect(r.status).toBe("complete");
  });

  it("a series stays undecided while split 1-1", () => {
    const t = buildBracket(tourney("series", 2, { seriesLength: 3 }));
    const r = applyResult(t, "m-1-0", [game("t1"), game("t2")]);
    expect(r.matches[0].winnerTeamId).toBeNull();
    expect(r.status).toBe("active");
  });

  it("rejects a game recorded after the series is decided", () => {
    const t = buildBracket(tourney("series", 2, { seriesLength: 3 }));
    expect(() => applyResult(t, "m-1-0", [game("t1"), game("t1"), game("t2")])).toThrow(/already decided/);
  });

  it("rejects more games than the series length", () => {
    const t = buildBracket(tourney("series", 2, { seriesLength: 3 }));
    expect(() => applyResult(t, "m-1-0", [game("t1"), game("t2"), game("t1"), game("t2")])).toThrow(/at most 3 games/);
  });

  it("rejects a game won by a non-participant (no draws, no third team)", () => {
    const t = buildBracket(tourney("series", 2));
    expect(() => applyResult(t, "m-1-0", [game("t3")])).toThrow(/one of the two teams/);
  });
});

describe("applyResult: single elimination progression", () => {
  it("winners advance, final slots fill, 3rd-place gets the losers", () => {
    let t = buildBracket(tourney("single-elim", 4));
    t = applyResult(t, "m-1-0", [game("t1"), game("t1")]); // t1 beats t3
    t = applyResult(t, "m-1-1", [game("t2"), game("t2")]); // t2 beats t4
    const m = new Map(t.matches.map((x) => [x.id, x]));
    expect(m.get("m-2-0")!.teamAId).toBe("t1");
    expect(m.get("m-2-0")!.teamBId).toBe("t2");
    expect(m.get("m-2-1")!.teamAId).toBe("t3");
    expect(m.get("m-2-1")!.teamBId).toBe("t4");
    expect(t.status).toBe("active");
  });

  it("blocks recording a match whose participants are not yet decided", () => {
    const t = buildBracket(tourney("single-elim", 4));
    expect(() => applyResult(t, "m-2-0", [game("t1")])).toThrow(/ready/i);
  });

  it("completes once the final and 3rd-place are decided, champion = final winner", () => {
    let t = buildBracket(tourney("single-elim", 4));
    t = applyResult(t, "m-1-0", [game("t1"), game("t1")]);
    t = applyResult(t, "m-1-1", [game("t2"), game("t2")]);
    t = applyResult(t, "m-2-0", [game("t1"), game("t2"), game("t1")]);
    expect(t.status).toBe("active"); // 3rd-place still open
    t = applyResult(t, "m-2-1", [game("t3"), game("t3")]);
    expect(t.status).toBe("complete");
    expect(t.matches.find((x) => x.id === "m-2-0")!.winnerTeamId).toBe("t1");
  });
});

describe("applyResult: editing re-settles downstream", () => {
  it("changing a semifinal winner clears downstream games whose participants changed", () => {
    let t = buildBracket(tourney("single-elim", 4));
    t = applyResult(t, "m-1-0", [game("t1"), game("t1")]);
    t = applyResult(t, "m-1-1", [game("t2"), game("t2")]);
    t = applyResult(t, "m-2-0", [game("t1"), game("t2"), game("t1")]); // t1 champion
    // now edit the semi: t3 upsets t1
    t = applyResult(t, "m-1-0", [game("t3"), game("t3")]);
    const final = t.matches.find((x) => x.id === "m-2-0")!;
    expect(final.teamAId).toBe("t3"); // participant changed
    expect(final.games).toEqual([]); // downstream result invalidated
    expect(final.winnerTeamId).toBeNull();
    expect(t.status).toBe("active");
  });

  it("editing one quarterfinal leaves the other half's decided matches intact", () => {
    let t = buildBracket(tourney("single-elim", 8));
    // top half: t1 beats t5; t3 beats t7
    t = applyResult(t, "m-1-0", [game("t1"), game("t1")]);
    t = applyResult(t, "m-1-1", [game("t3"), game("t3")]);
    t = applyResult(t, "m-2-0", [game("t1"), game("t3"), game("t1")]); // semi decided
    // bottom half: t2 beats t6; t4 beats t8
    t = applyResult(t, "m-1-2", [game("t2"), game("t2")]);
    t = applyResult(t, "m-1-3", [game("t4"), game("t4")]);
    t = applyResult(t, "m-2-1", [game("t2"), game("t4"), game("t2")]); // other semi decided
    // now t5 upsets t1 in the top quarter
    t = applyResult(t, "m-1-0", [game("t5"), game("t5")]);
    const topSemi = t.matches.find((x) => x.id === "m-2-0")!;
    const bottomSemi = t.matches.find((x) => x.id === "m-2-1")!;
    expect(topSemi.teamAId).toBe("t5");
    expect(topSemi.games).toEqual([]); // its own subtree invalidated
    expect(bottomSemi.teamAId).toBe("t2");
    expect(bottomSemi.games).toHaveLength(3); // untouched half keeps its result
    expect(bottomSemi.winnerTeamId).toBe("t2");
  });
});

describe("applyResult: swiss", () => {
  it("generates round 2 only after round 1 completes, pairing by record without rematch", () => {
    let t = buildBracket(tourney("swiss", 4));
    expect(t.matches).toHaveLength(2);
    t = applyResult(t, "m-1-0", [game("t1"), game("t1")]); // t1 beats t2
    expect(t.matches).toHaveLength(2); // round 1 incomplete
    t = applyResult(t, "m-1-1", [game("t3"), game("t3")]); // t3 beats t4
    expect(t.matches).toHaveLength(4); // round 2 generated
    const r2 = t.matches.filter((m) => m.round === 2);
    expect(r2).toHaveLength(2);
    // 1-0 group {t1,t3}: t1 vs t3; 0-0 group {t2,t4}: t2 vs t4
    const m = new Map(t.matches.map((x) => [x.id, x]));
    expect([m.get("m-2-0")!.teamAId, m.get("m-2-0")!.teamBId].sort()).toEqual(["t1", "t3"]);
    expect([m.get("m-2-1")!.teamAId, m.get("m-2-1")!.teamBId].sort()).toEqual(["t2", "t4"]);
  });

  it("completes when the last round is decided and standings crown the leader", () => {
    let t = buildBracket(tourney("swiss", 4));
    t = applyResult(t, "m-1-0", [game("t1"), game("t1")]);
    t = applyResult(t, "m-1-1", [game("t3"), game("t3")]);
    t = applyResult(t, "m-2-0", [game("t1"), game("t1")]); // t1 beats t3
    expect(t.status).toBe("active"); // round 2 incomplete
    t = applyResult(t, "m-2-1", [game("t2"), game("t2")]);
    expect(t.status).toBe("complete");
    const table = standings(t);
    expect(table[0].teamId).toBe("t1"); // 2 wins, strongest
    expect(table[1].teamId).toBe("t2");
    expect(table.map((s) => s.teamId)).toEqual(["t1", "t2", "t3", "t4"]);
  });

  it("standings tiebreak: wins, then strength, then game wins", () => {
    const teams = [team("a", 5), team("b", 4), team("c", 3), team("d", 2)];
    let t = buildBracket(tourneyWith("swiss", teams));
    t = applyResult(t, "m-1-0", [game("a"), game("a")]);
    t = applyResult(t, "m-1-1", [game("c"), game("c")]);
    t = applyResult(t, "m-2-0", [game("a"), game("c"), game("a")]); // a beats c 2-1
    t = applyResult(t, "m-2-1", [game("d"), game("d")]);
    const table = standings(t);
    // a: 2 wins; then 1-win teams by strength desc: c(3) before d(2); b: 0 wins
    expect(table[0].teamId).toBe("a");
    expect(table[1].teamId).toBe("c");
    expect(table[2].teamId).toBe("d");
    expect(table[3].teamId).toBe("b");
  });

  it("avoids rematches when pairing round 2 of a 6-team swiss", () => {
    let t = buildBracket(tourney("swiss", 6));
    // round 1: (t1,t2) t1 wins, (t3,t4) t3 wins, (t5,t6) t5 wins
    t = applyResult(t, "m-1-0", [game("t1"), game("t1")]);
    t = applyResult(t, "m-1-1", [game("t3"), game("t3")]);
    t = applyResult(t, "m-1-2", [game("t5"), game("t5")]);
    const r2 = t.matches.filter((m) => m.round === 2);
    expect(r2).toHaveLength(3);
    const played = new Set<string>();
    for (const m of r2) {
      const key = [m.teamAId, m.teamBId].sort().join(":");
      expect(played.has(key)).toBe(false);
      played.add(key);
    }
    // all six teams play in round 2
    const participants = new Set(r2.flatMap((m) => [m.teamAId, m.teamBId]));
    expect(participants.size).toBe(6);
  });
});
