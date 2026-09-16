# 23: One definition per shared constant

**Status:** ready-for-agent

**What to build:** Changing a bib colour, a format label, or the wording of "3 days ago" is
one edit in one file, and the five modals stop retyping the same overlay skeleton.

**Evidence.** Duplicates verified by search across `src/`:

| Constant | Copies | Locations | Values identical? |
|---|---|---|---|
| `BIB = ["a","b","c","d","e"]` | 3 | `src/session/SplitScreen.tsx:21`, `src/session/SquadsScreen.tsx:21`, `src/tournament/TournamentScreen.tsx:32` | yes |
| `FORMAT_LABEL` | 3 | `src/DashboardScreen.tsx:6`, `src/tournament/GamesScreen.tsx:27`, `src/tournament/TournamentScreen.tsx:26` | yes — same six strings |
| `STATUS_LABEL` | 2 | `src/DashboardScreen.tsx:12`, `src/tournament/GamesScreen.tsx:42` | yes |
| `relativeTime(ts)` | 2 | `src/session/HistoryScreen.tsx:13`, `src/session/SquadsScreen.tsx:23` | yes — byte-identical, 10 lines |
| `modal-overlay` + `modal-card` + `modal-close` | 5 | `src/domain/DisciplineEditModal.tsx:167`, `src/roster/PlayerEditModal.tsx:154`, `src/tournament/GamesScreen.tsx:229`, `src/tournament/TournamentScreen.tsx:107`, `src/session/SplitScreen.tsx:159` | same three classes, same nesting |

**Staleness correction (absorbed from `.scratch/app-health/issues/03`):** it claims the three
`FORMAT_LABEL` tables are "keyed off different type spellings (`Tournament["format"]` vs
`TournamentFormat`)". The spellings differ; the unions they name are the same union and no
value differs. That is cosmetic, not drift — the real argument for consolidating is the
future third key, not existing drift.

**What to build.** New `src/ui/constants.ts`, exactly the frozen shapes:

```ts
import type { TournamentFormat, TournamentStatus } from "../domain/types";

/** Team stripe colours, in split order. Indexed modulo its own length. */
export const BIB: readonly ["a", "b", "c", "d", "e"] = ["a", "b", "c", "d", "e"];

/** Human labels per bracket format. D16 adds "round-robin" to the union and to this record. */
export const FORMAT_LABEL: Record<TournamentFormat, string> = {
  series: "Series",
  "single-elim": "Single elimination",
  swiss: "Swiss",
};

/** Human labels per tournament lifecycle state. */
export const STATUS_LABEL: Record<TournamentStatus, string> = {
  draft: "Draft",
  active: "In progress",
  complete: "Complete",
};
```

`FORMAT_LABEL` is an explicit `Record<TournamentFormat, string>` **on purpose**: when Phase
D's D16 adds `"round-robin"` to `TournamentFormat` (`src/domain/types.ts:20`), this object
literal fails the build until the key is added — the type is the reminder. D16's plan is
written against this file. `relativeTime` moves to `src/ui/format.ts`. The modal skeleton
becomes `src/ui/Modal.tsx`:

```tsx
interface Props { onClose: () => void; children: ReactNode }
export function Modal({ onClose, children }: Props) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>
  );
}
```

It owns the wrapper and those two handlers only. Each call site keeps its own `modal-close`
button, title and content byte-for-byte, because they differ — `TournamentScreen.tsx:112`
renders an inline-styled `<h1>` rather than `.modal-title`, and `SplitScreen.tsx:164` titles
itself "Save squad". `src/ui/` is where the repo's shared primitives already live
(`Screen.tsx`, `PageHeader.tsx`).

**Acceptance criteria:**
- [ ] `grep -rc "const BIB\|const FORMAT_LABEL\|const STATUS_LABEL" src/` names exactly one file, `src/ui/constants.ts`, with 3 definitions
- [ ] `grep -rn "function relativeTime" src/` returns exactly 1 line, in `src/ui/format.ts`
- [ ] `grep -rc "modal-overlay" src/` finds the five call sites plus `src/ui/Modal.tsx`, and each call site is a `<Modal>` usage rather than a hand-written pair of divs
- [ ] Every moved string and class name is byte-identical: `git diff --stat src/index.css` is empty
- [ ] `npx tsc -b` is green, and `npx vitest run` gains `src/ui/format.test.ts` covering the five `relativeTime` branches ("just now", minutes, hours, days, and the date fallback)
- [ ] The e2e suite passes with no spec edited. `.modal-card` is asserted across 12 spec files and `.badge--mlbb` at `e2e/tests/dashboard/dashboard.spec.ts:481`, so both the modal shape and a bib-derived badge class are pinned by real assertions; `relativeTime`'s output is pinned by the history and squads specs' rendered timestamps and by their `getComputedStyle` checks (`e2e/tests/history/history.spec.ts:20`)
- [ ] A comment on `FORMAT_LABEL` names D16 as the ticket that adds the `"round-robin"` key

**Blocked by:** 21 — ticket 21 may delete a module carrying one of these, and this ticket must
not collide with it.
