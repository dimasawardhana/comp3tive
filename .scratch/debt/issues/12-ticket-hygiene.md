# 12: Ticket hygiene — close the tickets that are already shipped

**Status:** ready-for-agent

**What to build:** The ticket sets that describe shipped work stop reading as open work, so the next agent does not re-implement a delivered feature or double-track a defect this phase already owns. This ticket edits ticket files only; it touches no product code.

**Evidence (audit findings, 2026-09-17 — `.scratch/` ticket state).** `.scratch/` holds 43 tickets. Status lines:

| Directory | Count | Statuses |
|---|---|---|
| `app-correctness/issues` | 6 | all `open` |
| `app-health/issues` | 15 | all `ready-for-agent` |
| `landing-page/issues` | 6 | 5 `resolved`, 1 `ready-for-human` |
| `team-builder/issues` | 15 | 14 `resolved`, 1 `planned` |
| `team-builder/dashboard/issues` | 7 | **all `ready-for-agent`, zero checked boxes** |

The dashboard set is the stale one: all seven are `ready-for-agent` with no checked boxes, but every deliverable **exists** — `src/DashboardScreen.tsx`, `src/dashboardTeasers.ts`, `e2e/tests/dashboard/dashboard.spec.ts`, and the community-scoped History/Games filters. The dashboard shipped, with commits whose subjects name the tickets: `73f6646 fix: community-scope History sessions and Games tournaments`, `f0e2b23 feat: add Dashboard hub screen for the active community`, `a87c705 feat: dashboard-first landing with centered Home tab`, `3728887 feat: wire dashboard actions to existing flows`, `42c17c7 test: lock down dashboard hub behavior with e2e coverage`, `94a5757 feat: add dashboard teaser helpers for recent players and active tournaments (ticket 06)`, `b05bbb9 feat: add recent players and active tournaments teasers to Dashboard (ticket 07)`.

`app-correctness/03` is **partially stale**: it claims "No production code path calls them" of `validatePlayer`/`validateCapability`, but `src/roster/PlayerEditModal.tsx:126` now calls `validatePlayer(draft, disciplines)`. The `parseBackup` and JSON/CSV import paths still do not — so the ticket is real but no longer accurately described.

**Acceptance criteria:**
- [ ] `.scratch/team-builder/dashboard/issues/01..07` each get `Status: resolved` and a `## Comments` line naming the commit that delivered them: 01 `73f6646`, 02 `f0e2b23`, 03 `a87c705`, 04 `3728887`, 05 `42c17c7`, 06 `94a5757`, 07 `b05bbb9`
- [ ] **The seven files are not deleted** — the tracker convention (`docs/agents/issue-tracker.md`) keeps the record, and `## Comments` is where its outcome goes
- [ ] Two dashboard corrections are recorded rather than papered over: ticket 03's acceptance says Home is *centered*, and `1702342 feat: rail order + collapse toggle…` shipped Home **first** in `NAV_ITEMS` (`src/App.tsx:62-68`) in both navs; ticket 05's acceptance says the full e2e suite passes, and it has not passed since `681051d` — which is exactly what `.scratch/debt/issues/01` and `02` fix
- [ ] `.scratch/app-correctness/issues/03` is **corrected, not closed**: its stale "no production code path calls them" claim is replaced with the verified state (`PlayerEditModal.tsx:126` calls `validatePlayer`; `parseBackup` and the JSON/CSV import branches do not), and a `## Comments` line points at `.scratch/debt/issues/05-validate-players-where-data-enters.md`
- [ ] The eight absorbed originals each gain a `## Comments` line pointing at their successor in `.scratch/debt/issues/`, with their status left as it is: `app-correctness/01` → `03`, `app-correctness/02` → `04`, `app-correctness/04` → `06`, `app-correctness/05` → `09`, `app-health/04` → `10`, `app-health/08` → `07`, `app-health/11` → `08`, `app-health/15` → `11`
- [ ] No product file, spec, config or document outside `.scratch/` is modified by this ticket
- [ ] A final `grep -rn "^\*\*Status:\*\*" .scratch/` check: no file under `.scratch/team-builder/dashboard/` reads `ready-for-agent`

**Blocked by:** — (this ticket can land at any point in the phase; it is independent of every other ticket)

**Notes:** `docs/agents/issue-tracker.md` defines the convention used here — one file per ticket, a `Status:` line near the top, and conversation or outcome appended under a `## Comments` heading. The roadmap's Approach section records the same convention. This is the phase's last piece of bookkeeping and the cheapest way to stop the next agent from rebuilding a shipped feature.
