# 01 — Delete the code nothing calls

> **Superseded.** The live copy of this ticket is
> [`debt/21`](../../debt/issues/21-delete-the-code-nothing-calls.md). This file is history; see
> [`.scratch/app-health/README.md`](../README.md) for the pairing of all sixteen.

**What to build:** A reader — human or agent — opening `src/` can trust that everything in it is
live. Searching the repo for the tournament rules returns exactly *one* answer, not two competing
ones, and nothing in the build is a self-declared "deep module" that no screen ever calls.

**Evidence.** Verified by reference counting across `src/`:

| Module | Size | Status |
|---|---|---|
| `src/tournament/tournament-domain-fix.ts` | 270 lines | Unreferenced. Contains a **second** `validateTournamentSpec`, a second `validateTeamParticipation`, and an unused `checkTournamentReadiness`/`isTournamentReady` pair. |
| `src/session/split-module.ts` | 48 lines | Unreferenced. A self-declared deep module (`compute`/`swap`/`recompute`) documenting an interface nothing calls. |
| `src/tournament/team-participation-validator.ts` | 97 lines | Its only consumer is an unused import in `src/App.tsx`. |
| `TournamentScreen`'s "Re-split is locked after the first result." notice | ~3 lines | Unreachable: it renders when `canResplit` is true, but sits inside a `hasAnyGames &&` block, and `canResplit` is defined as `teams.length > 0 && !hasAnyGames`. The two conditions cannot both hold. |

**Blocked by:** None — can start immediately.

**Status:** resolved

- [ ] All three modules are deleted and no import statement in `src/` or `e2e/` references them
- [ ] `validateTournamentSpec` and `validateTeamParticipation` each exist in exactly one place, and the surviving definitions are the ones the app actually calls
- [ ] The unreachable notice is removed, and re-splitting after the first recorded result is still impossible — the lock is enforced by the absent affordance, which was always what enforced it
- [ ] `npx tsc --noEmit -p tsconfig.app.json` and `npm test` are clean (the unit-test count may fall only if tests covered deleted code; none do)
- [ ] Nothing else changes — this is deletion, not restructuring, and no behaviour moves

**Design reference:** none.

**Notes:** `src/data/samplePlayers.ts` (73 lines, referenced only by `src/data/transfer.test.ts`)
looks like a fourth case but is **not** in scope: it is the fixture that
`.scratch/app-correctness/03` uses to prove valid players still import cleanly. Its fate belongs to
that ticket. Deleting it here breaks that ticket's acceptance criterion.

**Why this is first:** two functions named `validateTournamentSpec` shipping in one repo is exactly
the ambiguity that makes an agent-assisted codebase expensive to navigate, and it is the cheapest
item on the list to remove.

## Comments

**Re-checked 2026-10-01 against `d98b95c`, against the code rather than against debt 21's
status — shipped. Resolved.**

- `src/tournament/tournament-domain-fix.ts`, `src/session/split-module.ts` and
  `src/tournament/team-participation-validator.ts` are all absent from the tree; nothing in
  `src/` or `e2e/` names them.
- `validateTournamentSpec` is defined once, at `src/tournament/tournament-validation.ts:9`, and
  that is the definition the app calls (`src/tournament/GamesScreen.tsx:123`,
  `src/shell/useSplitFlow.ts:335`).
- The unreachable notice is gone — `grep -rn "Re-split is locked" src/` returns nothing — and
  the lock it described still holds by the absent affordance: the split entry point is inside
  `tournament.teams.length === 0` (`src/tournament/TournamentScreen.tsx:283`), so once teams
  exist there is no CTA back into the flow, recorded result or not.
- `npx tsc -b` exits 0.

**One acceptance row is met in a stronger form than it was written, and that is worth saying
out loud rather than counting as a pass.** Row 2 asks that `validateTournamentSpec` *and*
`validateTeamParticipation` "each exist in exactly one place". `validateTeamParticipation`
exists in **zero** places — its only consumer was the unused `src/App.tsx` import this ticket
cites, so deleting the module deleted it. The row's purpose — one answer when you search for the
tournament rules — holds (`grep -rn "articipation" src/` returns nothing), but the literal
reading of the row is not satisfied and this ticket does not get to claim it was.

`src/data/samplePlayers.ts` still exists, which is correct: this ticket's own Notes rule it out
of scope and give its fate to `.scratch/app-correctness/03`.
