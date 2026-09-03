# 04: Session split flow

**What to build:** The money demo - the full loop works: start a Session by selecting which Players are present, choose the Discipline, accept the suggested team count (floor of pool size ÷ team minimum) or override it, run the Fair split solver, and see the resulting Teams on screen with the strength gap and any flags (unfilled Roles, leftover MLBB players sitting out, sub-minimum sizes). Players without a Capability in the chosen Discipline are excluded from the split. The Session is saved.

**Blocked by:** 02 (Fair Split solver), 03 (Roster management)

**Status:** resolved

## Answer

Built the session split flow end-to-end (the money demo), following the design reference.

- Session persistence (ADR-0001): `SessionStore` interface + IndexedDB adapter (shared DB, version 2, second object store) + memory store; `Session` domain type added (pool, discipline, settings, result). Smoke-tested.
- Match screen: pool chips with live strength per selected discipline (players without a capability are disabled chips + a "players without a {discipline} capability are excluded" note), game cards (Futsal / MLBB with "5 v 5 + subs"/"roles covered"), team-count stepper with the suggested default (floor(pool/min)), live "Split N/M" label.
- Split screen: turf panel with the signature gap meter (needle + ticks + readout, "Dead even. Fair game." when balanced) for 2 teams; stacked cards + readout for 3+; bib colors for up to 5 teams (bib-c/d/e added to the palette); referee-voice flags (unfilled roles with best-fit covering, MLBB leftovers "sits out tonight", sub-minimum teams); deal-in animation respecting reduced motion.
- Sessions are saved to IndexedDB on every split.

Verified in a real browser (Playwright, 17 checks): 12-player roster → futsal split 11 into 6 v 5 with suggested 2 teams → session persisted (11-player pool) → adjust → MLBB switch (chip strengths recompute, Maya excluded as a disabled chip, count 10/11) → re-select → 11 split into 5v5 with all five roles assigned and exactly one leftover flagged ("Lina sits out tonight.") → two sessions persisted. 38 unit tests green, tsc + build clean.

**Design reference:** `docs/design.md` + the prototype in `prototype/` (Match and Split screens, both themes). The gap meter and referee flags are the signature; follow the prototype's anatomy.

- [ ] The organizer can start a Session, select present Players, pick a Discipline, and set the team count - with the suggested default shown
- [ ] Running the split displays Teams with the strength gap and all solver flags
- [ ] Players without a Capability in the chosen Discipline are excluded and this is visible
- [ ] The Session (pool, Discipline, settings, Teams) is saved and survives reload
