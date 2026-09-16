# 06: Import merge keeps each record's community

**Status:** ready-for-agent

**What to build:** Restoring a backup leaves every record attached to the community it came from, so nothing lands where no screen can show it.

**Evidence (absorbed from `.scratch/app-correctness/issues/04`).** `handleImport` (`src/App.tsx:426-462`) merges by id and, for players and squads, overrides the community:

```ts
// v1 backups (e.g. mpl-id-roster.json): adopt players into active community, not synthetic default.
const importCommunityId = activeCommunity?.id ?? newCommunities[0]?.id ?? "community-default";   // :456
...
for (const p of newPlayers) await roster.savePlayer({ ...p, communityId: importCommunityId });     // :458
for (const s of newSessions) await sessionStore.saveSession(s);                                   // :459 — keeps its own
for (const t of newTournaments) await tournamentStore.saveTournament(t);                          // :460 — keeps its own
for (const q of newSquads) await squadStore.saveSavedSquad({ ...q, communityId: importCommunityId }); // :461
```

For a **v4** backup — the current format (`src/data/transfer.ts:9`, `version: 4`), which carries `communities` and per-record `communityId` — this splits a restore down the middle: players and squads are re-homed to whichever community happens to be active, while their sessions and tournaments stay on the original.

`parseBackup` has **already** resolved community ids correctly — it adopts anything missing or unknown into the first community (`src/data/transfer.ts:128-140`, via the `adopted` helper) with tests at `src/data/transfer.test.ts:94-116` — so the override undoes work already done. The deleted comment scopes its intent to **v1** backups, where records genuinely have no community, and `parseBackup` handles that case itself. The override is therefore both over-broad and redundant.

**Acceptance criteria:**
- [ ] The `communityId` override is removed from the player loop (`src/App.tsx:458`) and the squad loop (`:461`); `importCommunityId` at `:456` is deleted
- [ ] Importing a v4 backup with two communities restores players, sessions, tournaments and squads each to its own community
- [ ] After import, no record references a community that does not exist
- [ ] A v1 backup (no `communities`) still imports, with everything adopted into one community
- [ ] A players-only roster file (e.g. `sample-data/futsal-roster.json`, `version: 1`, 25 players) still imports into the active community through the players-only JSON branch, which is untouched by this ticket
- [ ] Re-importing the same file is idempotent — ids already present are not overwritten (the existing merge contract)
- [ ] `src/data/transfer.test.ts` gains a two-community round trip through `serializeBackup` → `parseBackup` asserting every record keeps its starting `communityId` and that no record points at a missing community
- [ ] New `e2e/tests/roster/import-community.spec.ts` (seeded, 1 test): start with one active community, import a v4 backup carrying two other communities each with its own players, accept the merge confirm (`page.once("dialog", (d) => d.accept())`), then switch community and assert each community's roster shows its own players and the originally-active community did not absorb them

**Blocked by:** 01 (shared seeded helper) and 05 — 05 also edits `src/data/transfer.test.ts`, so this one lands after it to avoid a same-file collision

**Notes:** This is the only defect of its group whose symptom is silent — the import reports success, and the missing records are only noticed later, by their absence. `src/App.tsx`'s import path is Phase A's; C's decomposition lands after A and must preserve this behaviour exactly.
