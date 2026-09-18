# 21: Delete the code nothing calls

**Status:** ready-for-agent

**What to build:** A reader — human or agent — opening `src/` can trust that everything in it
is live. Searching for the tournament validation rules returns exactly one answer, and no
module in the tree is a self-declared "deep module" that no screen calls.

**Evidence.** Verified by reference counting across `src/` and `e2e/`:

| Module | Size | Status |
|---|---|---|
| `src/tournament/tournament-domain-fix.ts` | 270 lines | Unreferenced. Declares a **second** `validateTournamentSpec` (`:35`) and a second `validateTeamParticipation` (`:95`), plus an unused `checkTournamentReadiness`/`isTournamentReady` pair. |
| `src/session/split-module.ts` | 48 lines | Unreferenced. Self-declared "Deep module: Split" exporting `compute`/`swap`/`recompute`. |
| `src/tournament/team-participation-validator.ts` | 97 lines | Its only importer is the unused import at `src/App.tsx:48`. |

The check this ticket runs before deleting, and which returns nothing today:
`grep -rn "split-module\|tournament-domain-fix" src/ e2e/` → no matches.

Plus one unreachable render at `src/tournament/TournamentScreen.tsx:353-355`:
`{canResplit && <span className="status-msg">Re-split is locked after the first result.</span>}`
sits inside `{hasAnyGames && (…)}` (`:352`), while `canResplit` is
`tournament.teams.length > 0 && !hasAnyGames` (`:250`). The two conditions are mutually
exclusive, so the notice has never rendered.

**The duplicate's extra rules — a finding, not a porting task.** The dead
`validateTournamentSpec` encodes four checks against the live
`src/tournament/tournament-validation.ts`:

| Dead check | Where it already lives |
|---|---|
| team size vs `discipline.team.minTeamSize`/`maxTeamSize` | the solver's sizing (`buildSettings`) and `MatchScreen`'s seat check (`src/session/MatchScreen.tsx:24-32`) |
| format × discipline compatibility | the live `getValidTeamCounts`, consumed by `GamesScreen`'s `TEAM_COUNTS` |
| `seriesLength ∈ {1,3,5}` | `GamesScreen`'s `BO: SeriesLength[] = [1, 3, 5]` (`src/tournament/GamesScreen.tsx:34`), the field's only producer |
| name required | the live validator, rule 4 |

The dead `getValidTeamCounts("single-elim")` returns `[4, 2, 8]` where the live one returns
`[2, 4, 8]` — the same set in a different order, which only changes a message string. **No
rule is lost, so nothing is copied back.** Record this per symbol in the Answer.

After deletion, `validateTournamentSpec` has exactly one definition and
`validateTeamParticipation` has **zero**. That is correct: its only consumer was an unused
import, and re-wiring a validator no screen asks for would be a feature, not this ticket.

**Acceptance criteria:**
- [ ] `grep -rn "split-module\|tournament-domain-fix\|team-participation-validator" src/ e2e/` returns nothing
- [ ] `grep -rn "export function validateTournamentSpec" src/` returns exactly one line, in `src/tournament/tournament-validation.ts`
- [ ] `grep -rn "validateTeamParticipation" src/` returns nothing
- [ ] `grep -rn "Re-split is locked" src/` returns nothing, and re-splitting after the first recorded result is still impossible
- [ ] `npx tsc -b` exits 0 and `npx vitest run` is green (the count may fall only if a test covered deleted code; none do — `grep -rn "tournament-domain-fix\|split-module" src/**/*.test.ts` returns nothing)
- [ ] The Answer records, per symbol in the dead `validateTournamentSpec`, which live check covers it, or states that the rule was unenforced and is therefore not re-added
- [ ] `git diff --stat src/index.css` is empty and no rendered string changes

**Blocked by:** —
