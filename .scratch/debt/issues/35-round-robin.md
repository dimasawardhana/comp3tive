# 35: Round robin for 3, 5, 6 and 7 teams

**Status:** ready-for-agent

**What to build:** `round-robin` becomes a tournament format: every team plays every other team
exactly once, each round is a set of simultaneous matches, and an odd number of teams gives each
team exactly one bye. A 3-team and a 5-team night — both of which can already be split into
teams — can finally run a tournament. The champion is the team that wins the most matches, read
from the standings table that Swiss already uses.

**Evidence.** A 3-team or 5-team night can split but cannot run a tournament at all:

```
$ grep -n "getValidTeamCounts" -A6 src/tournament/tournament-validation.ts
function getValidTeamCounts(format: TournamentFormat): number[] {
  return format === "series" ? [2]
       : format === "single-elim" ? [2, 4, 8]
       : format === "swiss" ? [4, 6, 8]
       : [];
}
$ grep -n "TournamentFormat =" src/domain/types.ts
25:export type TournamentFormat = "series" | "single-elim" | "swiss";
```

`validateTournamentSpec` pushes a `teamCount` issue (`src/tournament/tournament-validation.ts:23-29`)
reading `` `${spec.format} format only supports: ${validCounts.join(", ")} teams.` ``, and the
split flow's own guard replicates it at `src/App.tsx:328-331`:

```ts
const bracketOk = tournament.format === "swiss" ? n >= 2 && n % 2 === 0
                : tournament.format === "single-elim" ? (n === 2 || n === 4 || n === 8)
                : n === 2;
```

(After C26 that block is `consumeTeams` in `src/shell/useSplitFlow.ts`; this ticket edits it
there, character-for-character otherwise.)

**Why this is small.** `standings` is already format-agnostic — it reads only `records(tournament)`,
which walks `t.matches` (`src/tournament/bracket.ts:303`, `:136`) — and the `.standings` /
`.standings-row` / `.standings-pos` / `.standings-team` / `.standings-wins` markup already exists
(`src/tournament/TournamentScreen.tsx:493-503`, styles at `src/index.css:2486`). Round robin needs
no new table and no new CSS. The changes are: the union value, the label, the valid counts, the
schedule generator, and four reads inside `bracket.ts` — of which `champion()` is the one that
breaks silently.

**Acceptance criteria:**
- [ ] `src/domain/types.ts:25` becomes `export type TournamentFormat = "series" | "single-elim" | "swiss" | "round-robin";` and `src/ui/constants.ts`'s `FORMAT_LABEL: Record<TournamentFormat, string>` gains `"round-robin": "Round robin"`. Because the record is declared with an explicit `Record<TournamentFormat, string>` type, `npx tsc -b` fails at that object literal until the key is added — that failure is the signal, not a surprise.
- [ ] `src/data/round-robin.ts` exports `roundRobinSchedule(n: number): { round: number; teamA: number; teamB: number | null }[]`, a pure function with no imports. It pairs team indices, not ids, so it has no dependency on the domain types.
- [ ] The algorithm is the **circle method**, named as such in the file's doc comment: when `n` is odd, append one `null` placeholder to make `m = n + 1` slots; keep slot 0 fixed; rotate slots 1..m-1 one position per round; in each round pair slot `i` with slot `m - 1 - i` for `i` in `0..m/2 - 1`. A `null` on either side of a pair is a bye, emitted as `teamB: null`.
- [ ] Round counts are `n - 1` for even `n` and `n` for odd `n`; totals are `n * (n - 1) / 2` matches. Verified in `src/data/round-robin.test.ts` for **n = 3, 4, 5, 6, 7, 8**: every unordered pair appears exactly once; no team index appears twice in the same round; for odd `n` every round contains exactly one bye and each team takes exactly one bye across the schedule; and the round count and match count match the formulas above.
- [ ] `buildBracket` gets a round-robin arm before the Swiss fallthrough (`src/tournament/bracket.ts:122`). It maps `roundRobinSchedule(n)` onto `emptyMatch(round, position)` (`:56`), naming each match's participants from `t.teams[teamA].id` / `t.teams[teamB].id`. Both `winnerNext` and `loserNext` stay `null` — round-robin matches are independent, so `settle`'s downstream re-derivation loop is correctly a no-op for them.
- [ ] `roundsFor` (`src/tournament/bracket.ts:53`) gains a round-robin arm rather than being bypassed: `format === "round-robin" ? (n % 2 === 0 ? n - 1 : n) : …`. The `single-elim` and Swiss arms are not touched. `buildBracket`'s Swiss block, the single-elim block and the `series`/`single-elim`-n-2 early return are all unchanged.
- [ ] `requiredMatches` (`src/tournament/bracket.ts:191`) needs no new arm — its final fallthrough already returns every match in the last round, and for round robin the last round **is** the last set of matches, so "all matches required" is the correct semantics. This is asserted, not assumed: a test plays a full 4-team round robin and checks `status` is `"active"` until the last round's matches are all decided, then `"complete"`.
- [ ] **`champion()` is a required change** (`src/tournament/bracket.ts:317-326`). Today only `"swiss"` returns `standings(tournament)[0]`; everything else falls into the single-elim final-round lookup, which finds no match for round robin and returns `null`. The condition becomes `tournament.format === "swiss" || tournament.format === "round-robin"`. A test builds a 4-team round robin, records every match with a deliberate winner, asserts `status === "complete"`, and asserts `champion()` returns the team with the most wins — and separately asserts it is **not** `null`, which is the failure this change prevents.
- [ ] `getValidTeamCounts` (`src/tournament/tournament-validation.ts:58-63`) returns `[3, 4, 5, 6, 7, 8]` for `"round-robin"`. `isValidTeamCountForFormat` (`:66`) needs no change. The existing `series`, `single-elim` and `swiss` arms are unchanged.
- [ ] `consumeTeams` in `src/shell/useSplitFlow.ts` (post-C26 home of `src/App.tsx:328-331`) gains the round-robin case: `n >= 3 && n <= 8` for `"round-robin"`, everything else byte-identical. A spec asserts a 3-team and a 5-team split submits into a round-robin tournament, and that a 2-team round-robin is still refused with the same message as today.
- [ ] `src/tournament/GamesScreen.tsx:36-40`'s `TEAM_COUNTS` gains `"round-robin": [3, 4, 5, 6, 7, 8]` (or reads `getValidTeamCounts`, exported from `tournament-validation.ts`, whichever C23's constant consolidation left in place — one source, not two). The chip array at `:334` becomes `[2, 3, 4, 5, 6, 7, 8]` so 3 and 5 are selectable; chips outside a format's counts stay `disabled`.
- [ ] The team-count hint at `src/tournament/GamesScreen.tsx:354-358` gains `round-robin` → `"Round robin: 3 to 8 teams."`, and the preview line at `:374-378` gains `format === "round-robin" && ` · ${teamCount % 2 === 0 ? teamCount - 1 : teamCount} rounds · every team plays every other``.
- [ ] The squad prefill at `src/tournament/GamesScreen.tsx:62-65` stops mis-routing a 3- or 5-team squad into Swiss (where validation then rejects it). Today the chain is `teamCount === 2 ? "series" : TEAM_COUNTS["single-elim"].includes(teamCount) ? "single-elim" : "swiss"`, so **3 and 5 silently prefill as Swiss and then fail validation**. The fallthrough becomes `: teamCount >= 3 && teamCount <= 8 ? "round-robin" : "swiss"`. Preserved exactly: 2 → `series`, 4 and 8 → `single-elim`, 6 → `swiss`.
- [ ] `TournamentScreen.tsx:359-363`'s branch becomes `tournament.format === "swiss" || tournament.format === "round-robin" ? <StandingsView …> : <BracketView …>`. `StandingsView` needs no change; its per-round `.swiss-round` blocks (`:504` onward) already render whatever rounds the tournament has.
- [ ] `single-elim` and `swiss` behaviour is untouched and all existing bracket tests stay green with no spec edited: `src/tournament/bracket.test.ts`'s Swiss tiebreak order (`:268`) and standings-crown-the-leader (`:254`) assertions in particular, which A07 also has in flight. New tests live in a new `src/data/round-robin.test.ts` plus new `describe` blocks in `src/tournament/bracket.test.ts`; no existing assertion is modified.
- [ ] `npx tsc -b` exits 0, `npx vite build` exits 0, and `npx vitest run` exits 0 with the new round-robin cases in the output.

**Blocked by:** —
