# Board

_Written by Seraph. Do not edit — this file is replaced on every change._
_Render format 3._

## Backlog

### TASK-139 · UIUX-09 Records and PR to master

> **Goal:** Update the documents the revamp falsifies and open the reviewed PR into master with before and after side by side.
- priority: medium
- triage: ready-for-agent
- claimed by: omp (session `omp-uiux-revamp-2026-10-23`, until 2026-10-23T20:38:55Z)
- updated: 2026-10-23T20:08:55Z

> **Done when:** README.md, DESIGN.md, CONTEXT.md, docs/ROADMAP.md and IMPLEMENTATION_PLAN.md describe the shipped design and contain no claim the tree contradicts; .taste-skill/ and anti-slop/ either committed deliberately or gitignored; PR opened from uiux-revamp into master containing the before and after inspect.mjs measurements per viewport, the R-XX findings closed, and one-line reasons for each major decision (R-31); master is unchanged until the PR is reviewed.

> P6. SERIAL after UIUX-08. Depends on UIUX-08. The repo rule is that a document claim names the tree it was checked against, so every edited sentence is read against the tree, not grepped.


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

### TASK-111 · Backup v5 carries the discipline catalog

> **Goal:** A custom Discipline survives an export/import round trip, and the payload can carry the catalog to an Account at all.
- priority: high
- updated: 2026-10-14T18:49:30Z

### TASK-112 · A Player carries a creation timestamp

> **Goal:** "Recently added" is expressed rather than inherited from a storage engine's iteration order, and the Dashboard ranks by it.
- priority: high
- updated: 2026-10-14T19:25:12Z

### TASK-114 · An Account exists, and the app knows who is signed in

> **Goal:** An Organizer can create an Account and sign in on the deployed site by passkey or Google, and the app knows whether it is signed in -- with no data movement yet.
- priority: high
- updated: 2026-10-15T02:55:34Z

### TASK-115 · Signing in moves the data, signing out clears it

> **Goal:** Signing in takes the data on the device and makes it the Account's; signing out empties the device; a stale token never destroys anything.
- priority: high
- updated: 2026-10-15T03:54:19Z

### TASK-116 · The Account stays authoritative, and a stale device is refused

> **Goal:** Edits made while signed in reach the Account without the Organizer thinking about it, and if another device changed the same Community first, the losing device is told rather than silently overwriting.
- priority: high
- updated: 2026-10-15T07:48:43Z

### TASK-117 · RB-1: relational schema v2 + store skeleton

> **Goal:** Replace the one-blob document storage with a normalized D1 schema and the decompose/reassemble store modules that translate backup-v5 documents to and from rows.
- priority: high
- updated: 2026-10-19T14:35:48Z

### TASK-118 · RB-2: decompose/reassemble all entity kinds

> **Goal:** Extend the store modules to cover every entity kind — communities, disciplines (with roles/attributes), players (with capabilities), split sessions, saved squads, tournaments (with teams, matches, games).
- priority: high
- updated: 2026-10-19T14:36:17Z

### TASK-119 · RB-3: rewire adopt/pull/push with dual-write

> **Goal:** Route the existing document endpoints through the new store: push = CAS on community_revisions as the first statement then decompose in one transaction; pull = reassemble; adopt = revision row at 1 plus decompose. community_documents stays in dual-write (write both, read new) as the rollback window.
- priority: high
- updated: 2026-10-15T11:54:41Z

### TASK-120 · RB-4: migration + cutover, drop community_documents

> **Goal:** Migrate existing community_documents rows into the normalized tables and cut over: read every row, decompose, write community_revisions at the row's version, verify the round-trip per row, then drop community_documents from the schema.
- priority: high
- updated: 2026-10-19T14:52:34Z

### TASK-122 · Deploy feature/account and enable Google sign-in on the live origin

> **Goal:** Deploy the passkey fix and enable Google sign-in on the live origin. Both root causes of the passkey 500 are now fixed and the fix is committed to master (c8709dd): (a) the remote D1 had zero application tables because nothing in the deploy applies a schema -- fixed out of band on the remote DB, and still a deploy-runbook gap worth an npm script; (b) the client had no way to create an Account, because startPasskeyRegistration was wired to no UI -- fixed with a distinct Create an account button and actionable ceremony messages. Remaining: npx wrangler deploy, then the Google OAuth client and its secret.
- priority: high
- updated: 2026-10-22T14:42:08Z

### TASK-123 · Fix D1 sync coverage for all client mutations and new-user UX friction

> **Goal:** Fix two things reported by the Organizer: (1) D1 sync coverage - client-side mutations (player save, split-flow writes: sessions/squads/tournaments, community create, session/squad deletes) never call markDirty so they never reach D1; deleted communities have no server delete so their documents resurrect at next sign-in. Add markDirty to every mutation path, add a /api/documents/delete route, and stop deleteCommunity from pushing an empty document. (2) New-user UX: save-squad succeeds silently (no toast), the no-communities empty state points at an unlabeled topbar icon, and split-screen actions (Swap/Re-roll) and match-setup jargon (seats/eligible) are unexplained. Keep guest e2e green unedited.
- priority: high
- updated: 2026-10-22T14:49:19Z

### TASK-125 · Public player registration: join codes and a public /join/:code form

> **Goal:** Let an Organizer mint a join code for a community and share a public link. Anyone with the link fills a registration form (name, discipline, role, notes) that lands in a pending-registrations table; the Organizer pulls pending registrations into the roster from the Settings screen.
- priority: high
- updated: 2026-10-19T12:15:21Z

### TASK-126 · Attribute scales: per-attribute min/max the Organizer can set, and optional labels per rating value

> **Goal:** An Organizer defining a discipline chooses each attribute's rating range (e.g. 1-5 or 1-10) and can optionally name what each value means, and every rating input, error message, and strength computation reads that scale instead of assuming 1-5.
- priority: high
- updated: 2026-10-22T15:52:12Z

### TASK-130 · AI chatbot in the app

> **Goal:** Organizers can ask an AI assistant questions about their players/teams and get answers grounded in their data, via tool calls over the Account-scoped API.
- priority: high
- updated: 2026-10-23T04:57:06Z

### TASK-131 · UIUX-01 Baseline: capture before-state and audit

> **Goal:** Establish the measured before-state of every surface so the PR can show before/after side by side.
- priority: high
- updated: 2026-10-23T12:55:45Z

### TASK-132 · UIUX-02 Tokens, fonts and DESIGN.md on Accent Ladder

> **Goal:** Replace the Paper & Pencil token set with the dealt Accent Ladder system keyed to the brand amber, and make DESIGN.md describe the shipped design truthfully.
- priority: high
- updated: 2026-10-23T13:12:23Z

### TASK-133 · UIUX-03 Landing page revamp (/ page run)

> **Goal:** Rebuild the public landing page as a page (not an app screen) in the new direction, sharing tokens and face with the app.
- priority: high
- updated: 2026-10-23T19:46:00Z

### TASK-134 · UIUX-04 Split and Match revamp (signature moment)

> **Goal:** Rebuild the split result and match screens so the gap needle and team strength are the product's identity motif, and make the split readable on a phone with 14 people waiting.
- priority: high
- updated: 2026-10-23T19:46:00Z

### TASK-135 · UIUX-05 Shell and navigation revamp

> **Goal:** Rebuild the app shell on the dealt Open-plane sidebar, fold Settings out of the bottom bar, and keep the six hubs reachable on a phone.
- priority: high
- updated: 2026-10-23T19:46:00Z

### TASK-136 · UIUX-06 Hub screens: Dashboard, Roster, Games, History, Squads, Settings

> **Goal:** Rebuild the six hub screens on the new tokens, each answering one question first with its main job one click away, on the dealt list and detail blueprints.
- priority: high
- updated: 2026-10-23T19:45:33Z

### TASK-138 · UIUX-08 Verification: three gates and click-through

> **Goal:** Prove the revamp with the antislop Delivery Gate, the taste-skill inspector, measured contrast in both themes, and a recorded click-through of every control.
- priority: high
- updated: 2026-10-23T20:08:46Z

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

### TASK-113 · The public claims stop promising there is no account

> **Goal:** No public or product statement asserts comp3tive has no account and no server, and the one prohibition that forbids the feature is amended.
- priority: medium
- updated: 2026-10-15T00:12:26Z

### TASK-121 · RB-5: query endpoints (follow-up)

> **Goal:** Expose the new query capability on the wire: leaderboard by discipline+attribute, cross-community player search, per-discipline session history.
- priority: medium
- updated: 2026-10-19T15:01:57Z

### TASK-124 · Settings as a nav destination with Account section and Sync now

> **Goal:** Replace the topbar settings popover with a full Settings screen reachable from the rail and bottom nav; move the Account panel off the Dashboard into it; add a manual Sync now button for signed-in Organizers.
- priority: medium
- updated: 2026-10-19T09:44:54Z

### TASK-127 · Roster page layout tidy-up

> **Goal:** Reorganize the roster screen so filters, toolbar and CSV hints read as tidy grouped sections instead of loose floating blocks.
- priority: medium
- updated: 2026-10-22T17:45:15Z

### TASK-128 · Roster toolbar button group + CSV format popover

> **Goal:** Compact the roster toolbar into a segmented button group and move the CSV format reference into an on-demand popover so it reserves no page space.
- priority: medium
- updated: 2026-10-22T18:06:39Z

### TASK-129 · Roster actions dropdown button

> **Goal:** Replace the segmented button group on the roster toolbar with a single dropdown button holding Add Player, Import players and Download CSV template, to save horizontal space.
- priority: medium
- updated: 2026-10-22T18:57:56Z

### TASK-137 · UIUX-07 Motion layer: signature move, entrance stagger, feedback

> **Goal:** Add the motion layer the taste skill requires: one signature move, a staggered entrance per section, feedback on every control, and a reduced-motion fallback that keeps all content.
- priority: medium
- updated: 2026-10-23T19:51:15Z

### TASK-107 · Cover the roster editor's refusal with a test

> **Goal:** Cover the roster editor's refusal with a test
- priority: low
- updated: 2026-10-14T01:20:42Z

