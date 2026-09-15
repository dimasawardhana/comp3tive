# 14 — The shared breadcrumb and page header are actually used

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

**Status:** ready-for-agent

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
