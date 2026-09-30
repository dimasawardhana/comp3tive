# Tournaments v1 — Play the Split

**Status**: shipped (DB v7, backup v4)

**Reconciled 2026-10-01** against `feature/revamp`, claim by claim, with the code as the
authority. The dated `CORRECTION` blocks below record what each passage replaced and why; they
follow the idiom the plan and spec corpus already uses (`docs/superpowers/specs/**`, `CORRECTION
(date, after Task N landed)`), because a reader comparing this file against what it used to say
needs to see the difference rather than a corrected version that was never written. **The body is
the truth and the corrections are the record** — unlike the plan documents, which keep the wrong
text above the correction because the wrong text is the artifact they shipped. Nothing here is
edited in place silently, and each correction names the passage it replaces.

The largest gap is one phase old: round robin shipped in Phase D Task 7 and no ticket was ever
opened to propagate it into this file. See § Reconciliation record at the foot.

## Problem Statement

comp3tive splits people into fair teams, but then what? The teams play — and nobody tracks it. A casual futsal night runs a mini-bracket by hand; an MLBB session runs a best-of series with someone keeping score on paper. This feature makes the competition part of the app: create a competition container (a Tournament) first, split your teams inside it, then record match results as they happen and keep the progress saved.

## Scope

v1 ships four formats, one data model:

- **Series** — two teams, best-of-1/3/5 (the standalone "game").
- **Single elimination** — 2/4/8 teams, standard bracket, byes not needed at these counts, optional 3rd-place match.
- **Swiss** — 4/6/8 teams, `ceil(log2 N)` rounds, standings table.
- **Round robin** — 3/4/5/6/7/8 teams, every pair meets exactly once, scheduled by the circle method; an odd field rests one team per round and every team rests exactly once.

Double elimination is explicitly deferred (losers bracket, resets, progression rules need their own careful pass). No draws exist anywhere: a Match must produce a winner (penalties/rematch at the court). Scores are optional per game.

**CORRECTION (2026-10-01, after Phase D's Task 7 landed) — § Scope: "v1 ships three formats" was
true when this file was written and is false of the app.** `TournamentFormat` is `"series" |
"single-elim" | "swiss" | "round-robin"` (`src/domain/types.ts:25`); the fourth is a live chip in
the create modal (`SELECTABLE_FORMATS`, `src/ui/constants.ts:33-38`, rendered at
`src/tournament/GamesScreen.tsx:329-339`), and it runs a full bracket arm
(`src/tournament/bracket.ts:135-172`) with its own validation
(`src/tournament/tournament-validation.ts:73`), its own split guard
(`src/shell/useSplitFlow.ts:79`) and its own champion rule (`src/tournament/bracket.ts:452-458`).
Its counts are 3 to 8 with odd fields included, not the 4/6/8 the two table formats take
(`src/tournament/GamesScreen.tsx:54`).

`CONTEXT.md:78` **was** updated to name round robin when the glossary was rewritten. This spec is
the document that was left behind, and the glossary now contradicts it. The other three format
claims in this section — the Series, single-elimination and Swiss bullets, and the deferral of
double elimination — were re-checked and are correct.

## Vocabulary (per CONTEXT.md)

- **Tournament** — the competition container, created before teams exist. Owns its specs, teams, matches, and progress. One document per tournament in storage.
- **Match** — one play between two tournament teams; records a winner per game and optional scores.
- **Series** — a best-of-N run of matches between the same two teams; first to majority takes it.
- **Game** — banned term (a Discipline is what a game is not called); individual plays inside a series are Matches.

All four verified against `CONTEXT.md:77-90`, which this section is a verbatim condensation of.

## Flow

```
Games tab → New tournament (specs) → Split your teams (locked team count)
         → bracket/standings → record results → complete
```

1. **Games tab** (bottom nav, between Roster and History): the community's tournaments, newest first, each row showing name, discipline, format, series length, team count, status (Draft / In progress / Complete). Empty state: "No games yet" / "Run a competition" / "Create a tournament, set the format, and split your teams inside it." Disciplines are reached from this hub's own **Disciplines** button, not from the nav.
2. **Create tournament modal**: Name, Discipline chips, Format chips (Series / Single elimination / Swiss / Round robin), Series length (BO1 / BO3 / BO5), Team count constrained by format (Series: 2; Single elim: 2/4/8; Swiss: 4/6/8; Round robin: 3/4/5/6/7/8). Creating lands on the tournament page in **draft** state.
3. **Draft state**: specs summary + "Split your teams" CTA. Enters the existing match flow (pool selection, discipline preset) with the team stepper **locked** to the tournament's count. The Split screen's forward action is **Save teams to tournament →**, which submits the teams and returns to the tournament with a bracket. Before the first recorded result, re-roll and re-split are free.
4. **Active state**:
   - Single elimination: rounds as columns, winners advance, 3rd-place match row (toggle, default on), champion card at completion (the label "Champion" over the winning team's name).
   - Swiss: standings table (three columns — position, team, series wins), same-record pairing, `ceil(log2 N)` rounds, winner is the leader of the final table.
   - Tapping a match opens the record modal: one pick button per team per game, labelled with the team names, plus two optional score inputs; the series resolves at majority and the winner advances automatically. Out-of-order recording is blocked for the two formats that have a frontier — a match with an unfilled slot renders disabled and `applyResult` throws on one. Round robin has no frontier: every fixture is booked up front, so every match is recordable at any time.
5. **Result editing**: any recorded result stays editable; the bracket recomputes. Undo = delete the last recorded game.

**CORRECTION (2026-10-01, after Phase D's Task 7 landed) — § Flow item 2: the format chips were
described as "Series / Single elimination / Swiss; double elim grayed 'soon'". There is no grayed
chip.** The row is exactly `SELECTABLE_FORMATS` (`src/tournament/GamesScreen.tsx:329-339`) and
every button on it is live; nothing in `src/` renders a disabled "soon" affordance. Double
elimination is still deferred — § Scope says so, and § Out of Scope still lists it — but it is not
offered as a disabled control, and a document that says it is describes something no visitor can
see. The Round robin chip is new since this line was written, together with the 3–8 count row and
the odd-field note at `src/tournament/GamesScreen.tsx:395-400`.

**CORRECTION (2026-10-01, after Phase B's B15 landed) — § Flow item 3: the forward action was named
"Submit teams".** The shipped label is `Save teams to tournament →`
(`src/session/SplitScreen.tsx:501-509`) — one of B15's five renames, recorded in `contracts.md` §5 —
and it is the only label a user ever sees. The mechanism the sentence describes is unchanged and
is worth stating precisely: a tournament split persists **no Session at all**.
`splitFlowRule("tournament")` is `{ persistsSession: false, submitsTournament: true, isSynthetic:
false }` (`src/shell/useSplitFlow.ts:36-40`), which is also why the Edge Cases line about deleting
the source session describes a deletion that cannot happen rather than one that is harmless.

The stepper lock above the action holds: `MatchScreen` disables both stepper buttons and prints
"Locked to N teams by the tournament." (`src/session/MatchScreen.tsx:147`, `:156`, `:162`).

**CORRECTION (2026-10-01, after the split flow was extracted into the shell) — § Flow item 4,
single elimination: the quoted champion card, "Pink takes it 2–1.", is not rendered anywhere in
`src/`.** The card is `<span class="champ-label">Champion</span>` over
`<span class="champ-name">{champ.name}</span>` (`src/tournament/TournamentScreen.tsx:327-330`).
The quoted string is close to a real one that lives somewhere else: the record modal's
decided-state line reads `Series decided: {name} takes it {a}–{b}.`
(`src/tournament/TournamentScreen.tsx:175-177`). A spec that quotes copy must quote copy that
ships — the standard the Games empty state in item 1 was already held to in ticket 16's first
review round. The 3rd-place toggle and its default-on state are correct and stay
(`src/tournament/GamesScreen.tsx:95`, `:403-414`).

**CORRECTION (2026-10-01, after Phase A's A07 landed) — § Flow item 4, Swiss: "strength tiebreak"
is false of the shipped sort, and `team.strength` is not in the comparator at all.** `standings()`
orders by series wins, then the head-to-head winner when exactly two teams share a record, then
game difference, then game wins, then ascending `team.id` as a stated last resort
(`src/tournament/bracket.ts:432-446`). The rendered table has three columns and no tiebreak column
(`src/tournament/TournamentScreen.tsx:486-493`).

This is a **missed** correction rather than a new one. Ticket 07 removed the strength key and
recorded, in its own `## Comments`, that "the original `docs/spec/0002-tournaments-v1.md` lines
that described the removed strength tiebreak are ticket 16's, not this one's". Ticket 16 was
marked `resolved` without touching them. The 4/6/8 counts and the `ceil(log2 N)` round count in
the same sentence are correct and stay.

**CORRECTION (2026-10-01, after Phase D's Task 7 landed) — § Flow item 4: "only frontier matches
are recordable" is true of single elimination and Swiss and false of the fourth format.**
`requiredMatches` returns `t.matches` outright for `round-robin` and `series`
(`src/tournament/bracket.ts:287`), and every round of a round robin renders in `StandingsView`
with its own pick buttons (`src/tournament/TournamentScreen.tsx:497-523`). A round robin books
its whole schedule at build time, so the last round is a column rather than the last of the work —
the same fact the `requiredMatches` CORRECTION in Phase D's spec records.

"current-round" was also imprecise, and "**A wins / B wins** buttons" was never the shipped copy:
the two chips carry the team names (`src/tournament/TournamentScreen.tsx:137`, `:148`).

## Data Model

```
Tournament {
  id, communityId, disciplineId,
  name, format: "series" | "single-elim" | "swiss" | "round-robin",
  seriesLength: 1 | 3 | 5,          // tournament-level; a Match inherits it
  teamCount, createdAt, status: "draft" | "active" | "complete",
  thirdPlace: boolean,             // single elimination only; plays a 3rd-place match (default true)
  teams: [{ id, bibIndex, name, players: Id[], strength }],  // snapshot from the split
  matches: [{
    id, round, position,
    teamAId, teamBId,              // null until assigned (byes / future rounds)
    games: [{ index, winnerTeamId, scoreA?, scoreB? }],
    winnerTeamId?,                 // decided once a majority exists
    winnerNext: { matchId, slot: "A" | "B" } | null,  // winner slot: advances the bracket
    loserNext: { matchId, slot: "A" | "B" } | null,   // loser slot: carries the 3rd-place match
    isThirdPlace?,
  }],
}
```

- Teams are **snapshots** owned by the tournament: deleting the source Session never affects a started tournament.
- Seeding: teams ordered by split strength (strongest = seed 1); single elim pairs by **bit-reversal** seeding, so 4 teams open 1v3 / 2v4 and 8 teams open 1v5 / 3v7 / 2v6 / 4v8. No byes at 2/4/8. Round robin is seated from the same seed order with the ring anchored on slot 0, which makes seed 1 the team that rests in round 1.
- After the **first recorded result**, re-roll and re-split lock. Player swaps remain allowed (the record stores match outcomes, not lineups).
- Persistence: one document per tournament in IndexedDB (new `tournaments` store, DB v7), community-scoped. Backup v4 **carries** `tournaments[]` (added in v3) and `savedSquads[]` (added in v4); v1–v3 imports migrate with empty lists.
- Storage behind the same interfaces as ADR-0001 (`TournamentStore`), so a backend can replace IndexedDB later.

**CORRECTION (2026-10-01, after Phase D's Task 7 landed) — § Data Model: the `format` union named
three values.** `src/domain/types.ts:25` names four, and the model's own `format` field is typed
`TournamentFormat` (`:66`), so the block above was transcribing a literal that no longer exists.
Ticket 16 corrected the *other* fields in this block — `players: Id[]`, tournament-level
`seriesLength`, `winnerNext`/`loserNext`, tournament-level `thirdPlace` — and left this line. It is
the field a reader copies out of a data model. The rest of the block was re-checked field by field
against `src/domain/types.ts:30-75` and holds, including the backup v4 / v3 attribution
(`src/data/transfer.ts:6`) and DB v7 (`src/storage/indexed-db.ts:19`).

**CORRECTION (2026-10-01, measured) — § Data Model, seeding: "single elim pairs 1v8 / 4v5" is not
what the bracket builds.** `buildBracket` seeds by reversing the low `rounds` bits of the seed
index (`src/tournament/bracket.ts:26-33`, applied at `:104-107`) — the standard anti-collinearity
ordering, not the 1v8 / 4v5 fold the sentence names. Measured at 8 teams: `bitReverse(0..7, 3)` is
`0, 4, 2, 6, 1, 5, 3, 7`, so the seeded order is 1, 5, 3, 7, 2, 6, 4, 8 and round 1 pairs **1v5,
3v7, 2v6, 4v8**. The tests pin it: `src/tournament/bracket.test.ts:72` ("bit-reversal seeding 1v3,
2v4") and `:218` ("t1 beats t5; t3 beats t7").

Two halves of the sentence survive. "No byes at 2/4/8" is correct and stays. The round-robin
seating clause is new, and its bye order is a **decision rather than an artifact of the array**:
the ring hands the fixed team its first bye and a different team each round after, accepted because
a bye is a fixture that was never booked rather than a walkover, and the only way to give the first
bye to the bottom seed is to seat it in the anchor, which costs the top two seeds their last-round
meeting (`src/tournament/bracket.ts:136-146`, pinned at `src/tournament/bracket.test.ts:519`).

`docs/archive/DOMAIN_MODEL.md:263` carries the same wrong 1v8/4v5 claim. It is archived under the
superseded banner ticket 16 added, so it is not this file's to fix; it is listed in the record
below.

## Interaction Rules

- **No draws.** Every game needs a winner; the organizer resolves ties on the court (penalties, golden goal, rematch).
- **Frontier-only recording.** Only matches whose prerequisites are decided can record results. No skipping ahead. Round robin is the exception and it is a structural one rather than a loophole: it books every fixture up front, so its matches are independent of one another and all of them are recordable at any time (`src/tournament/bracket.ts:287`) — the CORRECTION at § Flow item 4 carries the rest.
- **Always editable.** Results can be fixed after the fact; the bracket recomputes from stored winners.
- **Locking.** Re-roll/re-split lock at the first recorded result. Deleting a tournament is a confirmed action cascading its matches.

All four verified. The lock is structural rather than a check on the first recorded result: the
`Re-split` button only renders in the review step, which is entered once and left for good by
"Confirm teams →" (`src/tournament/TournamentScreen.tsx:238`, `:375-388`), and a tournament
reopened mid-progress initialises out of it (`:238`). The two-step delete is the same shape on the
list (`src/tournament/GamesScreen.tsx:214-250`) and on the tournament page
(`src/tournament/TournamentScreen.tsx:366-374`).

## Edge Cases

- Pool too small for the tournament's team count at split time → the split warns as today; the tournament stays draft until teams are submitted.
- Tournament with zero matches played and community switch → tournaments are community-scoped like sessions; switching communities shows that community's list.
- Reopening a tournament mid-progress → bracket/standings rebuild entirely from the stored matches (no transient state).
- Deleting the source session → irrelevant: the tournament holds team snapshots.
- Swiss or round-robin tie on series wins → head-to-head when exactly two teams share the record, then game difference, then game wins, then team id.

**CORRECTION (2026-10-01, after Phase A's A07 landed) — § Edge Cases: the same removed key as the
§ Flow item 4 correction, in an Edge Cases line.** "Tiebreak by team strength" names a comparator
key that is not there (`src/tournament/bracket.ts:432-446`). The `team.id` fallback is deliberate
and is stated in that function's own doc comment (`:408-413`): ids are handed out in strength
order, so a fully-tied table can still reproduce the pre-tournament seed. Recorded rather than
silently rewritten because the same sentence was already wrong when ticket 16 was marked
`resolved`. The line was also Swiss-only, and round robin shares the table now. The other four
Edge Cases were re-checked and hold.

## Out of Scope (v2+)

- Double elimination; play-ins; byes for any format other than round robin, which has them.
- Live scoreboard/clock during matches; results are recorded after the fact.
- Renaming teams at tournament level; manual seeding/arrangement.
- Stats across tournaments (win rates, streaks) — the v1 spec defers analytics.
- Standings tiebreaks beyond head-to-head + game difference + game wins (no Buchholz).

**CORRECTION (2026-10-01, after Phase D's Task 7 landed) — § Out of Scope: "round-robin groups"
and "byes for odd team counts" are both shipped, so the clause is deleted rather than re-scoped.**
Round robin is a full tournament format — chip, counts, validation, split guard, bracket arm,
standings view and champion, all cited at the § Scope correction. A bye is a first-class part of
it: `roundRobinSchedule` emits `teamB: null` for the resting team, runs `n - 1` rounds for even
`n` and `n` rounds for odd, and rests every team exactly once
(`src/data/round-robin.ts:19-42`). The create modal says so in copy: *"{n} teams is an odd field,
so one team sits out each round. Every team rests exactly once, and a bye is not a loss."*
(`src/tournament/GamesScreen.tsx:395-400`). A bye carries no result, no score and no points — it is
a pairing that does not exist (`src/data/round-robin.ts:34-38`) — which is why nothing needs
replacing in its place. Double elimination and play-ins remain deferred and stay on the list.

**CORRECTION (2026-10-01, after Phase A's A07 landed) — § Out of Scope: the third stale instance
of the key removed at § Flow item 4 and § Edge Cases, this time in a scope line.** "Beyond
strength + game wins" names a comparator that no longer exists; the reading of the sort is in the
§ Flow item 4 correction and is not repeated. The exclusion of Buchholz is correct and stays.

## Testing Decisions

- The pure seam is the **bracket machine**: `buildBracket(tournament) → tournament` and `applyResult(tournament, matchId, games) → tournament` — deterministic, format-specific progression. Bracket behaviour is tested here: seeding order, 3rd-place inclusion, majority resolution, frontier gating (out-of-order rejected), Swiss pairing by record, completion detection.
- Round robin's scheduling is a **second pure seam**: `roundRobinSchedule(n)` and `roundRobinRounds(n)` (`src/data/round-robin.ts`), tested on their own because a scheduling property is a property of the algorithm — `src/data/round-robin.test.ts` enumerates n = 2 to 64, well past the 8-team cap the app enforces.
- Storage gets smoke checks. The UI is no longer smoke-only: the unit harness runs `src/**/*.test.ts` in a node environment, so a `.tsx` screen is testable by `renderToStaticMarkup` — which is how the format/count tables (`src/tournament/team-counts.test.ts`) and the standings view (`src/tournament/TournamentScreen.standings.test.ts`) are covered.

**CORRECTION (2026-10-01, after Phase D's Task 7 landed) — § Testing Decisions: three claims
here were wrong.** **The signature**: `buildBracket` takes one argument, the whole `Tournament`,
and returns a `Tournament` (`src/tournament/bracket.ts:93`) — it was written as
`buildBracket(tournament, teams) → matches`, and a `teams` parameter has never existed on it.
**`applyResult`'s signature above it is correct and stays.** **"All behavioral tests live here"**
was true of the three formats this file knew and is not true now: round robin's scheduling
invariants live in `src/data/round-robin.test.ts` and its bracket arm in
`src/tournament/bracket.test.ts:483`, the count tables in `src/tournament/team-counts.test.ts`, and
the standings rendering — including the assertion that a round robin never renders the word
"Final" — in `src/tournament/TournamentScreen.standings.test.ts:69-99`. **"Storage and UI get smoke
checks only"** understates what shipped, for the `renderToStaticMarkup` reason given above.

## Reconciliation record

**2026-10-01, `feature/revamp`.** This section exists because the file was found contradicting the
code while carrying a ticket that says otherwise, and because the honest answer to "what did ticket
16 do" is not one word.

**What ticket 16 did.** `.scratch/debt/issues/16-reconcile-the-documents-that-contradict-the-code.md`
is marked `resolved`, and it **did** correct this file. Its `## Comments` records the landed work
and it is true: a `**Status**` line under the title; the Data Model corrected to `players: Id[]`,
tournament-level `seriesLength`, `winnerNext`/`loserNext`, tournament-level `thirdPlace`; DB **v7**
and backup v4 with the v3/v4 attributions; the Games tab's real neighbours; and the Games empty
state re-quoted from the screen. Every one of those was re-checked against the source while
preparing this reconciliation and holds. It also carried DB v6 → v7 as its own first correction,
against its own evidence table, which is the sign of a ticket that checked rather than copied.

**What it did not do — and this is the part the `resolved` status hides.** Ticket 16 was a Phase B
work item. It ran, and it closed, **before** Phase D shipped round robin (Task 7, ticket 35, also
`resolved`). Nothing was ever opened afterwards to propagate the fourth format into this spec, so
the format count, the union, the create-modal chips, the out-of-scope line and the testing seam all
described an app that stopped existing. **A ticket that missed this file is a fixable record: the
ticket was right when it closed and the file drifted afterwards.**

**The second failure is a real miss, and it predates Phase D.** Phase A's A07 removed
`team.strength` from the standings comparator. Ticket 07 recorded in its own `## Comments` that
the spec lines describing the removed strength tiebreak were ticket 16's to fix. Ticket 16 did not
fix them, and neither did anything after it. Three of those lines are corrected above, at § Flow
item 4, § Edge Cases and § Out of Scope. The wrong single-elimination seeding in § Data Model is
the same shape: a claim that was never true of the shipped bracket, sitting in a file that three
prior reconciliations had already passed over.

So the ledger should say both, not one: **the round-robin drift is a ticket that was correct when
it closed, and the strength-tiebreak and seeding lines are a ticket that was marked done without
doing the work another ticket had explicitly assigned to it.**

**Other documents in the corpus that contradict the code, reported and not edited.** Each is
outside this ticket's scope — `contracts.md` §3 gives `docs/spec/0002` to Phase B exclusively, and
the current assignment reaches nothing else — so they are listed rather than fixed. A wrong record
nobody has named is the one that survives.

| Document | Claim | Reality |
|---|---|---|
| `README.md:22-23` | "**Formats.** Series, single elimination, or Swiss (`TournamentFormat` in `src/domain/types.ts` also names round robin; **it is not offered in the app yet**)." | It is offered — chip, counts, validation, split guard, bracket arm, all cited at the § Scope correction. This is the **live, reader-facing contradiction**, and the same repo's own Landing Page already contradicts it: `index.html:173` reads "Series, single elimination, Swiss, or round robin". Phase C created `README.md`; the format fact is Phase D's. Nobody has named it, and it is the one that would be found first. |
| `docs/BUSINESS_FLOW_REVIEW.md:19-20` | "Built-ins are `futsal` and `mlbb`"; "A competition container with format (single-elim / swiss / series)" | Three disciplines ship, in `SEED_DISCIPLINES` order futsal, MLBB, badminton (`src/domain/seed.ts:76`); four formats (`src/domain/types.ts:25`). Dated 2026-09-02 at `:3`, but it carries no as-of note on its findings the way `COMP3TIVE_COMPREHENSIVE_ANALYSIS.md` now does, so a reader has no signal that `:19` is history. |
| `docs/archive/DOMAIN_MODEL.md:262-264` | "Single elimination: 1v8, 4v5 pairing"; "No byes at standard team counts" | Bit-reversal seeding — 1v5 / 3v7 / 2v6 / 4v8 at 8 teams; see the § Data Model correction. Archived under the superseded banner ticket 16 added, so as history it is fine; recorded because it is still citable and still wrong. |
| `COMP3TIVE_COMPREHESIVE_ANALYSIS.md:30`, `:514-515` | "`src/tournament/bracket.ts` … is a single-elimination/Swiss/Series state machine"; the team count is "legal for the format (`swiss`: even ≥2; `single-elim`: 2/4/8; `series`: 2)" | Four formats. And the Swiss count is not "even ≥2" at the point a create is made: the modal offers 4/6/8 (`src/tournament/GamesScreen.tsx:50`) and the validator refuses anything else (`src/tournament/tournament-validation.ts:72`). `bracketSupports`'s Swiss arm *is* `n >= 2 && n % 2 === 0` (`src/shell/useSplitFlow.ts:77`), so the sentence is half right about the guard and wrong about the rule a user meets. Dated evidence under a snapshot note; ticket 16 already flagged two other stale lines in it. |
| `docs/superpowers/plans/2026-09-17-honest-claims.md:1985-1989` | a verbatim copy of this spec's Data Model block, with `format: "series" \| "single-elim" \| "swiss"` | The block this file has just corrected. A plan quoting the pre-correction spec, so historical — but it is a **verbatim** copy and a reader cannot tell it from the source. |
| `docs/superpowers/specs/2026-09-17-honest-claims-design.md:562`, `:954` | instructs B16 to add "**Status**: shipped (DB v6, backup v4)" and records that "`docs/spec/0002` says DB v6 / backup v4" | v7, not v6 (`src/storage/indexed-db.ts:19`). This is a record of what Phase B was **told** to do rather than a live claim — and it is the origin of the first wrong version this file carried, corrected upward by ticket 16's own review round. |

`docs/adr/0002-tournament-first-flow.md` was checked for the same class and is clean: `**Status**:
accepted` (`:5`), and its Consequences section already carries the corrected `winnerNext` /
`loserNext` pair (`:17`).

**The standing rule this exposes.** A ticket that reconciles a document is a statement about that
document **at a commit**, and nothing re-checks it. The three shapes of drift above are three
different things — a document corrected correctly and then overtaken by a later phase; a
correction another ticket explicitly assigned and that nobody executed; and a claim that was never
true of the code and survived three passes — and only the first is excusable by the date on the
ticket. The cheap fix is not another sweep. It is that a later phase which changes a frozen fact a
reconciled document states must reopen that document, the way `contracts.md` §6 already requires of
a `file:line` a phase invalidates.
