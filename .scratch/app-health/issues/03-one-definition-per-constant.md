# 03 — One definition per shared UI constant

**What to build:** Changing a bib colour, a format label, or the wording of "3 days ago" is one
edit in one file, and the five modals stop retyping the same overlay skeleton.

**Evidence.** Duplicates verified by search across `src/`:

| Constant | Copies | Locations |
|---|---|---|
| `BIB = ["a","b","c","d","e"]` | 3 | `SplitScreen.tsx`, `TournamentScreen.tsx`, `SquadsScreen.tsx` |
| `FORMAT_LABEL` | 3 | `GamesScreen.tsx`, `TournamentScreen.tsx`, `DashboardScreen.tsx` |
| `STATUS_LABEL` | 2 | `GamesScreen.tsx`, `DashboardScreen.tsx` |
| `relativeTime(ts)` | 2 | `HistoryScreen.tsx`, `SquadsScreen.tsx` — identical logic |
| `modal-overlay` + `modal-card` + `modal-close` skeleton | 5 | `DisciplineEditModal.tsx`, `GamesScreen.tsx`, `TournamentScreen.tsx`, `PlayerEditModal.tsx`, `SplitScreen.tsx` |

Two of these are copy-paste drift waiting to happen: the three `FORMAT_LABEL` tables are keyed off
different type spellings (`Tournament["format"]` vs `TournamentFormat`) and `relativeTime` is
duplicated verbatim.

**Blocked by:** 01 — 01 may delete a module that carries one of these, and this ticket should not
collide with it.

**Status:** ready-for-agent

- [ ] `BIB`, `FORMAT_LABEL`, `STATUS_LABEL` and `relativeTime` each have exactly one definition, in a
      module a screen imports rather than a screen owns
- [ ] All five modals share one overlay/card/close structure, keeping their existing class names so
      `src/index.css` is unchanged
- [ ] Every duplication in the table above is gone — verified by searching for the identifier, not by
      reading the diff
- [ ] No rendered string, class name or DOM structure changes: the e2e suite passes with no spec
      edited, including the computed-style assertions
- [ ] The e2e suite's locators still match — `.modal-card`, `.bib`, and the relative timestamps are
      all asserted somewhere

**Design reference:** `src/ui/Screen.tsx` and `src/ui/PageHeader.tsx` are the precedent for where a
shared primitive lives; follow that folder and its naming.

**Notes:** This is the "make the change easy, then make the easy change" step for ticket 14 and for
`.scratch/app-correctness/06`. Both touch this surface, and both get cheaper once there is one place
to touch. Keep the moved constants byte-identical in value — a label that changes while moving is a
behaviour change smuggled into a refactor.
