# 02: Deletes go through their hooks

**What to build:** Deleting a player, a tournament, or a session removes it from the screen immediately, not just from storage.

**The defect.** Three call sites write straight to the store and skip the hook that owns the in-memory list, so the list keeps the deleted record and the UI shows a row that no longer exists:

| Handler | Line | Calls | Should call |
|---|---|---|---|
| `deletePlayer` | `src/App.tsx:482-484` | `rosterStore.deletePlayer(id)` | `roster.deletePlayer(id)` (`src/roster/useRoster.ts`) |
| `deleteTournament` | `src/App.tsx:762-764` | `tournamentStore.deleteTournament(id)` | `tournaments.deleteTournament(id)` (`src/tournament/useTournaments.ts`) |
| History row delete | `src/App.tsx:1209` | `sessionStore.deleteSession(id)` | `sessions.deleteSession(id)` (`src/session/useSessions.ts`) |

Each hook's `delete*` does the same store write *and* updates its own state; the correct pattern is already used one line away for squads (`src/App.tsx:1222`, `savedSquads.deleteSquad`). Because these handlers write through the store, a reload "fixes" the UI — which also means the bug is invisible to a test that reloads between steps.

- Swap the three store calls for their hook methods.
- `deleteTournament` is passed to `GamesScreen` as `onDelete` **and** used by `deleteTournamentFromUI`; both keep working, since the hook is in scope.
- Check the `.catch` story while here: the hook methods `await` the store, so a rejected delete should surface as a toast rather than an unhandled rejection.

**Blocked by:** —

**Status:** resolved

- [ ] Deleting a player removes the row from the roster without a reload
- [ ] Deleting a tournament removes the row from the Games list without a reload
- [ ] Deleting a session removes the row from History without a reload
- [ ] Each delete is still persisted (survives a reload)
- [ ] Deleting the currently open tournament still redirects to the Games hub (the `deleteTournamentFromUI` path)
- [ ] A failed delete surfaces a message rather than silently doing nothing
- [ ] E2e coverage for at least one of the three, asserting the row is gone **without** reloading — the current suite would not catch this class of bug

**Design reference:** none.

**Notes:** These are one-line changes each. The reason they matter more than their size is that the product currently confirms a destructive action and then visibly does not perform it.

## Comments

Resolved by commit `a651062` ("fix: deletes go through the hook that owns the list"), which routes
`deletePlayer` and `deleteTournament` through their hooks and adds
`e2e/tests/roster/delete-row.spec.ts`.

Also absorbed into Phase A of the debt repayment effort as
`.scratch/debt/issues/04-deletes-remove-the-row-from-the-screen.md`. Do not start that copy — this
ticket's work has shipped.
