# 05: Signing in moves the data

**Status:** ready-for-agent

**What to build:** Signing in takes the data on the device and makes it the Account's data; signing
out empties the device. The app is fully usable signed in and fully usable signed out, and a stale
session never destroys anything.

**Evidence.** The write paths this ticket hooks are already whole-collection operations, which is why
the design needs no merge:

```
src/storage/types.ts:15-20
export interface RosterStore {
  listPlayers(): Promise<Player[]>;
  savePlayer(player: Player): Promise<void>; // upsert by id
  deletePlayer(id: Id): Promise<void>;
  replaceAllPlayers(players: Player[]): Promise<void>; // atomic overwrite
}
```

Four more interfaces share that shape, and the atomic replace is a single transaction
(`src/storage/indexed-db.ts:226-238`). Today `replaceAll*` is almost entirely uncalled: the only live
caller is `clearPlayers`, which itself has no caller (`src/roster/useRoster.ts:50-56`), and the other
four methods are implemented but never invoked. This ticket gives them their real consumer.

The three hazards are all in code that runs on load:

1. **The orphan-repair effect writes immediately.** `src/App.tsx:225-237` re-homes records whose
   `communityId` is falsy or unknown, calling `roster.savePlayer` and `sessionStore.saveSession` in a
   `useEffect`. After a sign-out empties the stores this effect runs again against an empty world, and
   the first-sign-run path recreates `community-default`
   (`src/domain/useCommunities.ts:52-56`) and re-seeds the catalog
   (`src/domain/useDisciplines.ts:16-22`). Nothing may reach the network while signed out, and this is
   the effect that would try.
2. **The ad-hoc split swallows persistence failures.** `src/App.tsx:308-313` catches and ignores a
   failed `saveSession` ("Non-fatal: still show the split if persistence failed"). A sync failure must
   land in the same place: a degraded sync, never a broken screen.
3. **There is no ordering key to adopt by.** `Player` has no `createdAt` until ticket 02, and there is
   no `updatedAt` on anything, so "which side is newer" cannot be answered by comparing records.

**What to build, exactly.**

1. **First sign-in adopts the device's data.** On a successful sign-in, if the Account has never
   synced (no server document for any of its Communities), the device's Communities, Players,
   Sessions, Tournaments, Saved Squads and custom Disciplines become the Account's initial state. The
   mechanism is the existing backup payload: `serializeBackup` with `version: 5` (ticket 01) is the
   upload body, and `parseBackup` is the validator on the way back.
2. **A confirm guards the destructive case.** When the local roster is non-empty **and** the Account
   already has server data, the Organizer is asked before the local data is replaced, naming what is
   at stake (how many players and squads are on this device). The app's existing vocabulary is a
   `window.confirm` (`src/App.tsx:435-465` gates the import merge that way), and this follows it
   rather than introducing a new modal pattern. A prompt with an empty local roster is noise and must
   not appear.
3. **After adoption, the server wins on a fresh device.** Signing in on a device with no data pulls
   the Account's payload and writes it through the stores, then refreshes the hooks so the render
   source is the fetched data — the same write-then-refresh order the import path already uses
   (`src/App.tsx:459-474`).
4. **Explicit sign-out empties the local stores.** Every domain store is cleared with its
   `replaceAll*` (or `delete*` in a loop for the catalog, which has no `replaceAll*`), the `tb-`
   account-scoped keys are cleared, and `tb-theme`/`tb-layout`/`tb-rail` are kept, because a theme
   choice belongs to the device rather than the Account. `tb-community` self-heals either way
   (`src/domain/useCommunities.ts:52-56`), so it is decided by intent, not by mechanism.
5. **A stale token never clears anything.** Only an explicit sign-out is destructive. A 401 from the
   server, an expired token, or an offline load leaves the local data readable and writable, so a
   signed-in Organizer on a court with no signal still has a working app. This is the single most
   important behavioral rule in the ticket.
6. **One guard decides whether a write reaches the network.** The session module added by ticket 04
   owns it. While signed out, no request is made, including from the effects in `src/App.tsx:225-237`
   — and the clean answer is that those effects must not fire a sync at all during a clear, which is
   why the guard lives beside the data it protects rather than in the effect.
7. **The UI states which state the data is in**, using the vocabulary CONTEXT.md now defines: "On this
   device" and "In your Account". It appears where sign-out lives, and it says what changes without
   implying a lesser tool.

**Acceptance criteria:**
- [ ] Signing in on a device with local data and an Account that has never synced: the roster, squads,
      sessions, tournaments and custom disciplines all appear under the Account, with no prompt and no
      loss
- [ ] Signing in on a device with a non-empty roster into an Account that **already** has data asks
      before replacing, and the confirm's text names the counts
- [ ] Signing in on an empty device pulls the Account's data and renders it without a manual reload
- [ ] Signing out leaves every domain store empty (`listPlayers()` → `[]`, and the same for the other
      five) and the app usable as a Guest; `tb-theme` is unchanged across the sign-out
- [ ] A 401 with data present leaves the data readable **and** writable, asserted by a test that forces
      a 401 and then performs a mutation that still succeeds locally
- [ ] No network request is made while signed out, including on the first load after a sign-out —
      asserted by a test that signs out, mutates, and observes zero requests
- [ ] A failed request during a split still shows the split, matching the existing non-fatal behavior
      at `src/App.tsx:308-313`
- [ ] `Player.createdAt` (ticket 02) is preserved through an adopt and through a pull, so the Dashboard
      teasers are identical before and after a sign-in
- [ ] `npm run e2e` is green with the guest specs **unchanged**; `npx vitest run` exits 0

**Blocked by:** 01 (the payload must carry the catalog), 02 (adoption has no ordering key without it),
04 (there is no session to hook). Ticket 34 lands before this one.

**Notes:** Do not build the push/pull of ongoing edits here; this ticket moves data at the sign-in and
sign-out boundaries only, and ticket 06 makes the Account keep up with changes. Do not add a
`replaceAllDisciplines` to the store interface to save a loop — the interface is the ADR-0001 seam and
grows a method only when something needs it, which is the reasoning ticket 25 recorded. Do not clear
`localStorage` wholesale.
