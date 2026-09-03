# 07: Export & import

**What to build:** The ADR-0001 migration path: the roster and all Sessions export to a single JSON file, and an exported file imports back — so data survives a browser or machine change.

**Blocked by:** 06 (Session history)

**Status:** resolved

## Answer

Built the ADR-0001 migration path.

- Backup format (versioned, portable): `{ version, exportedAt, players, sessions }` in `src/data/transfer.ts` with `serializeBackup` / `parseBackup` (specific user-readable errors for invalid JSON, wrong version, malformed records) - 6 unit tests.
- `replaceAllPlayers` / `replaceAllSessions` added to the storage interfaces (single-transaction atomic replace in IndexedDB; map replace in memory).
- UI: a quiet "Export data / Import data" footer on the roster screen; import validates, confirms the replacement, rewrites both stores, and refreshes roster + history.

Verified in a real browser (10 checks): export downloads a versioned backup with the roster + session; delete everything; import restores players + sessions (history lists the restored session); invalid JSON and unsupported version show clear inline errors. Also found and fixed a navigation gap (History screen had no back button). 48 unit tests green, tsc + build clean.

- [ ] Export produces a JSON file containing the roster and all Sessions
- [ ] Import restores the roster and Sessions from an exported file (replacing current data after confirmation)
- [ ] Imported data is immediately usable in the app
