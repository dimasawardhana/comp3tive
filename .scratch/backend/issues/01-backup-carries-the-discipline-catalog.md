# 01: The backup carries the discipline catalog

**Status:** ready-for-agent

**What to build:** `BackupData` gains a `disciplines[]` array and `version` goes to 5, so a custom
Discipline survives an export/import round trip — and so the catalog can be synced to an Account at
all.

**Evidence.** The catalog is the one aggregate the backup omits, and the omission is a silent data
loss:

```
$ sed -n '9,17p' src/data/transfer.ts
export interface BackupData {
  version: 4;
  exportedAt: string;
  communities: Community[];
  players: Player[];
  sessions: Session[];
  tournaments: Tournament[];
  savedSquads: SavedSquad[];
}
```

`saves and deletes custom disciplines` is tested (`src/storage/indexed-db.test.ts:89`) and
`DisciplineEditModal` builds custom entries from the Organizer's own input
(`src/domain/DisciplineEditModal.tsx:12-21`, `:127-140`), but nothing serializes them. Export on one
device, import on another, and every discipline the Organizer defined is gone while their
capabilities in it survive as orphans.

The loader also makes the store non-authoritative: `useDisciplines.refresh` re-seeds
`SEED_DISCIPLINES` whenever the list reads back empty (`src/domain/useDisciplines.ts:16-22`), so an
empty catalog is indistinguishable from a fresh install.

**Built-ins are constants, and the code is authoritative for them.** Verified read-only in the UI:
every field is `disabled={isBuiltIn}` (`src/domain/DisciplineEditModal.tsx:190`, `:204`, `:219`,
`:232`, `:242`, `:258`, `:288`), delete returns early for a built-in (`:155`), and the modal shows
"Built-in discipline — review only, not editable" (`:176-179`). They are seeded from
`src/domain/seed.ts` and carry `builtIn: true` (`src/domain/types.ts:117-118`) precisely so they
cannot be edited.

**What to build, exactly.**

1. **`BackupData`** (`src/data/transfer.ts:9-17`) gains `disciplines: Discipline[]` and
   `version: 5`. Update the version-history comment on the same block.
2. **`serializeBackup`** takes the catalog. Its parameter order is already `(players, sessions,
   communities, tournaments, savedSquads)` while the shape orders them differently, so add
   `disciplines` as the last parameter and keep the object literal in shape order. The one caller is
   `src/App.tsx:416`, which already holds the catalog in hook state; the sessions argument is
   re-read from the store (`src/App.tsx:414`) and the catalog does not need that treatment.
3. **`parseBackup`** (`:106`) accepts `5` in the version gate (`:115-116`) and defaults
   `disciplines` to `[]` when absent, the way `tournaments` and `savedSquads` already are
   (`:150`, `:154`) — so v1–v4 files import with no explicit branch.
4. **Built-ins win on import.** For any id that is a built-in in code, take the code's definition
   and ignore the file's. Everything else is taken from the file. Rationale: a built-in is immutable
   and the running build is authoritative; a file authored by a newer build (or hand-edited) must not
   be able to redefine futsal's roles or attributes. Implement it as a merge by id against
   `SEED_DISCIPLINES`, not as a filter that drops file entries.
5. **The import path writes the catalog.** `src/App.tsx:435-474`'s merge loop writes communities,
   players, sessions, tournaments and squads through the raw stores. Disciplines must be written
   through `catalog.saveDiscipline` in the same loop, before the players whose capabilities reference
   them, mirroring the existing rule that communities are written and refreshed first (`:459-466`).
6. **The merge stays additive.** Import never overwrites an existing record, and that must hold for
   disciplines too: an id already present on the device is left alone. The one exception is the
   built-in rule above, which is a definition refresh, not a record overwrite.

**Acceptance criteria:**
- [ ] A round trip through `serializeBackup`/`parseBackup` preserves a custom discipline byte-for-byte
      (id, name, shortName, roles, attributes, `strengthModel`, `team`) — asserted in
      `src/data/transfer.test.ts`, which is the existing precedent for format tests
- [ ] A v4 file with no `disciplines` key imports with `disciplines` equal to the built-ins seeded
      from `SEED_DISCIPLINES`, and parses as `version: 5` — the same shape as the existing
      `v3 -> v4` test at `src/data/transfer.test.ts:120-132`
- [ ] A v1 file (no `communities`, no `disciplines`) still imports, keeping the existing
      Default-community adoption asserted at `src/data/transfer.test.ts:81-99` green
- [ ] A v5 file that redefines `futsal`'s roles is imported with the **code's** futsal definition,
      asserted by a test that supplies a mutated built-in and expects the seed's roles back
- [ ] Importing a backup with one custom discipline into a device that already holds it writes it
      once and leaves the existing record unchanged
- [ ] `grep -n 'version: 4' src/` returns nothing; `grep -n 'version: 5' src/data/transfer.ts`
      returns the interface field
- [ ] `npx vitest run` exits 0 and `npx tsc -b` exits 0

**Blocked by:** — (the format change is independent of the backend; it is a prerequisite of ticket 06
so the Account's payload can carry the catalog)

**Notes:** Do not touch `SEED_DISCIPLINES` values, `DisciplineEditModal`'s slug rules, or the
non-cascading delete semantics. `docs/spec/0001-team-builder-v1.md` and `.scratch/team-builder/spec.md`
both describe the backup as covering roster and sessions; both are reconciled by ticket 07's copy pass
only where they make a claim this change falsifies.
