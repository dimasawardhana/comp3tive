# 01 — Delete the code nothing calls

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

**Status:** ready-for-agent

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
