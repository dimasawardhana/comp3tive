# 05: Editable results

**What to build:** The split is a proposal, not gospel: the organizer can swap any two Players between Teams with the strength gap updating live, and re-roll the split freely. Edits are reflected in the saved Session.

**Blocked by:** 04 (Session split flow)

**Status:** resolved

## Answer

Built editable results on the Split screen.

- Swap mode: tap a player on one team, then one on the other - they exchange, roles are re-derived (MLBB keeps full 5-role coverage via the solver's role assignment; futsal re-derives soft roles), strengths/gap/flags recompute, and the needle re-settles live. "Done"/"Cancel" exit.
- Re-roll: a fresh split from the session's OWN pool and settings (not the match setup), so the re-roll honors the exact inputs.
- Every edit persists back to the saved Session via a new `onPersistResult` path.
- Navigation: a topbar back button (match -> roster, split -> match) replaced the old Adjust/Split-again bar buttons.

New pure logic in `src/session/edit.ts` (swapPlayers, recomputeResult, freshSplit) covered by 4 unit tests. Verified in a real browser (10 checks): swap Budi <-> Andi updates both teams live and persists; re-roll reproduces a 5v5 from the same 10-player pool; MLBB teams keep all 5 roles before and after swaps. 42 unit tests green, tsc + build clean.

**Design reference:** `docs/design.md` + the prototype in `prototype/` (the Split screen's live gap meter is the signature interaction).

- [ ] Swapping any two Players between Teams updates the displayed Teams and recalculates the strength gap live
- [ ] Re-rolling produces a fresh split from the same Session inputs
- [ ] Manual edits persist in the saved Session
