# 22: Let the compiler catch dead code

**Status:** ready-for-agent

**What to build:** A half-finished refactor or a stale rename cannot sit in the tree
unnoticed: `npm run build` fails and names the line. This is the only mechanism in the repo
that notices a handler nobody calls.

**Evidence.** `tsconfig.app.json` sets `"noUnusedLocals": false` while
`"noUnusedParameters": true`. Running the flag on today's tree:

```
npx tsc -p tsconfig.app.json --noUnusedLocals --noEmit
```

reports **19 findings** (`.scratch/app-health/issues/02` says 20 and lists stale line numbers;
its list is not used). The real list, re-derived:

| File:line | Symbol | Disposition |
|---|---|---|
| `src/App.tsx:30` | `DisciplineEditModal` import | delete — `DisciplinesScreen` owns it (`src/domain/DisciplinesScreen.tsx:104`) |
| `src/App.tsx:48` | `validateTeamParticipation` import | already gone via ticket 21 |
| `src/App.tsx:123` | `strengthsFor` | delete — the roster renders no strength column from it |
| `src/App.tsx:130` | `badgeClass` | delete — the live badge class is built inline at `:1105` |
| `src/App.tsx:179` | `effectiveTheme` | delete — see the cascade below |
| `src/App.tsx:666` | `showHistory` | delete — dead duplicate of `gotoHub("history")` |
| `src/App.tsx:670` | `showDisciplines` | delete — dead duplicate of `goDisciplines` |
| `src/App.tsx:742` | `enterMatchFlow` | delete — `startMatch` is the live entry |
| `src/App.tsx:754` | `finishSplit` | delete — tournament submit goes `SplitScreen.onSubmitTournament` → `consumeTeams` |
| `src/App.tsx:759` | `recordTournamentResult` | delete — `TournamentScreen.onRecord` calls `recordResult` directly |
| `src/App.tsx:772` | `showTournamentView` | delete — `openTournament` (`:738`) is the live one |
| `src/data/sample-data.ts:74` | `ROLE_NAMES` | delete — `autoGenerateSampleData` uses `PLAYER_NAMES` only |
| `src/domain/DisciplineEditModal.tsx:32` | `isNew` | delete — `isEdit`/`isBuiltIn` cover the three cases |
| `src/nav.tsx:1` | `Id` import | delete |
| `src/roster/PlayerEditModal.tsx:32` | `d` | delete the binding: `player.capabilities.map((c) => {` |
| `src/tournament/TournamentScreen.tsx:4` | `teamName` import | delete (keep line 2's type imports) |
| `src/session/split-module.ts:7` | all imports | deleted by ticket 21 |
| `src/tournament/team-participation-validator.ts:1` | `TeamSlot` | deleted by ticket 21 |
| `src/tournament/tournament-domain-fix.ts:13` | `TeamSlot` | deleted by ticket 21 |

**Staleness correction (absorbed from `.scratch/app-health/issues/02`):** its line numbers
and its count of 20 are wrong. Its six "dead handlers" and three "dead helpers" are all real
and all present above, but three of its 20 had already been resolved by other work, and
`app-health/02` predates ticket 21 removing the three `TeamSlot`/import findings. The ticket
is right about the mechanism and wrong about the inventory; the flag is the source of truth.

**The cascade is expected.** Removing `effectiveTheme` (`:179`) leaves `systemDark` (`:177`)
unused, because `effectiveTheme` is its only reader. Delete `:177` too, and no behaviour is
lost: `auto` is already handled in CSS — `tokens.css` defines its dark values under a
`prefers-color-scheme` query and the effect at `:184-196` only writes or deletes
`data-theme`, so `auto` → `delete el.dataset.theme` → the media query decides. Method: run
the flag, resolve, re-run until clean. Record each pass in the Answer.

**Acceptance criteria:**
- [ ] `"noUnusedLocals": true` in `tsconfig.app.json`, with nothing else in that file changed
- [ ] `npx tsc -p tsconfig.app.json --noUnusedLocals --noEmit` prints nothing and exits 0 (baseline: 19 findings)
- [ ] `npx tsc -b` and `npm run build` are green from a clean tree
- [ ] Every finding is resolved by **removing** the code, or by wiring it up where a real caller was clearly waiting — the Answer records which, per symbol
- [ ] `grep -rn "void [a-zA-Z]*;\|@ts-ignore\|noUnusedLocals" src/` finds no silencing: no `void x;` statement, no underscore-prefixed rename, no suppression comment
- [ ] The browser suite passes with no spec edited, proving behaviour is unchanged
- [ ] The second pass is recorded: deleting `effectiveTheme` also deletes `systemDark`, and auto-theme still resolves via the CSS media query

**Blocked by:** 21 — both edit `src/App.tsx` and the two validator modules ticket 21 deletes.
