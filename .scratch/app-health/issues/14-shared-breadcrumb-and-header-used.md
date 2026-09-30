# 14 — The shared breadcrumb and page header are actually used

> **Superseded.** The live copy of this ticket is
> [`debt/28`](../../debt/issues/28-the-breadcrumb-and-page-header-are-actually-used.md). This file is
> history; see [`.scratch/app-health/README.md`](../README.md) for the pairing of all sixteen.

**What to build:** Breadcrumbs navigate — including the split screen's, which currently does nothing
— and the screens stop hand-rolling the masthead markup that a shared primitive was built for.

**Evidence.** `docs/FLOW.md` §3 states as normative: "Breadcrumbs are links — every crumb above the
current screen navigates there." The code does not do this:

- `src/nav.tsx`'s `Breadcrumb` component — built for exactly this — has **zero consumers**. No screen
  renders it.
- `SplitScreen`'s crumb is a dead link: `<a href="#" onClick={(e) => { e.preventDefault(); /* back
  handled via app */ }}>Match setup</a>`. It looks like a link, it is announced as a link, and
  clicking it does nothing.
- `MatchScreen`, `TournamentScreen` and `SplitScreen` each re-type the same
  `<div className="breadcrumb">` markup by hand, though `PageHeader` accepts a `crumbs` prop
  precisely so they do not have to.

**Blocked by:** None — can start immediately. **Must land before `.scratch/app-correctness/06`.**

**Status:** resolved

- [ ] The split screen's crumb navigates back to match setup, matching what the other screens'
      crumbs already do
- [ ] `src/nav.tsx`'s `Breadcrumb` is rendered by the screens that show breadcrumbs, or the module is
      deleted because the screens have a better shared shape — either is acceptable; leaving an
      unused component beside three hand-rolled copies is not
- [ ] No screen renders an `<a href="#">` whose handler does nothing
- [ ] Crumb elements that are not navigable are not marked up or announced as links
- [ ] Every crumb's destination matches `docs/FLOW.md`'s edge table — the file is the contract for
      where Back and the crumbs go
- [ ] The Playwright suite passes with no spec edited, including any spec asserting breadcrumb text

**Design reference:** `docs/FLOW.md` §3 (the contract) and
`docs/adr/0004-origin-aware-navigation.md` (why back targets are derived rather than declared).
`src/ui/PageHeader.tsx` already documents the problem it was built to solve: screens had hand-rolled
this "four different ways, which is why headings drifted in size and spacing between pages."

**Notes — why the ordering matters.** `.scratch/app-correctness/06` currently plans to reconcile
`docs/FLOW.md` §3 by recording that breadcrumbs *do not* navigate. Landing this ticket first makes
the documentation true again instead of codifying the gap: the contract in FLOW.md is right, the
code is wrong, and the cheaper fix is the code. Sequence 14 before 06.

Ticket 03 must land first or alongside — it consolidates the duplicated constants these same screens
carry, and touching both files twice invites a conflict.

## Comments

**Re-checked 2026-10-01 against `d98b95c`, against the code rather than against debt 28's
status — shipped. Resolved.**

- Row 2 holds and takes the first of the two branches the ticket allowed: the component was
  **used, not deleted**. `src/nav.tsx:16` is the single definition and
  `grep -rn 'className="breadcrumb"' src/` matches only `src/nav.tsx:18` — no screen hand-rolls
  the markup any more. Three consumers: `src/session/MatchScreen.tsx:41` and
  `src/tournament/TournamentScreen.tsx:254` (both through `PageHeader`'s `crumbs` prop,
  `src/ui/PageHeader.tsx:22`) and `src/session/SplitScreen.tsx:376`, which renders it directly
  because that screen has no `PageHeader`.
- Row 1 holds, and better than "back to match setup": the split screen builds its first crumb from
  the source it already receives and uses the same label as its own Back control —
  `{ label: backLabel, go: onBack }` with `Split result` second. So a `session` split now says
  `History` and goes to History, where before it said `Match setup` and went nowhere.
- Row 3 holds: no `<a href="#">` in `src/` has an inert handler. Every anchor in `src/nav.tsx:23`
  calls `c.go`, and `src/nav.test.ts:56-64` fires it.
- Row 4 holds: a crumb with no `go` renders a `<span>`, so the current screen's own segment is
  never announced as a link (`src/nav.tsx:24-26`, asserted at `src/nav.test.ts:45-54`).
- Row 5 holds against the contract, which `docs/FLOW.md` §3 still states normatively — *"Every
  crumb above the current screen now navigates there."* That section now records this ticket's
  resolution rather than planning around it.

**Not verified here, and not claimed:** row 6, "the Playwright suite passes with no spec edited,
including any spec asserting breadcrumb text". The e2e suite was not run for this re-check;
`src/session/SplitScreen.crumbs.test.ts` covers the split screen's crumbs at the unit level.
