# Board

_Written by Seraph. Do not edit — this file is replaced on every change._
_Render format 3._

## Backlog

### TASK-117 · RB-1: relational schema v2 + store skeleton

> **Goal:** Replace the one-blob document storage with a normalized D1 schema and the decompose/reassemble store modules that translate backup-v5 documents to and from rows.
- priority: high
- triage: ready-for-agent
- claimed by: omp (session `omp-relational-backend`, until 2026-10-15T09:53:59Z)
- updated: 2026-10-15T09:23:59Z
references:
  - docs/superpowers/plans/2026-10-15-relational-backend.md

> **Done when:** server/schema-v2.sql defines the ~14 tables per the plan; server/store/decompose.ts and reassemble.ts pass the round-trip law test (reassemble(decompose(b)) === b) on the sample rosters; npx vitest run green; no wire-format change (endpoints untouched).

> Plan: docs/superpowers/plans/2026-10-15-relational-backend.md (Task 1). ADR-0007 storage section superseded in part 2026-10-15. Invariants: wire format stays backup v5; CAS survives on community_revisions; client storage seam unchanged; guest e2e specs stay green unedited.

### TASK-118 · RB-2: decompose/reassemble all entity kinds

> **Goal:** Extend the store modules to cover every entity kind — communities, disciplines (with roles/attributes), players (with capabilities), split sessions, saved squads, tournaments (with teams, matches, games).
- priority: high
- triage: ready-for-agent
- updated: 2026-10-15T09:15:56Z
references:
  - docs/superpowers/plans/2026-10-15-relational-backend.md

> **Done when:** Property test: randomly generated valid documents round-trip exactly (reassemble(decompose(b)) === b, plus parseBackup(serialize(...)) === b); deterministic ordering via position columns; vitest green.

> Plan: docs/superpowers/plans/2026-10-15-relational-backend.md (Task 2). ADR-0007 storage section superseded in part 2026-10-15. Invariants: wire format stays backup v5; CAS survives on community_revisions; client storage seam unchanged; guest e2e specs stay green unedited.

### TASK-120 · RB-4: migration + cutover, drop community_documents

> **Goal:** Migrate existing community_documents rows into the normalized tables and cut over: read every row, decompose, write community_revisions at the row's version, verify the round-trip per row, then drop community_documents from the schema.
- priority: high
- triage: ready-for-agent
- updated: 2026-10-15T09:16:21Z
references:
  - docs/superpowers/plans/2026-10-15-relational-backend.md

> **Done when:** Migration script (scripts/migrate-documents.ts or a one-shot Worker route) verified against a migrated local D1 that passes the full suite; backup export taken before the live migration; community_documents dropped only after verification.

> Plan: docs/superpowers/plans/2026-10-15-relational-backend.md (Task 4). ADR-0007 storage section superseded in part 2026-10-15. Invariants: wire format stays backup v5; CAS survives on community_revisions; client storage seam unchanged; guest e2e specs stay green unedited. After the drop, rollback means restoring the pre-migration export.

### TASK-121 · RB-5: query endpoints (follow-up)

> **Goal:** Expose the new query capability on the wire: leaderboard by discipline+attribute, cross-community player search, per-discipline session history.
- priority: medium
- triage: ready-for-agent
- updated: 2026-10-15T09:16:32Z
references:
  - docs/superpowers/plans/2026-10-15-relational-backend.md

> **Done when:** GET endpoints in server/store/queries.ts-backed routes, account-scoped from the token; a grep gate confirms every query in server/store/queries.ts carries account_id in its WHERE; client UI consuming them is a separate design task with its own ADR note (touches the no-screen-awaits-a-fetch invariant).

> Plan: docs/superpowers/plans/2026-10-15-relational-backend.md (Task 5, follow-up, not part of the storage build). ADR-0007 storage section superseded in part 2026-10-15. Invariants: wire format stays backup v5; client storage seam unchanged; guest e2e specs stay green unedited.


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

### TASK-119 · RB-3: rewire adopt/pull/push with dual-write

> **Goal:** Route the existing document endpoints through the new store: push = CAS on community_revisions as the first statement then decompose in one transaction; pull = reassemble; adopt = revision row at 1 plus decompose. community_documents stays in dual-write (write both, read new) as the rollback window.
- priority: high
- updated: 2026-10-15T11:54:41Z

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

### TASK-107 · Cover the roster editor's refusal with a test

> **Goal:** Cover the roster editor's refusal with a test
- priority: low
- updated: 2026-10-14T01:20:42Z

