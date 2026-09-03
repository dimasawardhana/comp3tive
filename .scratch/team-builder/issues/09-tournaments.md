# 09: Tournaments (games)

**What to build:** A competition layer on top of splits. Organizers create a Tournament (name, discipline, format, series length, team count) before splitting; the split inside a tournament locks its team count; submitted teams enter a bracket (single elimination) or standings table (Swiss) where match results are recorded per game (winner + optional scores, no draws) and progress persists per community. Backup carries tournaments.

**Blocked by:** 04 (Session split flow), communities (just shipped)

**Status:** planned — spec: `docs/spec/0002-tournaments-v1.md`, decision: `docs/adr/0002-tournament-first-flow.md`

## Answer

Planned, not yet built. The full design is in the spec; the shape in brief:

- One model: Series (2 teams, best-of-N), Single elimination (2/4/8), Swiss (4/6/8, `ceil(log2 N)` rounds). Double elimination deferred.
- Room-first: the tournament is created before teams exist; the split serves it with a locked team count.
- Results: per-game A/B winner + optional scores; no draws; majority takes the series; bracket advances automatically; only frontier matches are recordable; every result stays editable and the bracket recomputes.
- Storage: one document per tournament (teams + matches + games inside), new `tournaments` store (DB v5), community-scoped, backup v3.
- Pure seam: `buildBracket(tournament, teams)` + `applyResult(tournament, matchId, games)` — deterministic format logic with behavioral tests (seeding, 3rd-place, majority, frontier gating, Swiss pairing, completion).
- Re-roll/re-split lock at the first recorded result; teams are tournament-owned snapshots.

## Build tickets (when implementation starts)

- [ ] Domain: `Tournament`/`Match`/`Series` types, `TournamentStore`, DB v5
- [ ] Bracket machine: seeding, single-elim bracket, Swiss rounds/pairing/standings, 3rd-place, frontier gating, completion — pure + tested
- [ ] Games tab: list, create modal (constrained team counts), delete
- [ ] Tournament page: draft CTA, bracket/standings view, record-result modal, champion state
- [ ] Split flow integration: locked team stepper, "Submit teams" action
- [ ] Backup v3 + migration; CONTEXT.md terms already added
