# 06: The Account stays authoritative, and a stale device is refused

**Status:** ready-for-agent

**What to build:** Edits made while signed in reach the Account without the Organizer thinking about
it, and if another device changed the same Community first, the losing device is told instead of
silently overwriting.

**Evidence.** The failure this ticket exists to prevent is invisible today, and the client has nothing
to detect it with:

```
$ grep -rniE 'updatedAt|deletedAt|softDelete|revision' src/
(no matches)
```

Every save is a whole-document upsert, and `save`/`remove` resolve on the IndexedDB request rather
than on transaction commit (`src/storage/indexed-db.ts:254-263`), so writes are last-write-wins with
no compare-and-swap anywhere. Two devices editing one Community therefore produce a silent overwrite
in which the loser's evening is gone and nothing reports it. The `replaceAll*` transaction
(`src/storage/indexed-db.ts:226-238`) is the one place the collection is replaced atomically, which is
the shape the upload reuses.

The trigger is already in the code's grain: every mutation goes through a hook that writes through the
store and then patches local state — `useRoster` (`src/roster/useRoster.ts:28-48`), `useSessions`,
`useSavedSquads`, `useTournaments`, `useDisciplines` — and several writes bypass the hooks entirely in
`src/App.tsx` (`:234`, `:310`, `:459`, `:468-470`). All of them are store calls, so the seam is the
single place a push can be observed without touching every screen.

**What to build, exactly.**

1. **Debounced whole-Community push.** After a mutation while signed in, the active Community's
   collections are uploaded as one document. Bursts are coalesced so a roster edit session produces
   one upload rather than one per keystroke, and the delay is short enough that a closed tab has
   almost certainly flushed. The push reads the payload the export already builds, so there is no
   second serialization path.
2. **A per-Community version.** The server document carries a version integer; a push sends the
   version it based its write on; the server accepts only if that is still current and answers with
   the new version. This is the compare-and-swap the client lacks, and it is the whole reason the
   ticket exists.
3. **A stale push is rejected with a message.** The Organizer is told the Account changed on another
   device and offered the reload. Silently clobbering is the bug; silently refusing is the second
   bug, because a refused write that says nothing looks like a save that worked.
4. **The decision logic is a pure function.** Given the local snapshot, the last-known server version,
   and the server's current version, it returns one of: push, push-and-adopt, reject-stale, or
   no-op-when-identical. It lives outside React and is unit-tested directly, because its failure mode
   is data loss and pinning that only through a browser test would be luck. The ADR-0007 rule applies:
   the store interface does not change shape, and this function is the only thing that talks to the
   network.
5. **Nothing pushes while signed out,** and a failed push is non-fatal. A failed upload degrades sync
   and never blocks the screen, matching `src/App.tsx:308-313`'s existing treatment of a failed
   persistence call.
6. **The last-known version and the adoption marker persist per Account**, under new `tb-` keys
   following the existing try/catch convention (`src/App.tsx:93-108`). A blocked `localStorage`
   degrades to re-checking with the server rather than throwing.
7. **The server stores one JSON document per `(account, community)`** — the `version: 5` backup
   payload plus a version integer — with no normalized tables and no foreign keys, per ADR-0007.
   Deliberately: Player deletion leaves dangling ids in `poolPlayerIds`,
   `result.teams[].slots[].playerId` and `matches[].teamAId` by design, tolerated at read time by one
   filter (`src/session/SplitScreen.tsx:265`), and a relational schema would reject what the app
   deliberately does. The Account is identified by the token, never by the payload.

**Acceptance criteria:**
- [ ] A mutation while signed in reaches the Account within the debounce window, asserted against a
      test server by fetching the document after the edit
- [ ] A burst of edits produces **one** push, asserted by counting requests across several rapid
      mutations
- [ ] Two clients based on the same version: the first is accepted, the second is rejected, and the
      first client's data survives on the server — the silent-loss case, asserted directly
- [ ] A rejected push surfaces a message naming the other device and offering a reload; the local data
      is not silently replaced
- [ ] The pure decision function is unit-tested over all four outcomes, including the
      identical-payload no-op, in a `*.test.ts` file (`vite.config.ts` collects only
      `src/**/*.test.ts`)
- [ ] Signed out, no push occurs — the same assertion as ticket 05's, kept green here
- [ ] A failed push leaves the app fully usable and the edit intact locally
- [ ] The document round-trips through `parseBackup` unchanged, including `disciplines[]`, so an
      Account's data can be imported as a file and vice versa
- [ ] `npx vitest run` exits 0, `npx tsc -b` exits 0, `npm run e2e` green with guest specs unchanged

**Blocked by:** 05 — a push needs an adoption boundary to be correct at the moment it starts.

**Notes:** Do not add per-record sync, tombstones, or field-level merge; no entity carries a
modification or deletion timestamp, so there is nothing to merge on and this ticket's whole-Community
granularity is the honest cut. Do not add a service worker or background sync: offline writes are
already durable in IndexedDB, and the next push after reconnect carries them. Do not push on every
render, and do not make the push a prerequisite for a write to be visible — local state stays the
render source.
