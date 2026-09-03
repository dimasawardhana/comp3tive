# 10: Tournaments — bracket machine

**What to build:** The pure, deterministic core of tournaments per `docs/spec/0002-tournaments-v1.md`: `buildBracket(tournament)` and `applyResult(tournament, matchId, games)` in `src/tournament/bracket.ts`, plus the domain types (Tournament, TournamentMatch, GameResult). No storage, no UI — just the state machine, exhaustively tested.

**Blocking edges:** none (foundation). Unblocks 11 (storage), 13 (tournament page), 14 (split integration).

**Status:** resolved

## Answer

Built `src/tournament/bracket.ts` + `src/tournament/bracket.test.ts` (22 tests) + domain types. `buildBracket` seeds single elim by bit-reversal (1v2 only meet in the final), wires winner/loser routing incl. 3rd-place; Swiss pairs adjacent seeds round 1 and generates each next round on completion (same-record, rematch-avoiding, floats for odd groups). `applyResult` validates frontier + game legality (participant winner, no post-majority games, series cap), resolves at majority, re-settles downstream — edits clear only the affected subtree, unrelated decided matches keep their games. Completion + `standings()` (wins, strength, game wins) + `champion()` per format. 77/77 suite green, tsc + build clean.

## Scope

- Formats: `series` (2 teams, best-of-1/3/5), `single-elim` (2/4/8, optional 3rd-place), `swiss` (4/6/8, `ceil(log2 N)` rounds).
- Seeding: teams stored in seed order (strongest = seed 1); single elim pairs 1vN, 2vN-1…
- Match routing: `winnerNext { matchId, slot }` and `loserNext` (3rd-place) edges; winners/losers fill slots as results land.
- Frontier gating: only matches with both participants set and no majority are recordable; Swiss round r+1 matches are generated when round r completes.
- Majority: `ceil(seriesLength / 2)` game wins ends a series; no game can be recorded after a majority; per-game winner + optional scores; no draws.
- Editing: re-recording a decided match re-settles downstream — participants re-derived, downstream games cleared only where participants changed.
- Completion: series → its match decided; single-elim → final + 3rd-place decided; swiss → last round all decided. `standings()` for Swiss (wins, then strength, then game wins).
- Swiss pairing: within same-win-count groups by seed, adjacent pairs, no rematches, floats for odd groups.

## Out of scope (this ticket)

Storage, Games tab, bracket UI, record modal, split integration, backup v3, double elimination, byes, manual seeding.

## Acceptance

- [ ] `buildBracket` produces correct structures for all three formats at all supported team counts (deterministic ids `m-<round>-<position>`)
- [ ] `applyResult` validates frontier + game legality, resolves majority, advances winners/losers
- [ ] Swiss pairing avoids rematches and handles odd groups; next round only exists after the current one completes
- [ ] Editing a result re-settles downstream; unrelated decided matches keep their games
- [ ] Completion detection + `standings()` correct per format
- [ ] Full behavioral test suite in `src/tournament/bracket.test.ts` (mirrors the solver-seam pattern)
