# Tournament-first flow, one competition model

Tournaments are created **before** teams exist: the container fixes the discipline, format, series length, and team count, and the split serves that contract. A standalone best-of game is the same entity as a tournament — a 2-team Series — not a separate feature. All results are per-game win/loss with optional scores, and draws do not exist.

**Status**: proposed

**Considered Options**:
- Split first, submit teams into a tournament afterwards: feels closer to the existing flow, but the tournament would inherit whatever team count the split happened to produce — 4 teams from a 10-player pool and 5 from an 11-player pool are different competitions. Format and size would be afterthoughts, and half-formed tournaments (created, no teams) could never exist.
- Tournament first (chosen): the room is the contract. The split locks its stepper to the room's team count, seeding is deterministic, and the bracket is computable the moment teams submit. One entity also means one UI, one storage document, one mental model — a best-of-3 between two teams is just a 2-team single-elimination tournament.
- Draws allowed: closer to real futsal, but every bracket rule, Swiss pairing, and completion check grows a third outcome; best-of series with draws (1-1-1) have no majority. The court resolves ties anyway — penalties, golden goal, rematch — so the app records what actually happened.

**Consequences**:
- A tournament without teams is a real, visible state (draft) with a "Split your teams" CTA — the pre-split container is a feature, not a bug.
- Re-roll and re-split lock after the first recorded result; results are always editable, so locking only protects the bracket's referential integrity, not the organizer's freedom.
- Teams are snapshots owned by the tournament; deleting a source session never damages a started tournament.
- Double elimination was not squeezed into v1 — it needs loser-bracket semantics this model doesn't force; the Match carries a `nextMatchId` with a winner slot now and a loser slot when double elim lands.
