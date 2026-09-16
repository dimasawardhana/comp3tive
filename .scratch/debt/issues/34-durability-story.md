# 34: The data has a durability story

**Status:** ready-for-agent

**What to build:** The app asks the browser to keep its data and stops being silent about it.
Storage that will not be evicted is requested once on first run, the outcome is shown where the
user can find it next to the export control, and a proportionate one-line nudge asks for a
backup — dismissible, and dismissed for good once it is dismissed.

**Evidence.** ADR-0001 (`docs/adr/0001-client-only-first.md`, `Status: accepted`) settles on
client-only storage with JSON export/import as the migration path off the browser. Everything
behind that decision works; what is missing is any mechanism that makes the user use it.

```
$ grep -rn "navigator.storage" src/
(0 matches)
```

Nothing asks the browser for persistence, and nothing calls `navigator.storage.estimate()`, so
the app cannot say how much is at stake. The export path exists and works — `handleExport` builds
a Blob from `serializeBackup(roster.players, allSessions, communities.communities,
tournaments.tournaments, savedSquads.squads)` (`src/data/transfer.ts:9` `version = 4`) and clicks
an `<a download>` — but nothing knows or mentions when it last ran. There is no reminder.

Browser eviction is **indistinguishable from a fresh install**: the app creates the `Default`
community (`src/domain/useCommunities.ts:7-9`, `DEFAULT_ID = "community-default"`) and lands on
an empty Dashboard with the `.dashboard-empty` state (`src/DashboardScreen.tsx:100-108`) and no
indication anything was lost. That is the exact failure mode the `loadError` banner was added to
prevent, arriving through a door that banner does not cover.

**Trigger decision (the ticket's design question, answered here — there is no `## Answer`
section in this template).** The nudge fires when **all three** hold: persistent storage was
asked for and the browser did not grant it OR `navigator.storage` is absent; the roster holds at
least 5 players; and either no export has ever happened or the last one was more than 14 days
ago. Rationale, from the audit's own framing: before 5 records there is nothing worth losing, so
a prompt is noise; after a loss it is useless; and mid-session is the failure mode to avoid, so
the nudge lives on the Dashboard — a screen the organizer leaves, never the split screen where
they are getting teams onto a court.

**Acceptance criteria:**
- [ ] `src/shell/useDurability.ts` (the file `src/App.tsx`'s `useStoredPref` helper now lives in after C26 — `src/shell/usePreferences.ts` — is the precedent to follow) exports `useDurability(): { persisted: boolean | null; granted: boolean | null; lastExportAt: number | null; shouldNudge: boolean; dismissNudge: () => void }`.
- [ ] On mount it calls `navigator.storage?.persist?.()` exactly once and stores the boolean result. `persisted` is `null` before the promise settles and after it settles on a browser without the API, so "unknown" and "refused" are never conflated.
- [ ] A refusal is silent: the rejected promise is caught, no `notify` call is made, no error is thrown, and no screen changes. A unit test drives the hook with `navigator.storage` deleted entirely and asserts the hook returns without throwing and `persisted === null`.
- [ ] The last-export time persists under `localStorage` key `tb-last-export` via the existing `useStoredPref(key, initial)` pattern (`src/App.tsx:93-108`, which already wraps `localStorage` in try/catch), matching the `tb-` prefix used by `tb-theme`, `tb-layout`, `tb-rail` and `tb-community` (`src/domain/useCommunities.ts:6`). A blocked `localStorage` degrades to in-memory with no throw.
- [ ] The export handler records the timestamp: after a successful export, `tb-last-export` holds the epoch-ms value as a string, and `lastExportAt` reflects it on the next render.
- [ ] Dismissal persists under `tb-export-nudge-dismissed`; once set, `shouldNudge` is `false` forever after, and no nag appears on any later load. A spec asserts this by dismissing, reloading, and asserting the nudge is still absent.
- [ ] The nudge is a Dashboard row, rendered when `shouldNudge` is true, between the stat cards (`src/DashboardScreen.tsx:113-127`) and the teasers. It uses the app's existing inline vocabulary — a `.nudge` row with the app's voice and a `Dismiss` button — not a modal, not `alert`, not `window.confirm`. Copy: `This browser can clear your data. Export a backup and it can't.`
- [ ] The nudge does not appear when `shouldNudge` is false, so an empty roster, a granted persistence, or a recent export all suppress it. A spec seeds 2 players and asserts no `.nudge`; a spec seeds 6 players with no export record and asserts `.nudge` is visible.
- [ ] The persisted state is visible next to the export control in `src/shell/RosterScreen.tsx` (post-C26 home of the `.roster-toolbar` that holds `Export`): a `.durability-note` line reading `Storage protected. Eviction unlikely.` when `persisted === true`, `Storage not protected. Keep a backup.` when `persisted === false`, and `Storage protection unknown in this browser. Keep a backup.` when `persisted === null`. The `Export` button's markup and behaviour are unchanged.
- [ ] The stat cards are untouched: `.dashboard-stats` still renders exactly the three `.tournament-meta-card.dashboard-stat` children labelled `Players`, `Saved squads`, `Tournaments`, so `e2e/tests/dashboard/dashboard.spec.ts:114-118` and `:221-224` stay green unchanged.
- [ ] No sync, no cloud backup and no file-system integration is introduced; the export/import pair is the whole mechanism, per ADR-0001.
- [ ] `npx vitest run` exits 0 with `src/shell/useDurability.test.ts` in the output (the filename must end in `.test.ts` — `vite.config.ts` sets `include: ["src/**/*.test.ts"]` and `.tsx` files are not collected); `npx tsc -b` exits 0.

**Blocked by:** —

## Comments

Absorbed from `.scratch/app-health/issues/12-the-data-has-a-durability-story.md`. Its evidence is
preserved verbatim in the section above. One stale item: its final acceptance box asked for the
trigger to be recorded "in the ticket's Answer". The Phase D ticket template has no `## Answer`
section, so the trigger decision is recorded in **What to build** and encoded in the acceptance
criteria instead.
