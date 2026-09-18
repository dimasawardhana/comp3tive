# 04: Deletes remove the row from the screen

**Status:** ready-for-agent

**What to build:** Deleting a player, a tournament, or a session removes it from the screen immediately, not just from storage — and a delete that fails says so instead of doing nothing visible.

**Evidence (absorbed from `.scratch/app-correctness/issues/02`).** Reproduced live: 10 seeded players → Roster. Opened Player 1's modal, clicked Delete, accepted the native confirm.

```
before: 10 rows
after:  10 rows
firstRow: "01 | Player 1 | MLBB | ›"
```

IndexedDB inspection afterwards: `["p10","p2","p3","p4","p5","p6","p7","p8","p9"]` — `p1` **is** gone from storage. After a full reload: 9 rows, first row "Player 10". The store and the in-memory list diverge. Three call sites write straight to the store and skip the hook that owns the list:

| Handler | Line | Calls | Should call |
|---|---|---|---|
| `deletePlayer` | `src/App.tsx:482-485` | `rosterStore.deletePlayer(id)` | `roster.deletePlayer(id)` (`src/roster/useRoster.ts:42-47`) |
| `deleteTournament` | `src/App.tsx:762-765` | `tournamentStore.deleteTournament(id)` | `tournaments.deleteTournament(id)` (`src/tournament/useTournaments.ts:42-47`) |
| History row delete | `src/App.tsx:1209` | `sessionStore.deleteSession(id)` | `sessions.deleteSession(id)` (`src/session/useSessions.ts:41-47`) |

All three hooks already expose the correct method and already update their own state (`useRoster.ts:44`, `useTournaments.ts:45`, `useSessions.ts:44` all `set…((prev) => prev.filter(…))`). The correct pattern is used one line away for squads (`src/App.tsx:1222`, `savedSquads.deleteSquad`). Because the handlers write through the store, a reload "fixes" the UI — which is exactly why a spec that reloads between steps cannot see this class of bug.

**Acceptance criteria:**
- [ ] `deletePlayer` calls `roster.deletePlayer`; `deleteTournament` calls `tournaments.deleteTournament`; the History row's `onDelete` calls `sessions.deleteSession`
- [ ] Deleting a player removes the row from the roster without a reload; deleting a tournament removes the row from the Games list without a reload; deleting a session removes the row from History without a reload
- [ ] Each delete is still persisted — it survives a reload
- [ ] Deleting the currently open tournament still redirects to the Games hub (`deleteTournamentFromUI`, `src/App.tsx:766-771`), and the `GamesScreen onDelete` prop keeps working
- [ ] **Decided:** each of the three handlers catches, emits `notify(…, "error")` through the existing toast (`src/App.tsx:163-171`, `.toast-container` at `:1257`), and does not rethrow — `PlayerEditModal.remove` (`src/roster/PlayerEditModal.tsx:141-151`) calls `void remove()`, so a rejection would otherwise be unhandled and invisible
- [ ] On a failed delete the modal closes and the row stays visible, with the toast naming the reason — the list keeps showing the record that still exists
- [ ] New `e2e/tests/roster/delete-row.spec.ts` (seeded, 1 test): seed 3 players, register a `dialog` handler that accepts (Playwright dismisses native dialogs by default, which is what blocked automation during the audit), open Player 1, click Delete, assert the row count goes 3 → 2 **without a reload**; reload and assert it is still 2; then delete a tournament from Games and assert its row disappears without a reload
- [ ] `src/tournament/bracket.test.ts`, `src/solver/**` and every other phase's files are untouched

**Blocked by:** 01 — the new spec uses the shared seeded helper (`.scratch/debt/issues/01`)

**Notes:** These are one-line changes each. They matter more than their size because the product currently confirms a destructive action and then visibly does not perform it. `src/App.tsx` handler edits are Phase A's; C's decomposition lands after A and must preserve this behaviour exactly.
