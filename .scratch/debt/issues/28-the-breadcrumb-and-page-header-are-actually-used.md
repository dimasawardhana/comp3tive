# 28: The breadcrumb and page header are actually used

**Status:** ready-for-agent

**What to build:** Breadcrumbs navigate — including the split screen's, which currently does
nothing — and the screens use the shared crumb component instead of three hand-rolled copies.

**Evidence.** `docs/FLOW.md` §3 states as normative: "Breadcrumbs are links — every crumb above
the current screen navigates there." The code does not do this:

- `src/nav.tsx`'s `Breadcrumb` component — built for exactly this — has **zero consumers**
  (verified: `grep -rn "Breadcrumb" src/` matches only its own definition). It carries a stale
  unused `import type { Id }` at `:1` which ticket 22 deletes.
- `src/session/SplitScreen.tsx:294` renders a dead link:
  `<a href="#" onClick={(e) => { e.preventDefault(); /* back handled via app */ }}>Match setup</a>`.
  It looks like a link, it is announced as a link, and clicking it does nothing. It is also
  **wrong for two of its four sources**: there is no match-setup screen beneath a `session` or
  `squad` split.
- Three screens re-type the same `<div className="breadcrumb">` markup by hand —
  `src/session/MatchScreen.tsx:41-45`, `src/tournament/TournamentScreen.tsx:263-269`,
  `src/session/SplitScreen.tsx:292-297` — even though two of them pass crumbs through
  `PageHeader`, which accepts a `crumbs` prop precisely so they do not have to.

**1. `src/nav.tsx` becomes the one shape**, emitting exactly the markup the three copies emit
today — the separator as a flex sibling of the labels, which is what
`.breadcrumb { display: flex; gap: 6px }` (`src/index.css:2847-2865`) is already laying out:

```tsx
export interface Crumb { label: string; go?: () => void }

export function Breadcrumb({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <div className="breadcrumb">
      {crumbs.map((c, i) => (
        <Fragment key={c.label}>
          {i > 0 && <span className="sep">/</span>}
          {c.go
            ? <a href="#" onClick={(e) => { e.preventDefault(); c.go!(); }}>{c.label}</a>
            : <span>{c.label}</span>}
        </Fragment>
      ))}
    </div>
  );
}
```

A crumb without `go` is a plain `<span>`, never a link: a crumb that does not navigate is not
announced as one. `go` is optional because the Landing Page mounts `SplitScreen` with
`onBack={undefined}`.

**2. The three call sites render it.** `MatchScreen` passes
`crumbs={[{ label: "Roster", go: props.onBack }, { label: "Match setup" }]}`;
`TournamentScreen` passes
`crumbs={[{ label: "Games", go: onBack }, { label: tournament.name }]}`. `SplitScreen` does not
render `PageHeader`, so it renders `<Breadcrumb crumbs={…} />` directly in place of its
hand-rolled `.breadcrumb` div, building its first crumb from the source it already receives:

| `source` | First crumb | `go` |
|---|---|---|
| `ad-hoc`, `tournament` | `Match setup` | `onBack` |
| `session` | `History` | `onBack` |
| `squad` | `Squad detail` | `onBack` |

Those labels are the ones its own back button already renders
(`src/session/SplitScreen.tsx:375`: `source === "session" ? "History" : source === "squad" ? "Squad detail" : "Match setup"`),
so this makes the crumb agree with the button instead of inventing a destination, and each is a
hub or leaf in FLOW §3's edge table.

**3. `src/ui/PageHeader.tsx` needs no change.** Measured, it is rendered by seven screens:
`DashboardScreen`, `DisciplinesScreen`, `HistoryScreen`, `MatchScreen`, `SquadsScreen`,
`GamesScreen`, `TournamentScreen` — plus the roster screen that `App.tsx` renders — and its
`crumbs` prop already accepts `<Breadcrumb>`. `src/ui/Screen.tsx` is rendered by five of those
(`SquadsScreen` twice) plus `App.tsx`. Both are in use; the unused primitive was `nav.tsx`'s
`Breadcrumb`, and wiring it is the deliverable.

**Staleness correction:** `.scratch/app-health/14` and the audit say each primitive has "4
consumers". The measured numbers are 7 for `PageHeader` and 5 for `Screen`
(`grep -rln "<PageHeader" src/`, `grep -rln "<Screen" src/`). The conclusion does not change;
the absorbed ticket's count is wrong and this ticket records the measured one.

**Cross-reference to B16.** `.scratch/app-correctness/06` planned to reconcile FLOW §3 by
recording that breadcrumbs *do not* navigate. Landing this ticket first makes the documentation
true instead of codifying the gap: the contract is right and the code was wrong. B owns
`docs/FLOW.md`, so **this ticket must not edit it**; if B16 has already landed and written the
"do not navigate" line, that line is now false and the correction belongs to whoever owns the
file next — record it in the Answer.

**Acceptance criteria:**
- [ ] `grep -rn "Breadcrumb" src/` matches `src/nav.tsx` plus `MatchScreen`, `TournamentScreen` and `SplitScreen`; `grep -rn 'className="breadcrumb"' src/` matches only `src/nav.tsx` — no screen hand-rolls the markup
- [ ] `grep -rn 'href="#"' src/session/SplitScreen.tsx` returns nothing; every `<a href="#">` in `src/` has a handler that navigates
- [ ] Clicking `Match setup` on an ad-hoc or tournament split returns to match setup; clicking `History` on a session split returns to History; clicking the last (current) crumb does nothing because it is not a link
- [ ] A non-navigable crumb renders as `<span>`, not `<a>` — verified in the DOM, not by reading the diff
- [ ] Every crumb's destination matches `docs/FLOW.md` §3's table; `git diff --stat docs/FLOW.md` is empty (B owns it)
- [ ] The Landing Page's hero still renders (it mounts `SplitScreen` with `onBack={undefined}`, so its crumb is text)
- [ ] The browser suite passes with no spec edited. Note: no spec currently asserts breadcrumb text (`grep -rni "crumb" e2e/` returns nothing), so the evidence is the suite staying green plus the manual clicks above
- [ ] If B16 already wrote that breadcrumbs do not navigate, the Answer says so and names the stale line

**Blocked by:** 22, 23, 27 — ticket 22 deletes `nav.tsx`'s unused `Id` import, and tickets 23 and
27 touch the same three screens' constant imports and their dialogs. Landing them first keeps
`SplitScreen.tsx` and `TournamentScreen.tsx` from being edited twice.
