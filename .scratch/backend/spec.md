# Optional backend — an Account, and data that survives the device

**Status:** ready-for-agent

## Problem Statement

comp3tive stores everything in one browser profile. That is the product's strength — it works on a
court with no signal, it needs no sign-up, and the data never leaves the device — but it is also the
one failure the app cannot recover from. Clearing site data, switching browsers, or picking up a
different device loses everything, and the loss is **indistinguishable from a fresh install**: the
app creates the `Default` community (`src/domain/useCommunities.ts:52-56`) and lands on an empty
Dashboard with no indication anything existed. The audit names this exactly
(`COMP3TIVE_COMPREHENSIVE_ANALYSIS.md:586-588`): "data is bound to one browser profile on one
device — clearing site data destroys everything, and there is no recovery path the app itself can
take."

Today the only answer is a manual JSON export (backup `version: 4`,
`src/data/transfer.ts:9-17`), and nothing makes anyone use it. Ticket 34 addresses the guest half of
that. It cannot address the other half: a file on a disk cannot put the same roster on a laptop and a
phone, and an organizer rebuilding a roster by hand on a second device is the story this feature
exists to end.

ADR-0001 deferred a backend until "the app needs shared, multi-user data" and named export/import as
the migration path. That condition has arrived, but as **durability and cross-device access**, not
collaboration. This feature adds an **optional Account**, and nothing else changes for anyone who
does not want one.

## Solution

An Organizer can keep using comp3tive exactly as it is today: no account, no network, everything
local. That path is not a demo or a trial; it is the product, and it is where the funnel is
(`PRODUCT.md`: "No friction — the path from 'import roster' to 'split into 4 teams' has no dead
ends").

An Organizer can also sign in. Signing in takes the data already on the device and makes it the
Account's data, and from that moment **the Account is the source of truth**: the data lives on a
server, so it survives a lost device, a cleared browser and a second device, and an edit made on one
device is visible on the others. The words for the two states are **"On this device"** and **"In your
Account"** — they name where the data is, never what the tool can do, because no existing feature is
withheld from a guest.

**The offline promise holds for everyone, including signed-in Organizers, because authority and the
read path are different things.** Authority is on the server. The read path stays IndexedDB: the
device holds a write-through cache of the Account's data, so opening the app never waits on the
network and a signed-in Organizer on a court with no signal sees their roster rather than an error.
When the network returns the cache is refreshed from the server, and a write made while offline is
pushed — and rejected, with a message, if another device changed that Community first. Recorded as
ADR-0007, superseding ADR-0001.

**This reverses the earlier draft of this spec**, which made the server a copy rather than the source
of truth. Its reasoning — that server-authoritative reads break the offline promise — is right about
the failure and wrong about the remedy: the promise breaks when the *read path* depends on the
network, not when the *server* is authoritative. The read path stays a cache, so nothing in `src/`
starts awaiting a `fetch`.

## User Stories

1. As an Organizer, I want to use the whole app without an account, so that nothing is gated behind
   a sign-up I did not ask for.
2. As an Organizer who has lost a device, I want my rosters back, so that a season of ratings is not
   gone because a phone broke.
3. As an Organizer with two devices, I want the same roster on both, so that I can prepare at a desk
   and run the night from a phone.
4. As an Organizer signing in for the first time with data already on this device, I want that data
   to become my Account's data, so that signing in does not erase what I built as a guest.
5. As an Organizer, I want to be told when a sign-in would replace data on this device, so that a
   destructive choice is never made silently for me.
6. As a signed-in Organizer on a court with no signal, I want the app to keep working, so that
   losing the network does not lose me the evening.
7. As a signed-in Organizer, I want my data cleared from a shared device when I sign out, so that
   handing the laptop to someone else does not hand them my roster.
8. As an Organizer editing on two devices, I want to be told when another device changed something
   first, so that my evening's work is not silently overwritten.
9. As an Organizer with a custom Discipline, I want it in my backup and in my Account, so that
   moving devices does not quietly drop the activities I defined.

## Implementation Decisions

- **The backend is optional, and ADR-0007 records it** (`docs/adr/0007-optional-backend.md`),
  superseding ADR-0001 while preserving its reasoning. Identity is recorded separately in ADR-0008.
- **The Account is the source of truth; the device keeps a write-through cache.** A signed-in
  Organizer's data lives on the server. The read path does not move: reads keep going through
  IndexedDB behind the existing store interfaces (`src/storage/types.ts`), and a write goes
  server-first and is mirrored into that cache. The storage seam does **not** change shape: `list*()`
  keeps taking no arguments, Community scoping stays a filter in the React layer, and the server
  learns which Account is asking from the token rather than from the payload. A Community's
  collections are replaced wholesale, which is what `replaceAllPlayers` and its four siblings already
  do. Zero `list*()` call sites change; the six stores become a cache's interface rather than the
  app's window onto the server.
- **The wire format is the backup format**, one document per `(account, community)` with a version
  integer. `serializeBackup`/`parseBackup` (`src/data/transfer.ts:22-38`, `:106-186`) already encode,
  validate and migrate this payload, including the orphan-adoption rule. No merge algorithm, no
  second schema, no duplicated validation.
- **Nothing is normalized server-side.** No foreign keys, no server queries. Player deletion leaves
  dangling ids in `poolPlayerIds`, `result.teams[].slots[].playerId` and `matches[].teamAId` by
  design, tolerated at read time by one filter (`src/session/SplitScreen.tsx:265`); a relational
  schema would reject what the app deliberately does.
- **`backup version: 5` adds `disciplines[]`, and it lands first.** It is a prerequisite, not a
  follow-up: a per-account Discipline catalog cannot sync while the catalog is absent from the
  payload, and a custom Discipline is currently lost on export/import outright.
- **`Player` gains `createdAt`.** "Recently added" is physical order today — a bare `getAll()` with
  no index, no sort in `useRoster`, and `players.slice(-3)` in the Dashboard — which a server makes
  arbitrary. Ticket 02 makes the meaning explicit.
- **One canonical origin.** Identity binds to an origin, so the production hostname is settled before
  any credential is registered. `wrangler.jsonc:14` currently carries `"name": "comp3tive"` as a
  documented placeholder that would create a second Worker if deployed unchanged.
- **An Account is its own opaque key, and email is an attribute, not the join.** A passkey contributes
  a Credential record and Google contributes an issuer-and-subject pair; both attach to the Account,
  and attaching the second is an explicit act by a signed-in Organizer. Keying on a verified email
  address instead is contradicted by OpenID Connect Core §5.7 and by Google's own guidance, and is
  the account-takeover pattern Firebase documents. Recorded in ADR-0008.
- **The server lives in this repository** (`server/`), importing domain types from
  `src/domain/types.ts` rather than copying them — `docs/spec/0002` already drifted from the code by
  duplicating a described shape.
- **Sign-in adopts local data; sign-out clears it.** First sign-in on an Account that has never synced
  makes the device's records that Account's initial state, behind a confirm when the local roster is
  non-empty. Explicit sign-out empties the local stores. A stale token never clears anything.
- **A write is server-first, debounced, whole-Community, and carries a version; a stale push is
  rejected** with a message telling the Organizer another device changed the data. Silent
  last-write-wins would erase an evening's work with nothing in the client able to detect it.
- **A sign-in never overwrites an account that has already synced.** Adoption is guarded by the
  *account's* state, not the device's: existing server state is fetched and rendered, and a device's
  records are only ever offered as a deliberate choice. Under the old model a bad overwrite damaged
  only the local copy; now it is the one path that can destroy the authoritative copy.
- **A pending offline write blocks sign-out, or is discarded behind an explicit confirm.** Signing
  out empties the local stores, and a queued write has nowhere to go once they are gone — silently,
  unless something refuses.
- **A cache served while the account is unreachable is labelled as a cache.** Token expiry
  deliberately keeps the data readable so a signed-in organizer on a court never finds an empty app.
  That needs a visible signal now: an organizer entering results into a stale copy and believing
  they are saved is the failure this decision makes more likely.
- **A rejected offline write is never discarded quietly.** The Organizer is shown which Communities
  are affected and when they were last changed elsewhere, and chooses: take the server's version, or
  push this device's over it deliberately. The person losing the data is offline at the time and will
  not see a conflict arrive later, so a silent drop is the one failure this design cannot have.
- **No push while signed out.** The hooks write immediately after a clear (the roster's orphan-repair
  effect, `src/App.tsx:225-237`), so the "who owns this write" guard lives at one boundary.

## Testing Decisions

- **The guest path is the regression surface, and it is already covered.** The existing e2e suite runs
  with no account and must stay green and unchanged: an account is an addition, and any spec that
  needs editing to accommodate it is evidence the guest experience moved.
- **Unit tests for the pure parts**: the backup v5 round-trip including `disciplines[]` and v1–v4
  migration (`src/data/transfer.test.ts` is the precedent), and the roster ordering rule from ticket
  02. The sync decision logic — adopt, push, reject-stale, clear — is a pure function over two
  snapshots and a version, and gets a direct unit test rather than being pinned only through the UI.
- **One e2e spec for the account lifecycle**, against a test server: sign in with data present,
  confirm the adopt prompt appears, confirm the roster survives, sign out, confirm the stores are
  empty and the app is usable as a guest again.
- **The stale-push rejection gets a test**, because its failure mode is silent data loss: simulate two
  devices, push from both, and assert the second is rejected and the first's data survives.
- **What is not tested**: the auth provider's own correctness, TLS, and anything the platform
  guarantees. The suite tests this app's decisions, not Cloudflare's.

## Out of Scope

- **Real-time collaboration, shared Communities between Organizers, and multi-user permissions.** One
  Account owns its data; nothing is shared. The audit's note that Community isolation is a product
  rule and not a security boundary
  (`COMP3TIVE_COMPREHENSIVE_ANALYSIS.md:417-419`) stays true for guests, and becomes a real boundary
  only between Accounts.
- **Server-side statistics, cross-tournament aggregates, or any feature that needs the server to
  query data.** Nothing needs it, and the storage shape exists to avoid it.
- **Per-record sync, tombstones, and field-level merge.** No entity carries `updatedAt` or
  `deletedAt`, so there is nothing to merge on; whole-Community replacement plus a version is the
  honest first cut. Two devices of one Account resolve by the server refusing the stale write and
  asking, not by merging rows.
- **A last-write-wins fallback on a shared id.** "Newest row wins" needs a per-entity timestamp that
  no entity carries, and it fails silently when two writes land in the same instant — the versioned
  rejection is the mechanism that makes a conflict *visible*, and replacing it with a timestamp
  comparison would trade a message for data loss.
- **A shareable live-bracket link.** Named in ADR-0006 as the genuinely attractive reason to revisit
  routing; it stays a separate decision with its own bill.
- **Migrating guest data to an Account automatically without asking**, and any telemetry, analytics,
  or tracking.
- **A mobile app, a public API, and third-party integrations.**

## Further Notes

- **Ticket 34 still ships, and still ships first.** It is the guest's durability story, and the two
  are complementary rather than redundant: eviction is a guest's failure mode, device loss is a
  signed-in Organizer's. Its acceptance criterion forbidding "sync, cloud backup" is superseded by
  ADR-0007, and ticket 03 amends that line in place rather than deleting it — shipping 34 verbatim
  would have the repo asserting a prohibition this feature deliberately lifts.
- **Sequencing, six tickets:** 01 (backup v5) → 02 (`Player.createdAt`) → 03 (the public claims and
  the amended prohibition) → 04 (an Account exists) → 05 (sign-in moves the data) → 06 (the Account
  stays authoritative). 01–03 are pure, local, and independently shippable; the feature is usable end to end
  only after 06. Ticket 34 is scheduled independently and lands before 05.
- **Four public statements currently contradict this feature** and are corrected by ticket 03:
  `index.html:9`, `:183`, `:194` and `public/404.html:124`. Ticket 14 has not landed, and its frozen
  trust-row text ("No account, no server") would land false — so 03 must land with or after 14, not
  independently of it. The landing spec also asserts the string
  (`e2e/tests/landing/landing.spec.ts:63`), so 03 edits that assertion as part of the copy change.
- **Ticket 16's disposition of `PRODUCT.md` as "keep, unmodified" is superseded** for its lines 4, 24
  and 39, which assert "no backend, no auth, no network", "Auth, multi-user, sync" out of scope, and
  "Single-user, single-device". A brief that contradicts the shipped product is the drift ticket 16
  exists to remove.
- **`DESIGN.md`'s "Things that don't change" list** (`DESIGN.md:198-199`) names "IndexedDB-only
  persistence" and "JSON export/import (data portability is the migration path)". Both stay true for
  guests and become half-true overall; ticket 03 amends them rather than leaving a false invariant.

- **Hosting topology, resolved.** The maintainer's stated intent was "its possible that i have my own
  server to serve backend, but still use cloudflare for access", and the answer is a **proxied origin
  behind Cloudflare, with the API joining the existing static-assets Worker under `/api/*`** — the
  address ADR-0006 reserved. The two decisions that needed making and are now made:
  - **Cloudflare Access is not the sign-in.** It is a gate for a known set of people: every request is
    denied unless it matches an Allow policy, users are added by hand, and there is no self-service
    registration flow, no user directory, and no per-user data model. Its free tier is capped by seat
    count (the 50-user figure appears only on Cloudflare's marketing pages, not its developer docs, and
    is recorded here as marketing-sourced). A public app whose strangers must be able to create an
    Account cannot use it for that layer. The Account from ADR-0008 is the identity; Cloudflare is the
    network in front of the origin.
  - **`assets.run_worker_first` is required, not optional.** The deploy's `compatibility_date`
    (`wrangler.jsonc:15`, `2026-09-14`) is past the 2025-04-01 threshold where a navigation request
    does not invoke the Worker script even when the path matches. Without the config, `fetch("/api/…")`
    reaches the API while a browser navigating to the same path is served the assets fallback. Ticket
    04 sets it and verifies it by navigation.
- **The origin's address is a choice with a real tradeoff.** A **proxied DNS record** preserves the
  visitor's IP at the origin; a **Cloudflare Tunnel** (free on all plans) hides the origin's address
  entirely but sends **no visitor IP at all**, and a Worker that proxies the call itself makes
  `CF-Connecting-IP` untrustworthy at the origin in either case. Nothing in this feature needs client
  IPs yet, so the ticket that first needs it decides; the fact is recorded so it is not discovered by
  surprise later.
- **`docs/BUSINESS_FLOW_REVIEW.md:13`** states "There is no server, no auth, no network roundtrip."
  It is dated analysis rather than a live claim, and it falls outside ticket 03's copy pass on
  purpose; if it is ever treated as current documentation it is ticket 16's business, not this
  feature's.
