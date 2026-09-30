# 02: A Player carries a creation timestamp

**Status:** ready-for-agent

**What to build:** `Player.createdAt`, written on creation and preserved on edit, and the Dashboard's
"Recently added" teaser ranks by it instead of by the roster's physical order.

**Evidence.** "Recently added" is not expressed anywhere; it is inherited from a storage engine's
iteration order.

`src/storage/indexed-db.ts:249-252` — the list call is a bare `getAll()`:

```ts
async list() {
  const database = await openDb(dbName);
  const store = database.transaction(storeName, "readonly").objectStore(storeName);
  return reqToPromise(store.getAll() as IDBRequest<T[]>);
}
```

No object store declares an index (`createIndex` appears nowhere in the repo), and `getAll()` returns
records in **key order** — ascending id. `useRoster` then applies no sort at all
(`src/roster/useRoster.ts:14-15`), so the order the Organizer sees is insertion order within a session
and **id-ascending order after a reload**. The Dashboard takes the tail: `players.slice(-3)`
(`src/dashboardTeasers.ts:14-16`).

`CONTEXT.md` documents the consequence as intentional: "a Player carries no creation timestamp".
`src/domain/types.ts:14-21` confirms it — `Player` is `id`, `communityId`, `name`, `notes?`,
`capabilities`, and nothing else. Of all the aggregates only `Community`, `Tournament`, `Session` and
`SavedSquad` carry `createdAt` (`src/domain/types.ts:10`, `:71`, `:171`, `:191`).

The suite passes today only because the seeded ids sort the same as their insertion order:
`e2e/tests/dashboard/dashboard.spec.ts:362-368` asserts the teasers read `Alpha Two`, `Alpha Three`,
`Alpha Four` from ids `al-1`…`al-6`. Any store that does not return id-ascending order — a server
answering without an `ORDER BY`, a hand-imported backup whose ids are `crypto.randomUUID()`, a
`name`-derived id — changes a visible Dashboard row. This is the ordering the backend cannot be
trusted to preserve, which is why the meaning has to be written down rather than inherited.

**What to build, exactly.**

1. **`Player.createdAt: number`** (`src/domain/types.ts:14-21`), epoch ms, with the same comment style
   the other four timestamps use.
2. **Written at every creation site**, and only at creation:
   - `src/roster/PlayerEditModal.tsx:120` — `player?.id ?? crypto.randomUUID()` becomes the id, so the
     timestamp follows the same rule: `player?.createdAt ?? Date.now()`. This is the one site that
     must distinguish create from edit; an edit must never move a player to the top of "Recently
     added".
   - `src/data/player-import.ts:201` (CSV) — stamp `Date.now()` for every imported player, in the
     order they are parsed so ties are not created wholesale.
   - `src/App.tsx:572` (JSON import) — preserve the file's value when it is a finite number, else
     stamp. Same shape as the existing id rule on that line ("preserves file id, else
     `crypto.randomUUID()`").
3. **`recentPlayers` sorts by it** (`src/dashboardTeasers.ts:14-16`): the latest `createdAt`
   descending, with ties broken by id ascending so the result is deterministic regardless of input
   order — exactly the tie-break `recentActiveTournaments` already uses on the same file (`:24-28`).
   Sorting descending and slicing the head replaces `slice(-3)`, which was only correct because the
   input happened to be insertion-ordered.
4. **The roster screen's own order is unchanged.** `useRoster` still applies no sort and the Roster
   list keeps its current display order; this ticket changes what "recently added" *means*, not how
   the roster lists players. Changing both at once would move two visible surfaces for one decision.
5. **`CONTEXT.md`'s Recent Player entry is rewritten** (already done in this change: "Recently added"
   now reads the latest `Player.createdAt`). No further edit.

**Acceptance criteria:**
- [ ] `Player` declares `createdAt: number` and `npx tsc -b` forces every construction site to supply
      it — the compiler is the completeness check, so no site may cast around it
- [ ] Creating a player stamps `createdAt`; editing an existing player leaves it byte-identical,
      asserted by a unit test over the modal's produced value or a focused test of the id/timestamp
      rule
- [ ] `recentPlayers` returns the three latest by `createdAt`, in descending order, and is
      deterministic for equal timestamps — a unit test proves order from a **shuffled** input, which
      is the property `slice(-3)` did not have
- [ ] A backup round trip preserves `createdAt`, covered by the existing transfer tests plus one
      assertion that a v4 file with timestamp-less players still imports (stamping on import rather
      than throwing)
- [ ] `e2e/tests/dashboard/dashboard.spec.ts` stays green **unchanged** — the seeded ids and insertion
      order agree, so the reordering must not alter what that spec observes
- [ ] `e2e/support/seed.ts` and every spec that writes a player record supplies `createdAt`; the
      seeded values are monotonic so "newest last" keeps its documented meaning (that interface's
      comment already says "Roster players, newest last")
- [ ] `npx vitest run` exits 0; `npx tsc -b` exits 0; `npm run e2e` exits 0

**Blocked by:** —

**Notes:** Do not add `updatedAt` or `deletedAt`; this ticket adds exactly one field, because a
Player's creation time is the only order the product displays. Do not re-sort the Roster screen or
change `useRoster`. The `dashboardTeasers` doc comment currently explains that a Player has no
timestamp; that explanation is what this ticket replaces, so update the comment with the code.
