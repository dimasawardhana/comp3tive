import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as ts from "typescript";
import { explainFairness } from "./fairness";
import { closingLine, teamsAsText } from "./share-text";
import { FUTSAL_DISCIPLINE } from "../domain/seed";
import { strengthOf } from "../session/flow";
import type { Player, SplitResult, TeamAssignment } from "../domain/types";

/**
 * Every word that belongs to the gap's provenance verdict, plus the em-dash
 * rule (`DESIGN.md:200`). Checked against this module's output and against its
 * own copy, so a banned word is unavailable rather than merely absent.
 */
const BANNED = ["proven", "best gap", "best-found", "exact", "minimum", "optimal", "solver", "search", "node", "heuristic", "aborted"];
const EM_DASH = "\u2014";

const cap = (technical: number, fitness: number, gameIq: number) => ({
  disciplineId: "futsal",
  attributeRatings: { technical, fitness, "game-iq": gameIq },
  eligibleRoles: ["goalkeeper", "defender", "winger", "pivot"],
  preferredRole: null,
});

const player = (id: string, name: string, ratings?: [number, number, number]): Player => ({
  id,
  communityId: "c1",
  name,
  capabilities: ratings ? [cap(...ratings)] : [],
});

/** Strengths: Andi 5.0, Budi 4.0, Gita 4.0, Eka 3.0, Fajar 3.0, Citra 2.0, Bela 2.0, Dewi none. */
const ROSTER: Player[] = [
  player("p1", "Andi", [5, 5, 5]),
  player("p2", "Budi", [4, 4, 4]),
  player("p3", "Citra", [2, 2, 2]),
  player("p4", "Dewi"),
  player("p5", "Eka", [3, 3, 3]),
  player("p6", "Fajar", [4, 2, 3]),
  player("p7", "Gita", [4, 4, 4]),
  player("p8", "Bela", [2, 2, 2]),
];

/** The three records the verdict is chosen from (`src/session/edit.ts:72` for the last). */
const BEST_FOUND: SplitResult["solver"] = { optimal: false, nodesExplored: 4_000_001, elapsedMs: 900 };
const PROVEN: SplitResult["solver"] = { optimal: true, nodesExplored: 51, elapsedMs: 6 };
const HAND_EDITED: SplitResult["solver"] = { optimal: false, nodesExplored: 0, elapsedMs: 0 };

/**
 * A team whose numbers follow `recomputeResult` (`src/session/edit.ts:74-81`): a
 * slot whose player has no capability in the discipline counts as 0 toward the
 * average, which is how an organiser's own rearrangement reaches this module.
 */
function team(index: number, ids: string[]): TeamAssignment {
  const total = ids.reduce((sum, id) => {
    const found = ROSTER.find((p) => p.id === id);
    return sum + (found ? strengthOf(found, FUTSAL_DISCIPLINE) ?? 0 : 0);
  }, 0);
  return {
    index,
    slots: ids.map((playerId) => ({ playerId, roleId: null })),
    totalStrength: total,
    avgStrength: total / Math.max(1, ids.length),
  };
}

const split = (teams: TeamAssignment[], extra: Partial<SplitResult> = {}): SplitResult => {
  const gap = teams.length >= 2
    ? Math.max(...teams.map((t) => t.avgStrength)) - Math.min(...teams.map((t) => t.avgStrength))
    : 0;
  return { teams, gap, flags: [], unassigned: [], solver: BEST_FOUND, ...extra };
};

/** A pair 0.5 apart: the widest band, and the shape the app usually shows. */
const BAND = split([team(0, ["p1", "p6"]), team(1, ["p2", "p5"])]);
/** The same four rated players as BAND, rearranged onto one number. */
const EVEN = split([team(0, ["p1", "p5"]), team(1, ["p2", "p7"])]);
/** The same four rated players as EVEN, moved off one number. */
const UNEVEN = split([team(0, ["p1", "p7"]), team(1, ["p2", "p5"])]);
/** A hand-edited team holding someone with no futsal capability: 0 + 5 over two. */
const WITH_AN_UNRATED = split([team(0, ["p4", "p1"]), team(1, ["p2"])]);
/** One side is nobody this discipline rates at all. */
const ONE_UNRATED_SIDE = split([team(0, ["p1"]), team(1, ["p4"])]);
const THREE_TEAMS = split([team(0, ["p1", "p6"]), team(1, ["p2", "p5"]), team(2, ["p3", "p7"])]);
/** Two people the split dropped, one of them rated. */
const WITH_SITS = split([team(0, ["p1", "p6"]), team(1, ["p2", "p5"])], { unassigned: ["p4", "p3"] });
/**
 * The same two people dropped from an even split, which is where the not-playing
 * clause has to survive a `trade` that is empty. The empty string is the case
 * that loses the sentence, and the clause lives in the other field for exactly
 * that reason.
 */
const EVEN_WITH_SITS = split(EVEN.teams, { unassigned: ["p4", "p3"] });
/** An id no roster holds, which is what a stale result looks like. */
const WITH_A_STALE_ID = split([team(0, ["p1", "p6"]), team(1, ["p2", "p5"])], { unassigned: ["pX"] });
/**
 * The same stale id against an even split, so the unknown player is the whole
 * list and nothing follows it. It is the shape where a closing mark would be
 * the reader's last character.
 */
const EVEN_WITH_A_STALE_ID = split(EVEN.teams, { unassigned: ["pX"] });
const ONE_TEAM = split([team(0, ["p1", "p6"])]);
const NO_TEAMS = split([]);

const input = (result: SplitResult) => ({ result, discipline: FUTSAL_DISCIPLINE, roster: ROSTER });
const shareInput = (result: SplitResult) => ({
  communityName: "Thursday Crew",
  disciplineName: "Futsal",
  discipline: FUTSAL_DISCIPLINE,
  result,
  roster: ROSTER,
});

/**
 * Words of five letters or more, less the organiser's own names. The names come
 * out of the roster and are not copy, so leaving them in would make the overlap
 * check below compare a player with a sentence.
 */
function copyWords(sentence: string): Set<string> {
  const names = new Set(ROSTER.map((p) => p.name.toLowerCase()));
  return new Set((sentence.toLowerCase().match(/[a-z]+/g) ?? []).filter((w) => w.length >= 5 && !names.has(w)));
}

/** The label the three surfaces anchor a sit-out list on. */
const NOT_PLAYING = "Not playing: ";

/**
 * The line a screen prints: `averages`, then `trade`, one space between, which
 * is how `FairnessLine` composes them. The two fields are half a sentence each
 * and the reader sees one line, so a claim about the sentence is a claim about
 * this string and never about one field.
 */
const composedLine = (result: SplitResult): string => {
  const { averages, trade } = explainFairness(input(result));
  return `${averages}${trade ? ` ${trade}` : ""}`;
};

/**
 * The sit-outs as a reader counts them: the run after the label, read forward
 * as comma-separated names and stopped at the first character that cannot be
 * part of a name or of the comma between two.
 *
 * The stop is the whole claim. A reader ends the list on a mark, and a list
 * that never ends goes on eating the sentence that follows it, so any mark
 * satisfies this and none is named. Naming one here would make the test a
 * restatement of the fix instead of a statement about the line.
 */
function sitOuts(line: string): string[] {
  const at = line.indexOf(NOT_PLAYING);
  if (at < 0) return [];
  const run = line.slice(at + NOT_PLAYING.length);
  const end = run.search(/[^'\p{L}\p{N}, ]/u);
  return run.slice(0, end < 0 ? run.length : end).split(", ").map((piece) => piece.trim());
}

const MODULE_AST = ts.createSourceFile(
  "fairness.ts",
  readFileSync(new URL("./fairness.ts", import.meta.url), "utf8"),
  ts.ScriptTarget.ESNext,
  true,
  ts.ScriptKind.TS,
);

function walk(node: ts.Node, visit: (node: ts.Node) => void): void {
  visit(node);
  ts.forEachChild(node, (child) => walk(child, visit));
}

/** Every literal a reader could see: quoted strings, and each piece of a template. */
function copyLiterals(file: ts.SourceFile): string[] {
  const found: string[] = [];
  walk(file, (node) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) found.push(node.text);
    else if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) found.push(node.text);
  });
  return found;
}

function importedPaths(file: ts.SourceFile): string[] {
  const found: string[] = [];
  walk(file, (node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) found.push(node.moduleSpecifier.text);
  });
  return found;
}

describe("explainFairness", () => {
  it("states the range every team's average falls inside", () => {
    // Fails if the band is built from `result.gap` (0.5 here, so the copy would
    // read 0.0 to 0.5) or from the first and last team in `teams` rather than
    // the two ends of the sort, which reorder them.
    expect(explainFairness(input(BAND)).averages).toBe("Every team averages 3.5 to 4.0.");
  });

  it("uses the singular form when every team lands on the same number", () => {
    // Fails if the branch tests `result.gap === 0` instead of the two formatted
    // ends: a hand edit leaves a gap of 0.04 that both ends round to 4.0, and
    // then the copy would claim a 4.0 to 4.0 band nobody can read.
    const handRounded: SplitResult = {
      ...EVEN,
      teams: EVEN.teams.map((t) => ({ ...t, avgStrength: t.index === 0 ? 4.02 : 3.98 })),
      gap: 0.04,
    };
    expect(explainFairness(input(EVEN)).averages).toBe("Every team averages 4.0.");
    expect(explainFairness(input(handRounded)).averages).toBe("Every team averages 4.0.");
  });

  it("sets the strongest player on the higher-averaging team against the weakest on the lower", () => {
    // Fails if the sides are taken by index instead of by average, if the
    // stronger player is read off the weaker side, or if `teamName` is bypassed
    // for a literal "Team A" (the two-team shape is where that pair coincide).
    expect(explainFairness(input(UNEVEN)).trade).toBe(
      "Andi (5.0) is Team A's best; Eka (3.0) is Team B's weakest.",
    );
  });

  it("labels the third team when the split makes three", () => {
    // Fails if the low side is the first team in `teams` rather than the lowest
    // average: Team A would be named and the copy would point at the wrong side.
    expect(explainFairness(input(THREE_TEAMS))).toEqual({
      averages: "Every team averages 3.0 to 4.0.",
      trade: "Andi (5.0) is Team A's best; Citra (2.0) is Team C's weakest.",
    });
  });

  it("picks the same player every time, by slot order rather than by name", () => {
    // Two teams, each with a tie, and the tied players are named apart from a
    // name comparison: Bela sorts before Citra and Budi before Gita, so a
    // comparator that fell through to the name would name Bela and Budi. What
    // this does not separate is the explicit `a.position - b.position` from the
    // engine's stable sort, which agree on arrays this size; the tiebreak earns
    // its place by making the comparator total, not by changing the answer here.
    const tied: SplitResult = split([team(0, ["p7", "p5", "p2"]), team(1, ["p3", "p8", "p6"])]);
    expect(explainFairness(input(tied))).toEqual({
      averages: "Every team averages 2.3 to 3.7.",
      trade: "Gita (4.0) is Team A's best; Citra (2.0) is Team B's weakest.",
    });
  });

  it("names the same team whichever order the result happens to list them in", () => {
    // Team B and Team C sit on the same average, so `extremes` is choosing
    // between two equals and the array it is handed is the only thing left to
    // decide. Fails if the sort does not break the tie by index: listed C-first
    // the lower end becomes Team C, and the copy would name Fajar and point at
    // a different team for the same arrangement.
    const teams = [team(0, ["p1"]), team(1, ["p2", "p3"]), team(2, ["p6"])];
    const listed: SplitResult = split(teams);
    const reversed: SplitResult = split([...teams].reverse());
    expect(listed.teams[2].index).toBe(2);
    expect(explainFairness(input(listed))).toEqual({
      averages: "Every team averages 3.0 to 5.0.",
      trade: "Andi (5.0) is Team A's best; Citra (2.0) is Team B's weakest.",
    });
    expect(explainFairness(input(reversed))).toEqual(explainFairness(input(listed)));
  });

  it("says nothing about a trade when no side is ahead, because nothing was given up", () => {
    // EVEN and UNEVEN are the same four rated players, one arrangement on one
    // number and one a point apart, so an empty `trade` here cannot be blamed on
    // a missing Strength: the same names come back the moment the sides differ.
    expect(explainFairness(input(EVEN)).averages).toBe("Every team averages 4.0.");
    expect(explainFairness(input(EVEN)).trade).toBe("");
    expect(explainFairness(input(UNEVEN)).trade).toBe("Andi (5.0) is Team A's best; Eka (3.0) is Team B's weakest.");

    // The not-playing clause has to survive the empty `trade`, because that is
    // the branch a split with sit-outs is most likely to take. Fails if the
    // early return hands back `band` instead of `averages`: two people are
    // dropped and the line says nothing about them, on precisely the path the
    // clause was put in the always-shown field for.
    expect(explainFairness(input(EVEN_WITH_SITS))).toEqual({
      averages: "Every team averages 4.0. Not playing: Dewi, Citra",
      trade: "",
    });
  });

  it("says nothing about a trade when one side holds nobody the discipline rates", () => {
    // Team B is Dewi alone, so the weaker side has no rated player to name.
    // Fails if the missing side falls back to `?? 0`, which would print
    // "Dewi (0.0) is Team B's weakest", a Strength of zero she was never given.
    expect(explainFairness(input(ONE_UNRATED_SIDE)).averages).toBe("Every team averages 0.0 to 5.0.");
    expect(explainFairness(input(ONE_UNRATED_SIDE)).trade).toBe("");
  });

  it("never names a player with no capability in the discipline", () => {
    // Team A holds Dewi, who counts as 0 toward its average, and Andi. Fails if
    // the unrated filter is dropped: the copy would put "Dewi (0.0)" on the weak
    // side and read as though she were rated the worst player there.
    const { trade } = explainFairness(input(WITH_AN_UNRATED));
    expect(trade).toBe("Budi (4.0) is Team B's best; Andi (5.0) is Team A's weakest.");
    expect(trade).not.toContain("Dewi");
  });

  it("names everyone the split dropped, in the always-shown field", () => {
    // Fails if the not-playing clause is dropped (a reader of a ten-person
    // roster takes a 3.5 to 4.0 band as a claim about all ten), if it goes in
    // `trade` (which the screen renders only when a trade sentence exists, so a
    // sit-out would vanish on an even split), or if the names come out in a
    // different order than `result.unassigned` holds them.
    //
    // The list is closed here and nowhere else: a trade follows it, so the
    // mark is on. This is the exact string that pins which mark it is, since
    // the case above states the property any mark would satisfy.
    const { averages, trade } = explainFairness(input(WITH_SITS));
    expect(averages).toBe("Every team averages 3.5 to 4.0. Not playing: Dewi, Citra;");
    expect(trade).not.toContain("Not playing");
  });

  it("closes the not-playing list, so the trade's first name is not read as another sitter", () => {
    // The screen prints one line: the band, the sit-outs, the trade. Read as
    // prose, the run after "Not playing:" is a list, so a reader counts the
    // names in it and stops where the list stops.
    //
    // Fails today in exactly the way a reader fails. Nothing ends the list, so
    // the trade's opening name joins it, and the same line then says of one
    // player both that he is not playing and that he is a team's best, three
    // words apart. The claim here is the count and the words, so whichever mark
    // ends the list satisfies it; which mark is held by the exact strings.
    const benched = WITH_SITS.unassigned.map((id) => ROSTER.find((p) => p.id === id)?.name ?? "?");
    expect(sitOuts(composedLine(WITH_SITS))).toEqual(benched);
  });

  it("leaves no mark on the list when the list is the last thing on the line", () => {
    // An even split has no higher side, so there is no trade and the sit-outs
    // are where the line stops. A closing mark here would print "Dewi, Citra;"
    // on its own, which is the same defect pointed the other way: a sentence
    // that ends on a mark. Fails if the terminator is appended to the list
    // instead of being decided by whether a trade follows it.
    const composed = composedLine(EVEN_WITH_SITS);
    expect(sitOuts(composed)).toEqual(["Dewi", "Citra"]);
    expect(composed).toMatch(/[\p{L}\p{N}']$/u);
  });

  it("shows no not-playing clause when the split placed everyone", () => {
    // Fails if the clause is built before the guard (every screen would end in a
    // bare "Not playing:") or if the guard tests something other than a
    // non-empty `unassigned`.
    expect(explainFairness(input(BAND)).averages).not.toContain("Not playing");
  });

  it("prints a question mark for an id the roster no longer holds", () => {
    // A result outliving the player it names. Fails if the lookup is a bare
    // `.name` on a possibly-absent player, which throws rather than prints, or
    // if a full stop closes the list, which prints "?." here and in every screen
    // that shows it. What closes it is the semicolon the trade clause beside it
    // already uses, and where nothing follows the list no mark is printed at
    // all, so the same unknown id ends the line as a bare "?".
    expect(explainFairness(input(WITH_A_STALE_ID)).averages).toBe("Every team averages 3.5 to 4.0. Not playing: ?;");
    expect(explainFairness(input(EVEN_WITH_A_STALE_ID)).averages).toBe("Every team averages 4.0. Not playing: ?");
  });

  it("returns an empty pair when fewer than two teams exist", () => {
    // A band needs two ends. Fails if `extremes` builds the low side from
    // `teams[0]` and the high side from `teams[teams.length - 1]` without the
    // length guard, which makes one team read as a 5.0 to 5.0 band.
    expect(explainFairness(input(ONE_TEAM))).toEqual({ averages: "", trade: "" });
    expect(explainFairness(input(NO_TEAMS))).toEqual({ averages: "", trade: "" });
  });

  it("copies a roster name through untouched rather than screening it", () => {
    // The guarantee covers this module's copy, and a name is not copy: it is
    // whatever the organiser typed. Fails if a banned word ever starts being
    // stripped out of names, which would turn "Node" into "" on a phone screen
    // and quietly rename people.
    const roster = [...ROSTER, player("p9", "Node", [3, 3, 3])];
    const result = split([team(0, ["p9"]), team(1, ["p3"])]);
    expect(explainFairness({ result, discipline: FUTSAL_DISCIPLINE, roster }).trade).toContain("Node (3.0)");
  });
});

describe("the gap verdict this module does not make", () => {
  it("says the same thing whichever record the result carries, while the share text does not", () => {
    // The share text reads that field, so the three records split it into the
    // two verdicts: the two non-optimal records read alike to each other and
    // differ from the proven one. Without these two assertions the equality
    // below could be true because the comparison had nothing to compare.
    const shareTexts = [BEST_FOUND, PROVEN, HAND_EDITED].map((solver) => teamsAsText(shareInput(split(BAND.teams, { solver }))));
    expect(shareTexts[0]).toBe(shareTexts[2]);
    expect(shareTexts[0]).not.toBe(shareTexts[1]);

    const explained = [BEST_FOUND, PROVEN, HAND_EDITED].map((solver) => explainFairness(input(split(BAND.teams, { solver }))));
    expect(explained[0].averages).not.toBe("");
    expect(explained[0].trade).not.toBe("");
    expect(explained[1]).toEqual(explained[0]);
    expect(explained[2]).toEqual(explained[0]);
  });

  it("shares no content word with the share text's own closing line", () => {
    // Checked against `closingLine`'s output rather than a typed list, so the
    // assertion cannot drift from the sentence it guards. Fails if either
    // string borrows the verdict's vocabulary: "proven", "minimum" here, and
    // "smallest", "known", "smaller", "exist" for the other verdict.
    //
    // The size check is what keeps the loop from passing on nothing. A rewrite
    // to short words only ("All tied at 4.0.") would empty every set and the
    // loop would never run, so the guard is on the sentence's own side, where
    // this module decides the wording, not on the verdict's. That is also why
    // EVEN is not in the list: its `trade` is "" by design, and a sentence that
    // is legitimately empty cannot satisfy a non-emptiness assertion.
    for (const solver of [BEST_FOUND, PROVEN]) {
      const verdict = copyWords(closingLine(split(BAND.teams, { solver })));
      for (const result of [BAND, WITH_SITS, THREE_TEAMS]) {
        const { averages, trade } = explainFairness(input(split(result.teams, { unassigned: result.unassigned, solver })));
        for (const sentence of [averages, trade]) {
          const words = copyWords(sentence);
          expect(words.size).toBeGreaterThan(0);
          for (const word of words) expect(verdict.has(word)).toBe(false);
        }
      }
    }
  });
});

describe("the module's own copy", () => {
  it("carries no banned word and no em-dash in any branch", () => {
    // Every arrangement the function can return, under every record it can be
    // handed, rather than the three that pin a literal. Fails if a new branch
    // reaches a banned word, or if an em-dash lands in one of the literals
    // (`DESIGN.md:200`; this phase has found three that arrived quietly).
    const results = [BAND, EVEN, UNEVEN, WITH_AN_UNRATED, ONE_UNRATED_SIDE, THREE_TEAMS, WITH_SITS, WITH_A_STALE_ID, ONE_TEAM, NO_TEAMS];
    for (const result of results) {
      for (const solver of [BEST_FOUND, PROVEN, HAND_EDITED]) {
        const { averages, trade } = explainFairness(input(split(result.teams, { unassigned: result.unassigned, solver })));
        for (const value of [averages, trade]) {
          for (const banned of BANNED) expect(value.toLowerCase()).not.toContain(banned);
          expect(value).not.toContain(EM_DASH);
        }
      }
    }
  });

  it("keeps the banned words out of the module's own literals, not only out of one fixture's output", () => {
    // The sweep above can only speak about the branches it reaches. These are
    // every string this file could hand a reader, so a word that no fixture
    // currently triggers is unavailable rather than merely absent.
    //
    // The guard is for the copy itself, not for the count. A count is satisfied
    // by a walk that finds only the two import specifiers and the "?" fallback,
    // and 14 of the 27 nodes here are empty template head and tail pairs, so the
    // number carries almost no information. Looking for a sentence fails both a
    // broken walk and a refactor that moved the copy to a sibling file, which is
    // the case this assertion exists to catch.
    const literals = copyLiterals(MODULE_AST);
    expect(literals.join("")).toContain("Every team averages");
    for (const literal of literals) {
      for (const banned of BANNED) expect(literal.toLowerCase()).not.toContain(banned);
      expect(literal).not.toContain(EM_DASH);
    }
  });

  it("imports only the two pure helpers, so no verdict and no DOM can reach it", () => {
    // The invariance test above shows the output does not depend on the record,
    // which an unused import would satisfy too. This is the boundary itself: the
    // phase's rule is that this file does not import the verdict module at all,
    // and only the imports can say so.
    expect(importedPaths(MODULE_AST).sort()).toEqual(["../domain/types", "../session/flow"]);
  });
});
