# 03 — One definition per shared UI constant

> **Superseded.** The live copy of this ticket is
> [`debt/23`](../../debt/issues/23-one-definition-per-shared-constant.md). This file is history; see
> [`.scratch/app-health/README.md`](../README.md) for the pairing of all sixteen.

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

**Status:** resolved

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

## Comments

**Re-checked 2026-10-01 against `d98b95c`, against the code rather than against debt 23's
status — shipped. Resolved.**

- One definition each, in a module screens import rather than own: `BIB`
  (`src/ui/constants.ts:4`), `FORMAT_LABEL` (`:7`), `STATUS_LABEL` (`:15`), `relativeTime`
  (`src/ui/format.ts:2`). Every other hit in `src/` is an import or a use.
- One overlay skeleton: `modal-overlay` appears in exactly one source file, `src/ui/Modal.tsx`,
  and all five modals this ticket names render `<Modal>` — `DisciplineEditModal.tsx:172`,
  `PlayerEditModal.tsx:168`, `GamesScreen.tsx:265`, `TournamentScreen.tsx:101`,
  `SplitScreen.tsx:226` — with `BulkRateModal.tsx:347` and `ShareSheet.tsx:191` added since.
- The class names the ticket said to keep are the ones in the stylesheet: `.modal-overlay`
  (`src/split.css:222`), `.modal-card` (`:234`), `.modal-close` (`:250`).
- The `FORMAT_LABEL` type reminder this ticket designed for has since fired once: adding
  `"round-robin"` to `TournamentFormat` forced a key into `src/ui/constants.ts:11`, which is
  the point of keying it off the union.

**Not verified here, and not claimed:** row 4 ("the e2e suite passes with no spec edited,
including the computed-style assertions") and row 5 (the suite's locators still match). The
e2e suite was not run. The locators themselves are present — `.modal-card` and `.bib` are
asserted across `e2e/tests/tournament/*` and `e2e/tests/discipline/discipline.spec.ts`, and
`e2e/tests/history/history.spec.ts` reads the relative timestamps — but whether they still pass
is debt 23's claim to make, not this ticket's to restate.

**A note on where the ticket points.** Row 2 says the shared primitive should live "in a module
a screen imports rather than a screen owns", and the design reference names `src/ui/`. That is
what shipped. The stylesheet those classes resolve against is `src/split.css`, not
`src/index.css` as row 4 phrases it — the class names are unchanged, which is what the row is
protecting, but the file it names has moved on since.
