# 12 — The data has a durability story

> **Superseded.** The live copy of this ticket is
> [`debt/34`](../../debt/issues/34-durability-story.md), which absorbed this ticket's evidence
> verbatim. This file is history; see [`.scratch/app-health/README.md`](../README.md) for the
> pairing of all sixteen.

**What to build:** The browser is asked to keep the data, and the user is nudged to keep their own
copy — so a storage eviction is a recoverable event rather than an app that looks like it was never
used.

**The risk.** ADR-0001 settles on client-only storage with JSON export/import as *the* migration
path off the browser. Everything behind that decision works; what is missing is any mechanism that
makes the user use it:

- `navigator.storage.persist` appears **nowhere** in `src/`. Nothing asks the browser to exempt this
  origin from eviction under storage pressure.
- There is no autosave to a file, no reminder, and no export prompt. The last export is not
  something the app knows or mentions.
- There is no `navigator.storage.estimate()`, so the app cannot say how much is at stake.
- Browser eviction is **indistinguishable from a fresh install**. The app would create the Default
  community and land on an empty Dashboard with no indication anything was lost — the exact failure
  mode the `loadError` banner was added to prevent, arriving through a door that banner does not
  cover.

**Blocked by:** None — can start immediately.

**Status:** resolved

- [ ] The app requests persistent storage on first run, and the request's outcome is handled — both
      granted and refused, with no error surfaced to the user for a refusal
- [ ] The API's absence is tolerated: a browser without `navigator.storage` still runs the app, with
      no thrown error and no broken screen
- [ ] The user is nudged to export — the prompt is proportionate to real risk, not a modal on every
      launch
- [ ] A nudge that has been dismissed stays dismissed; the app does not nag on every load
- [ ] The nudge uses the app's voice and its toast/inline vocabulary, not a native dialog
- [ ] Whether storage is persisted is visible somewhere the user can find it, alongside the existing
      export control
- [ ] The chosen trigger for the nudge is recorded in the ticket's Answer (first run, N records,
      elapsed time since last export, or a mix)

**Design reference:** ADR-0001 (`docs/adr/0001-client-only-first.md`) is the decision this ticket
makes good on. `PRODUCT.md`'s offline promise is the other half of the argument.

**Notes:** The trigger is the whole design question, and it is a product judgement rather than a
technical one: a prompt that fires before the user has any data is noise, and one that fires after
they have lost it is useless. Nudging an organizer mid-session — when they are trying to get teams
on a court — is the failure mode to avoid.

Do **not** invent a sync, a cloud backup, or a file-system integration. ADR-0001 explicitly chose
export/import, and changing that is an ADR, not a ticket.

## Comments

**Re-checked 2026-10-01 against `d98b95c`, against the code rather than against debt 34's
status — shipped. Resolved.**

- Row 1 holds. `src/shell/useDurability.ts:370` exports `useDurability`; `probePersistence`
  (`:238`) calls `navigator.storage?.persist?.()` once and keeps the three-state distinction this
  ticket was most careful about — `persisted: null` before the promise settles and on a browser
  with no Storage API, and a refusal treated as silence (`:256`), not as an error to show.
- Row 2 holds by construction: every storage call is optional-chained behind a `StorageProbe`
  interface (`:124-128`), so a browser without the API takes the `!storage.persist` branch at
  `:245` and returns `{ persisted: known, granted: null }` rather than throwing.
- Row 3 holds and the trigger is recorded, which row 7 asked for. It is a mix, and it is written
  down where the code is: `MIN_PLAYERS_TO_NUDGE = 5` (`:48`), `NUDGE_AFTER_MS = 14 days` (`:66`),
  and `decideDurability` (`:302-317`) requires the origin to be non-persistent **and** at least
  five players **and** an export that is missing or older than a fortnight. The rationale —
  browsers evict under pressure, never on a schedule, so this is a cadence rather than a risk
  model — is at `:51-62`.
- Row 4 holds: the nudge renders on the Dashboard between the stat cards and the teasers
  (`src/DashboardScreen.tsx:129-137`) with a `Dismiss` button and no modal, and dismissal
  persists under `tb-export-nudge-dismissed` (`src/shell/useDurability.ts:23`) — including the
  rule that a roster growing past `dismissed.playerCount + 5` re-opens the question
  (`:283`).
- Row 6 holds: it is the app's toast/inline vocabulary, not a native dialog, and the whole
  `grep -rn "navigator.storage" src/` footprint is `useDurability.ts` — no sync, no cloud backup,
  no account, as the Notes require.
- Row 5's placement holds: `src/shell/RosterScreen.tsx:653-656` renders `.durability-note`
  beside the Export control and distinguishes all three verdicts — reported persistent, reported
  not, could not confirm.

**Not verified here, and not claimed:** row 7's own statement that the trigger decision belongs
in the ticket's Answer. This ticket file has no `## Answer` section, so the answer is this block
plus the constants at `src/shell/useDurability.ts:48,66`, which is where the next reader will
look.
