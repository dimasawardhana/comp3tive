# Tournaments v1 — Play the Split

## Problem Statement

Team Builder splits people into fair teams, but then what? The teams play — and nobody tracks it. A casual futsal night runs a mini-bracket by hand; an MLBB session runs a best-of series with someone keeping score on paper. This feature makes the competition part of the app: create a competition container (a Tournament) first, split your teams inside it, then record match results as they happen and keep the progress saved.

## Scope

v1 ships three formats, one data model:

- **Series** — two teams, best-of-1/3/5 (the standalone "game").
- **Single elimination** — 2/4/8 teams, standard bracket, byes not needed at these counts, optional 3rd-place match.
- **Swiss** — 4/6/8 teams, `ceil(log2 N)` rounds, standings table.

Double elimination is explicitly deferred (losers bracket, resets, progression rules need their own careful pass). No draws exist anywhere: a Match must produce a winner (penalties/rematch at the court). Scores are optional per game.

## Vocabulary (per CONTEXT.md)

- **Tournament** — the competition container, created before teams exist. Owns its specs, teams, matches, and progress. One document per tournament in storage.
- **Match** — one play between two tournament teams; records a winner per game and optional scores.
- **Series** — a best-of-N run of matches between the same two teams; first to majority takes it.
- **Game** — banned term (a Discipline is what a game is not called); individual plays inside a series are Matches.

## Flow

```
Games tab → New tournament (specs) → Split your teams (locked team count)
         → bracket/standings → record results → complete
```

1. **Games tab** (bottom nav, between History and Disciplines): the community's tournaments, newest first, each row showing name, discipline, format, series length, team count, status (Draft / In progress / Complete). Empty state: "No games yet. Create a tournament and split your teams."
2. **Create tournament modal**: Name, Discipline chips, Format chips (Series / Single elimination / Swiss; double elim grayed "soon"), Series length (BO1 / BO3 / BO5), Team count constrained by format (Series: 2; Single elim: 2/4/8; Swiss: 4/6/8). Creating lands on the tournament page in **draft** state.
3. **Draft state**: specs summary + "Split your teams" CTA. Enters the existing match flow (pool selection, discipline preset) with the team stepper **locked** to the tournament's count. The Split screen gains a "Submit teams" action that returns to the tournament with a bracket. Before the first recorded result, re-roll and re-split are free.
4. **Active state**:
   - Single elimination: rounds as columns, winners advance, 3rd-place match row (toggle, default on), champion card at completion ("Pink takes it 2–1.").
   - Swiss: standings table (position, team, series wins, strength tiebreak), same-record pairing, `ceil(log2 N)` rounds, winner is top of the final table.
   - Tapping a current-round match opens the record modal: per-game **A wins / B wins** buttons with optional score inputs; the series resolves at majority and the winner advances automatically. Out-of-order recording is blocked — only frontier matches are recordable, which keeps the bracket consistent.
5. **Result editing**: any recorded result stays editable; the bracket recomputes. Undo = delete the last recorded game.

## Data Model

```
Tournament {
  id, communityId, disciplineId,
  name, format: "series" | "single-elim" | "swiss",
  seriesLength: 1 | 3 | 5,
  teamCount, createdAt, status: "draft" | "active" | "complete",
  teams: [{ id, bibIndex, name, players: [{playerId, roleId}], strength }],  // snapshot from the split
  matches: [{
    id, round, position,
    teamAId, teamBId,                 // null until assigned (byes / future rounds)
    seriesLength, games: [{ index, winnerTeamId, scoreA?, scoreB? }],
    winnerTeamId?,                   // decided once a majority exists
    nextMatchId?,                    // winner slot (double elim later: loser slot)
    isThirdPlace?,
  }],
}
```

- Teams are **snapshots** owned by the tournament: deleting the source Session never affects a started tournament.
- Seeding: teams ordered by split strength (strongest = seed 1); single elim pairs 1v8 / 4v5. No byes at 2/4/8.
- After the **first recorded result**, re-roll and re-split lock. Player swaps remain allowed (the record stores match outcomes, not lineups).
- Persistence: one document per tournament in IndexedDB (new `tournaments` store, DB v5), community-scoped. Backup v3 adds `tournaments[]`; v1/v2 imports migrate with an empty list.
- Storage behind the same interfaces as ADR-0001 (`TournamentStore`), so a backend can replace IndexedDB later.

## Interaction Rules

- **No draws.** Every game needs a winner; the organizer resolves ties on the court (penalties, golden goal, rematch).
- **Frontier-only recording.** Only matches whose prerequisites are decided can record results. No skipping ahead.
- **Always editable.** Results can be fixed after the fact; the bracket recomputes from stored winners.
- **Locking.** Re-roll/re-split lock at the first recorded result. Deleting a tournament is a confirmed action cascading its matches.

## Edge Cases

- Pool too small for the tournament's team count at split time → the split warns as today; the tournament stays draft until teams are submitted.
- Tournament with zero matches played and community switch → tournaments are community-scoped like sessions; switching communities shows that community's list.
- Reopening a tournament mid-progress → bracket/standings rebuild entirely from the stored matches (no transient state).
- Deleting the source session → irrelevant: the tournament holds team snapshots.
- Swiss tie at the top → tiebreak by team strength, then game wins.

## Out of Scope (v2+)

- Double elimination, round-robin groups, play-ins/byes for odd team counts.
- Live scoreboard/clock during matches; results are recorded after the fact.
- Renaming teams at tournament level; manual seeding/arrangement.
- Stats across tournaments (win rates, streaks) — the v1 spec defers analytics.
- Standings tiebreaks beyond strength + game wins (no Buchholz).

## Testing Decisions

- The pure seam is the **bracket machine**: `buildBracket(tournament, teams) → matches` and `applyResult(tournament, matchId, games) → tournament` — deterministic, format-specific progression. All behavioral tests live here: seeding order, 3rd-place inclusion, majority resolution, frontier gating (out-of-order rejected), Swiss pairing by record, completion detection.
- Storage and UI get smoke checks only, matching the existing pattern (solver seam + thin shells).
