# 12 — The data has a durability story

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

**Status:** ready-for-agent

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
