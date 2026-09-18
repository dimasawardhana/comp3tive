# 04: Import merge keeps each record's community

**What to build:** Restoring a backup leaves every record attached to the community it came from, so nothing lands where no screen can show it.

**The defect.** `handleImport` (`src/App.tsx:426-462`) merges by id and, for players, overrides the community:

```ts
// v1 backups (e.g. mpl-id-roster.json): adopt players into active community, not synthetic default.
const importCommunityId = activeCommunity?.id ?? newCommunities[0]?.id ?? "community-default";
...
for (const p of newPlayers) await roster.savePlayer({ ...p, communityId: importCommunityId });
for (const s of newSessions) await sessionStore.saveSession(s);          // keeps its own communityId
for (const t of newTournaments) await tournamentStore.saveTournament(t); // keeps its own communityId
for (const q of newSquads) await squadStore.saveSavedSquad({ ...q, communityId: importCommunityId });
```

For a **v4** backup — the current format, which carries `communities` and per-record `communityId` — this splits a restore down the middle: players and squads are re-homed to whichever community happens to be active, while their sessions and tournaments stay on the original. `parseBackup` has *already* resolved community ids correctly (adopting anything missing or unknown into the first community, `src/data/transfer.ts:128-140`), so the override undoes good work.

The comment scopes the intent to **v1** backups, where records genuinely have no community — and `parseBackup` already handles that case itself. The override is therefore both over-broad and redundant.

- Drop the override from the player and squad loops.
- Keep the v1 case working: it is already covered by `parseBackup`'s adoption, which has tests (`src/data/transfer.test.ts:78-116`).
- If a record somehow arrives with an unknown `communityId`, `parseBackup` has already re-homed it; do not re-implement that here.

**Blocked by:** —

**Status:** resolved

- [ ] Importing a v4 backup with two communities restores players, sessions, tournaments and squads each to their own community
- [ ] After import, no record references a community that does not exist
- [ ] A v1 backup (no `communities`) still imports, with everything adopted into one community
- [ ] A players-only roster file (e.g. `sample-data/*.json`) still imports into the active community
- [ ] Re-importing the same file is idempotent — ids already present are not overwritten (the existing merge contract)
- [ ] Regression test: a two-community round trip through `serializeBackup` → `parseBackup` → import lands every record where it started

**Design reference:** none.

**Notes:** This is the only one of the four fixes whose symptom is silent — the import reports success, and the missing records are only noticed later, by their absence.

## Comments

Resolved by commit `115a135` ("fix: an import merge keeps each record's own community"), which drops
the community override from the player and squad loops so every imported record keeps the
`communityId` `parseBackup` already resolved.

Also absorbed into Phase A of the debt repayment effort as
`.scratch/debt/issues/06-import-merge-keeps-each-community.md`. Do not start that copy — this ticket's
work has shipped.
