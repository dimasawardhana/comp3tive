# Board

_Written by Seraph. Do not edit — this file is replaced on every change._

## Backlog

### TASK-111 · Backup v5 carries the discipline catalog

> **Goal:** A custom Discipline survives an export/import round trip, and the payload can carry the catalog to an Account at all.
- priority: high
- triage: ready-for-agent
- updated: 2026-10-14T16:22:19Z
references:
  - .scratch/backend/issues/01-backup-carries-the-discipline-catalog.md
  - docs/superpowers/plans/2026-09-28-account-and-durability.md
  - src/data/transfer.ts
  - src/shell/usePlayerImport.ts

> **Done when:** A round trip through `serializeBackup`/`parseBackup` preserves a custom discipline byte-for-byte (id, name, shortName, roles, attributes, strengthModel, team). A v4 file with no `disciplines` key imports with the built-ins and parses as `version: 5`. A v1 file still imports, keeping the existing Default-community adoption. A v5 file redefining `futsal`'s roles is imported with the CODE's definition, not the file's — built-ins are code-authoritative. Importing a backup with one custom discipline into a device that already holds it writes once and leaves the existing record unchanged. `grep -n 'version: 4' src/` returns nothing. `npx vitest run` and `npx tsc -b` exit 0.

> Phase E ticket 01 -- `.scratch/backend/issues/01-backup-carries-the-discipline-catalog.md`, plan Task 1 (`docs/superpowers/plans/2026-09-28-account-and-durability.md`). THE PROBLEM: the catalog is the one aggregate the backup omits, and the omission is silent data loss -- export on one device, import on another, and every custom Discipline is gone while capabilities in it survive as orphans. `useDisciplines.refresh` also re-seeds `SEED_DISCIPLINES` whenever the list reads back empty, so an empty catalog is indistinguishable from a fresh install. WHY IT IS FIRST: a per-account catalog cannot sync while the catalog is absent from the payload, so this is a prerequisite of ticket 06, not a follow-up. The built-ins-win merge is a merge BY ID against `SEED_DISCIPLINES`, not a filter that drops file entries. Call sites were resolved by reading the file, not from the ticket's line numbers: `serializeBackup`'s only production caller is now `src/shell/useAppCommands.ts` (the ticket says `src/App.tsx:416`, stale since C and D decomposed that file). Pure and local; no gate.

### TASK-112 · A Player carries a creation timestamp

> **Goal:** "Recently added" is expressed rather than inherited from a storage engine's iteration order, and the Dashboard ranks by it.
- priority: high
- triage: ready-for-agent
- updated: 2026-10-14T16:22:35Z
references:
  - .scratch/backend/issues/02-player-gains-a-creation-timestamp.md
  - docs/superpowers/plans/2026-09-28-account-and-durability.md
  - src/domain/types.ts
  - src/dashboardTeasers.ts

> **Done when:** `Player` declares `createdAt: number` and `npx tsc -b` forces every construction site to supply it, with no cast around it. Creating a player stamps `createdAt`; editing one leaves it byte-identical. `recentPlayers` returns the three latest by `createdAt` descending, deterministic for equal timestamps (ties by id ascending), proven from a SHUFFLED input — the property `slice(-3)` did not have. A backup round trip preserves it, and a v4 file with timestamp-less players still imports by stamping rather than throwing. `e2e/tests/dashboard/dashboard.spec.ts` stays green UNCHANGED. `e2e/support/seed.ts` and every spec that writes a player supplies it, with monotonic seeded values so "newest last" keeps its documented meaning.

> Phase E ticket 02 -- `.scratch/backend/issues/02-player-gains-a-creation-timestamp.md`, plan Task 2. THE DEFECT: "Recently added" is not expressed anywhere. `list()` is a bare `getAll()`, no object store declares an index, and `useRoster` applies no sort -- so the order is insertion order within a session and ID-ASCENDING after a reload, and the Dashboard takes `players.slice(-3)`. Today's suite passes only because the seeded ids happen to sort the same as their insertion order. A server answering without an ORDER BY changes a visible Dashboard row, which is why the meaning has to be written down. WHY IT IS SECOND: ticket 05's adoption has no ordering key without it. The four construction sites and their rules: `PlayerEditModal` (`player?.createdAt ?? Date.now()` -- the one site that must distinguish create from edit), `player-import.ts`'s CSV branch (stamp per row in parse order so ties are not created wholesale), `usePlayerImport.ts`'s JSON import (preserve a finite file value, else stamp), and `e2e/support/seed.ts`. The Roster screen's own display order is deliberately unchanged -- changing both would move two visible surfaces for one decision.

### TASK-114 · An Account exists, and the app knows who is signed in

> **Goal:** An Organizer can create an Account and sign in on the deployed site by passkey or Google, and the app knows whether it is signed in -- with no data movement yet.
- priority: high
- triage: ready-for-agent
- updated: 2026-10-14T16:22:35Z
references:
  - .scratch/backend/issues/04-an-account-exists.md
  - docs/superpowers/plans/2026-09-28-account-and-durability.md
  - docs/adr/0007-optional-backend.md
  - docs/adr/0008-account-identity.md

> **Done when:** `grep -rn 'import.meta.env' src/` returns exactly the API-base read. `.env.example` exists and `.env`/`.dev.vars` stay untracked. `wrangler.jsonc` carries `main`, `assets.run_worker_first: ["/api/*"]`, the D1 binding, and a CORRECTED "no Worker script and no main" comment. Navigating a browser DIRECTLY to an API path reaches the API, not the assets fallback. A new Account can be created by passkey and by Google on a deployed origin; Google on an Account that never attached it creates a SEPARATE Account rather than merging on a matching address. A synced passkey reuses its credential row rather than inserting a second. A non-increasing `signCount` does not fail authentication. The user handle is 64 random bytes with no PII. A passkey registered on localhost cannot authenticate against the deployed origin. Sign-out returns the app to the guest experience. `npm run e2e` green UNCHANGED, and a signed-out device makes zero requests.

> Phase E ticket 04 -- `.scratch/backend/issues/04-an-account-exists.md`, plan Task 4. THE GATE IS NOW CLEARED (2026-10-15): the store is D1 and the origin question is timed rather than blocking. D1 holds one row per (account, community) -- the pair as key, a version integer, the v5 payload as JSON -- because a conditional `UPDATE ... WHERE version = ?` against the primary is the atomic compare-and-swap ticket 06 needs; KV and R2 cannot do it (eventually consistent, last-write-wins) and Durable Objects would also work at the cost of namespaces and migrations. The canonical origin is a custom domain, but it does NOT block this task: build and test against localhost and workers.dev, where passkeys are disposable, and settle the domain before REAL organizers can register -- the moment a credential stops being test data. Record in `wrangler.jsonc` that the workers.dev host is the development origin and not the canonical one. THE LIBRARY IS NAMED: `@simplewebauthn/server` (v13) with its `@simplewebauthn/browser` counterpart, because ADR-0008 says the choice is part of the decision, not an implementation detail. THREE FIRSTS for this repo: the first Worker script, the first runtime secret, the first environment read in client code. Builds NO sync -- identity and data movement fail in different ways, and a session that is wrong makes every later bug look like a sync bug.

### TASK-115 · Signing in moves the data, signing out clears it

> **Goal:** Signing in takes the data on the device and makes it the Account's; signing out empties the device; a stale token never destroys anything.
- priority: high
- triage: ready-for-agent
- updated: 2026-10-14T16:26:55Z
references:
  - .scratch/backend/issues/05-signing-in-moves-the-data.md
  - docs/superpowers/plans/2026-09-28-account-and-durability.md
  - src/shell/useLegacyAdoption.ts
  - src/shell/useSplitFlow.ts

> **Done when:** Signing in on a device with local data and an Account that has never synced puts the roster, squads, sessions, tournaments and custom disciplines under the Account, with no prompt and no loss. Signing in with a NON-EMPTY roster into an Account that ALREADY has data asks before replacing, and the confirm names the counts. Signing in on an empty device pulls the Account's data and renders it without a manual reload. Signing out leaves every domain store empty (`listPlayers()` returns `[]`, and the same for the other five) and the app usable as a Guest, with `tb-theme` unchanged. A 401 with data present leaves it readable AND writable, asserted by forcing a 401 then performing a mutation that still succeeds locally. No network request is made while signed out, including on the first load after a sign-out. A failed request during a split still shows the split. `Player.createdAt` is preserved through an adopt and a pull, so the Dashboard teasers are identical before and after. `npm run e2e` green with guest specs UNCHANGED.

> Phase E ticket 05 -- `.scratch/backend/issues/05-signing-in-moves-the-data.md`, plan Task 5. BLOCKED BY TASK-111 (the payload must carry the catalog), TASK-112 (an ordering key to adopt by) and TASK-114 (a session to hook). This is ticket 05, the third step of Phase 2 -- do not start it until all three predecessors are done. THE SINGLE MOST IMPORTANT RULE: a sign-in never overwrites an Account that has already synced. Adoption is guarded by the ACCOUNT's state, not the device's -- existing server state is fetched and rendered, and the device's records are only ever offered as a deliberate choice. Under the old model a bad overwrite damaged only the local copy; now it is the one path that can destroy the AUTHORITATIVE copy. THREE HAZARDS all live in code that runs on load: (1) the orphan-repair effect in `src/shell/useLegacyAdoption.ts` writes immediately, so after a sign-out empties the stores it runs again against an empty world and the first-run path recreates `community-default` and re-seeds the catalog -- nothing may reach the network while signed out, and this is the effect that would try; (2) the ad-hoc split swallows persistence failures (`src/shell/useSplitFlow.ts`), and a sync failure must land in the same place -- a degraded sync, never a broken screen; (3) there is no ordering key to adopt by, which is what TASK-112 supplies. The adoption gate is the repo's ONE documented `window.confirm`, following the existing import-merge precedent rather than inventing a modal -- say so in a comment, per Phase D's no-native-dialogs constraint. `tb-theme`/`tb-layout`/`tb-rail` are KEPT on sign-out: a theme choice belongs to the device, not the Account.

### TASK-116 · The Account stays authoritative, and a stale device is refused

> **Goal:** Edits made while signed in reach the Account without the Organizer thinking about it, and if another device changed the same Community first, the losing device is told rather than silently overwriting.
- priority: high
- triage: ready-for-agent
- updated: 2026-10-14T16:27:20Z
references:
  - .scratch/backend/issues/06-the-account-keeps-up-with-changes.md
  - docs/superpowers/plans/2026-09-28-account-and-durability.md
  - docs/adr/0007-optional-backend.md
  - src/storage/types.ts

> **Done when:** A mutation while signed in reaches the Account within the debounce window. A burst of edits produces ONE push, asserted by counting requests across several rapid mutations. Two clients on the same version: the first is accepted, the second is REJECTED, and the first client's data survives on the server. A rejected push surfaces a message naming the other device and offering a reload, and the local data is not silently replaced. The pure decision function is unit-tested over all four outcomes including the identical-payload no-op, in a `src/**/*.test.ts` file. Signed out, no push occurs. A failed push leaves the app fully usable and the edit intact locally. The document round-trips through `parseBackup` unchanged, `disciplines[]` included. `npx vitest run` exits 0, `npx tsc -b` exits 0, `npm run e2e` green with guest specs unchanged.

> Phase E ticket 06 -- `.scratch/backend/issues/06-the-account-keeps-up-with-changes.md`, plan Task 6. BLOCKED BY TASK-115, which supplies the adoption boundary a push has to start from -- do not start it first. THE FAILURE THIS EXISTS TO PREVENT IS INVISIBLE TODAY: every save is a whole-document upsert, nothing carries `updatedAt`/`deletedAt`/`revision`, and `save`/`remove` resolve on the IndexedDB request rather than transaction commit -- so writes are last-write-wins with no compare-and-swap anywhere, and two devices editing one Community produce a silent overwrite in which the loser's evening is gone and nothing reports it. THE COMPARE-AND-SWAP IS `server/storage.ts`'s conditional `UPDATE ... WHERE version = ?` against D1's primary -- this is what makes the D1 choice load-bearing rather than incidental, since KV and R2 are eventually consistent and resolve concurrent writes to the same key as last-write-wins, which would reintroduce this exact bug. A rejected push must SAY SO: silently clobbering is the bug, silently refusing is the second bug, because a refused write that says nothing looks like a save that worked. The Organizer is shown which Communities are affected and when they were last changed elsewhere, and chooses: take the server's version, or push this device's over it deliberately. The decision logic is a PURE function outside React, unit-tested directly, because its failure mode is data loss. The Account is identified by the TOKEN, never by the payload. `src/account/sync-decision.ts` holds `decideSync(local, lastKnownVersion, serverVersion)` returning push / push-and-adopt / reject-stale / no-op; its test is `src/account/sync-decision.test.ts` (collect `.ts` only -- no jsdom, no `.tsx` tests). Deliberately not built: per-record sync, tombstones, field-level merge, background sync.

### TASK-113 · The public claims stop promising there is no account

> **Goal:** No public or product statement asserts comp3tive has no account and no server, and the one prohibition that forbids the feature is amended.
- priority: medium
- triage: ready-for-agent
- updated: 2026-10-14T16:22:35Z
references:
  - .scratch/backend/issues/03-the-public-claims-stop-promising-no-account.md
  - docs/superpowers/plans/2026-09-28-account-and-durability.md
  - docs/agents/document-claims.md

> **Done when:** `grep -rniE 'no account|no server|no sign.?up|not on a server' index.html app/index.html public/` returns nothing. No document asserts the absence of an account or a server that will not be true -- read by hand per `docs/agents/document-claims.md`, not grepped, because a denial contains no promise to flag. `PRODUCT.md` no longer says "no backend, no auth, no network", keeps multi-user and sync genuinely out of scope, and states the guest default plus the Account's cross-device reach. `DESIGN.md`'s "Things that don't change" list names the local-first default rather than the exclusion of a server. `e2e/tests/landing/landing.spec.ts`'s copy assertion is updated to the corrected sentence. Both spec out-of-scope lines carry the same corrected line naming ADR-0007 rather than ADR-0001.

> Phase E ticket 03 -- `.scratch/backend/issues/03-the-public-claims-stop-promising-no-account.md`, plan Task 3. Four page strings promise the opposite of this feature (`index.html` meta description, trust list and CTA note; `public/404.html`), and two documents state it as an invariant. THE RULE for every replacement: a page may say the data stays on the device BY DEFAULT and may say an account is OPTIONAL, but must not assert the absence of a server, because after ticket 06 there is one. `docs/FLOW.md` is deliberately left alone -- "a local-first single-user tool" stays true, since one Account is still one Organizer. NOT GATED ON B14: ticket 14 and the offline row have both landed, so this is pure copy work on the current tree. The landing spec's assertion is part of this ticket -- correcting the copy without it leaves the suite red -- and that is the Phase B exemption for copy changes, not a violation of the no-spec-edited discipline. The unsatisfiable grep row this ticket used to carry was itself deleted on 2026-10-13 (TASK-106).


## Done

### TASK-101 · Announce entering swap mode to assistive tech

> **Goal:** Announce entering swap mode to assistive tech
- priority: high
- updated: 2026-10-01T04:16:07Z

### TASK-102 · Validate CSV-built players, and write the read-path decision

> **Goal:** Validate CSV-built players, and write the read-path decision
- priority: high
- updated: 2026-10-01T04:16:07Z

### TASK-103 · Correct the false CI denial in ROADMAP, and the stale IMPLEMENTATION_PLAN

> **Goal:** Correct the false CI denial in ROADMAP, and the stale IMPLEMENTATION_PLAN
- priority: high
- updated: 2026-10-01T04:16:07Z

### TASK-104 · Deploy gates: supply the production hostname, then verify offline

> **Goal:** Deploy gates: supply the production hostname, then verify offline
- priority: high
- updated: 2026-10-13T16:21:12Z

### TASK-110 · MLBB's five roles are lanes, not hero classes, with stored ids migrated

> **Goal:** MLBB's five roles are the five positions a team fields (gold laner, exp laner, mid laner, jungler, roamer), not the six hero classes (tank, marksman, assassin, fighter, mage, support), and every stored role id is migrated so no existing roster fails its next save.
- priority: high
- updated: 2026-10-14T15:46:39Z

### TASK-105 · Debt 26: decide the App.tsx line count, or close the row

> **Goal:** Debt 26: decide the App.tsx line count, or close the row
- priority: medium
- updated: 2026-10-13T17:07:14Z

### TASK-106 · Debt 30: delete the acceptance row that cannot fail

> **Goal:** Debt 30: delete the acceptance row that cannot fail
- priority: medium
- updated: 2026-10-14T00:32:16Z

### TASK-108 · Write Phase E's plan

> **Goal:** Write Phase E's plan
- priority: medium
- updated: 2026-10-14T10:48:02Z

### TASK-109 · Add aria-expanded to the settings popover trigger

> **Goal:** Add aria-expanded to the settings popover trigger
- priority: medium
- updated: 2026-10-01T04:16:33Z

### TASK-107 · Cover the roster editor's refusal with a test

> **Goal:** Cover the roster editor's refusal with a test
- priority: low
- updated: 2026-10-14T01:20:42Z

