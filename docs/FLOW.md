# comp3tive · Page Flow

**Date:** 2026-09-08
**Reconciled:** 2026-09-28
**Status:** Accepted — this document is the contract. The app must conform to it.

This is the target navigation architecture. It replaces the ad-hoc view switching that let
one feature jump into another with hidden flags. Four rules govern everything below (P1–P5
in the grilling record; the contract):

- **P1** Every non-hub screen shows its path (breadcrumb of active links).
- **P2** "Back" always returns to the screen you **came from** — never a hard-coded home.
- **P3** One primary job + one primary forward action per screen; the rest are secondary/inline.
- **P4** Cross-feature actions are explicit and labeled; no implicit jumps.
- **P5** The split flow is never ambiguous: every entry names its **source**, and back/submit
  always return to that source.

## 0. Entry

The app is entered at **`/app`**. The site root (`/`) is the **Landing Page** — a plain static
document outside the app that explains what comp3tive is and links in. It holds no domain records
and is never community-scoped, so nothing below applies to it. An organizer who has already used
the app is forwarded from `/` to `/app` before first paint (ADR-0006).

## 1. Hubs

Five bottom-nav hubs. A hub is a top-level home with no back control and no breadcrumb.

| # | Tab | Owns |
|---|-----|------|
| 1 | **Home** | the Dashboard: active-community state and next actions (ADR-0005) |
| 2 | **Roster** | players + capabilities; add/import/export; the ad-hoc **"Split match"** entry |
| 3 | **Games** | tournaments: list, create, draft, bracket, results; the **Disciplines** catalog |
| 4 | **History** | past ad-hoc splits (Sessions): view, re-roll, save as squad, delete |
| 5 | **Squads** | saved squads: view, re-split, delete, feed a tournament |

Source of truth: `NAV_ITEMS` at `src/App.tsx:63-69`, rendered in that order by both the desktop
rail and the bottom bar. ADR-0005 recorded Home as the **centred** slot; the shipped nav puts it
first, so the centring claim is superseded by the code.

**Disciplines is reached from Games, not Roster.** The only entry point is the Games hub's
toolbar button (`src/tournament/GamesScreen.tsx:134-136` → `src/App.tsx:1175`). The Roster hub
has no Disciplines control, and `showDisciplines` (`src/App.tsx:695-697`) is defined with no
caller.

## 2. Leaves

Every non-hub view is a **leaf**: one job, one breadcrumb, one back edge.

| Leaf | Job | Source(s) | Breadcrumb | Back goes to |
|------|-----|-----------|------------|--------------|
| **Match setup** | pick discipline, players, team count | ad-hoc (Roster), tournament (draft) | see §3 | the source hub/tournament |
| **Split result** | adjust teams (swap/re-roll), save, submit | ad-hoc, tournament, session, squad | see §3 | Match setup (if source is ad-hoc/tournament) or the source list |
| **Tournament detail** | draft → confirm teams → bracket → results | — (opened from Games) | `Games / {name}` | Games |
| **Squad detail** | read the saved teams; re-split; feed tournament | — (opened from Squads) | none rendered — a `← Squads` control instead | Squads |
| **Disciplines** | create/edit/delete discipline rules | Games | none rendered | Games |

### Split sources

The split flow (Match setup + Split result) is one feature with four named entries:

| Source | Entry action | Header reads | Split result "Back" | Primary forward action |
|--------|-------------|--------------|---------------------|------------------------|
| **ad-hoc** | Roster → "Split match" | `Match setup` / `Split result` | Match setup, then Roster | persist → appears in **History** |
| **tournament** | Tournament draft → "Split your teams" | `{tournament} · Match setup` / `… · Split result` | Match setup, then the tournament | submit → seeds the **bracket** |
| **session** | History row → open | `History · {date} · Split result` | **History** | re-roll (stays); "Save as squad" |
| **squad** | Squad detail → "Re-split" | `Squads · {squad name} · Split result` | **Squad detail** | re-roll; "Save as squad" (new copy) |

Rules:

1. The split flow is a leaf on the hub you entered it from. The bottom nav stays visible, but
   the flow's own Back/Submit always resolve to the source — the flow is never "lost" in the hub
   context.
2. **Spec lock:** when the source is a tournament, discipline and team count are **read-only**
   and equal to the tournament's spec. The tournament owns its spec; a mismatched split would
   produce an invalid bracket.
3. **Persistence:** ad-hoc splits persist a Session (History row). Tournament splits persist the
   tournament (bracket) — no Session. Session/squad sources are synthetic: re-rolls persist
   nothing until the user explicitly saves a squad.
4. **Squad re-split** operates on a synthetic view of the saved teams; it never mutates the
   SavedSquad. Saving from that screen creates a **new** squad.

## 3. Breadcrumb table (P1)

Breadcrumbs are links — every crumb above the current screen navigates there.

Not yet universally true: the first crumb in `src/session/SplitScreen.tsx:316-320` is a dead
link — its handler calls `preventDefault` and nothing else, under the source comment "back
handled via app" — so the only link in that block goes nowhere. The screen is not missing a back
affordance: `onBack` is passed (`src/App.tsx:1229`) and renders a working `← Back` button at
`src/session/SplitScreen.tsx:397-399`. The defect is the crumb, not the screen. Ticket 28
replaces all three hand-rolled crumb blocks with the shared `src/nav.tsx` `Breadcrumb`, which
renders a plain `<span>` when a crumb has no destination (`src/nav.tsx:24-26`), and fixes this
block. Until then, treat this paragraph as the rule and the split screen as the exception.

```
Roster / Match setup                                   (ad-hoc)
Games / {name} / Match setup                           (tournament)
Roster / Match setup / Split result                    (ad-hoc)
Games / {name} / Match setup / Split result            (tournament)
History / {date} / Split result                        (session)
Squads / {name} / Split result                         (squad)
Games / {name}
Squads / {name}
Games / Disciplines
```

The chains above are the **path taken**, which is what P1 is about. What the app renders is
narrower and set by each screen's own markup, not by the chain: three screens render a
breadcrumb and each emits exactly one separator, so each shows two segments. The match-setup
screen shows `Roster / Match setup` (`src/session/MatchScreen.tsx:41-45`, separator `:43`); the
split result shows `Match setup / Split result` (`src/session/SplitScreen.tsx:316-320`, separator
`:318`); the tournament screen shows `Games / {name}` (`src/tournament/TournamentScreen.tsx:264-268`,
separator `:266`). **A tournament split therefore shows `Match setup / Split result`** — the
match-setup crumb is hardcoded whatever the source — not the four-segment chain listed here. Two
leaves render no breadcrumb at all: Disciplines has only a `Back` button
(`src/domain/DisciplinesScreen.tsx:90-92`), and the Squads detail offers a `← Squads` control
instead (`src/session/SquadsScreen.tsx:86-90`). Ticket 28 replaces the three hand-rolled crumb
blocks with the shared `src/nav.tsx` `Breadcrumb`; no ticket asks for the crumbs to grow to the
full chain, which would be a visible redesign.

## 4. Edge table (complete)

`user` = direct click. `auto` = navigation as a side effect of an async action (create/save/delete).

### Home (hub)

| Action | To | Kind |
|--------|----|------|
| "Split match" (disabled with no players) | Match setup (source: ad-hoc) | user |
| "+ New tournament" | **Games** with the create modal open | user |
| "Browse saved squads" | **Squads** | user |
| "+ Add player" | **Roster** with the player modal open | user |
| Recent players row click | **Roster** with that player's modal open | user |
| Active tournaments row click / "+ Create one" | Tournament detail / **Games** with the create modal open | user |

### Roster (hub)

| Action | To | Kind |
|--------|----|------|
| "Split match" | Match setup (source: ad-hoc) | user |
| "+ Add player" / row click | player modal (in-place) | user |
| "Import players" / "Export" | in-place (data effect) | user |
| topbar community controls | in-place (context) | user |

### Match setup (leaf)

| Action | To | Kind |
|--------|----|------|
| "Split {n} teams" | Split result (same source; session persisted for ad-hoc) | user + auto row |
| Back / breadcrumb | source hub or tournament | user |

### Split result (leaf)

| Action | To | Kind |
|--------|----|------|
| "Re-roll" | in-place (re-solve) | user |
| swap mode | in-place | user |
| "Save as squad" | in-place + modal → new Squad row | user, auto row |
| (ad-hoc) "Done" | source hub (History row exists) | user |
| (tournament) "Submit to tournament" | the tournament (bracket seeded, review) | user + auto |
| Back / breadcrumb | see §2 source table | user |

### Games (hub)

| Action | To | Kind |
|--------|----|------|
| row click / Enter | Tournament detail | user |
| "+ New tournament" | create modal → on create, **Tournament detail** (draft) | user + auto |
| "Delete" (two-step) | stays (row gone) | user + auto |
| "Disciplines" (toolbar) | Disciplines | user |

### Tournament detail (leaf)

| Action | To | Kind |
|--------|----|------|
| (draft) "Split your teams" | Match setup (source: tournament) | user |
| (draft) "Or use a saved squad → {squad}" | Tournament detail (teams seeded, review) | user + auto |
| (review) "Confirm teams" | bracket view (in-place state) | user |
| (review) "Re-split" | Match setup (source: tournament) | user |
| (bracket) match card click | record-result modal (in-place) | user |
| "Undo last game" / "Delete tournament" | in-place / **Games** (auto redirect) | user (+auto) |
| Back / breadcrumb | Games | user |

### History (hub)

| Action | To | Kind |
|--------|----|------|
| row click / Enter | Split result (source: session — the recorded result) | user |
| "Delete" (confirm) | stays (row gone) | user + auto |

### Squads (hub + detail leaf)

| Action | To | Kind |
|--------|----|------|
| row click / Enter | Squad detail | user |
| (detail) "Re-split" | Split result (source: squad) | user |
| (detail) "New tournament with these teams" | **Games** with the create modal open, prefilled (discipline + team count from the squad) | user, explicit cross-feature |
| "Delete" (confirm) | stays (row gone) | user + auto |
| (detail) "← Squads" | Squads | user |

### Disciplines (leaf)

| Action | To | Kind |
|--------|----|------|
| row click / "+ New discipline" | edit modal (in-place) | user |
| "Back" | Games | user |

## 5. Empty states

- **Roster**, no players: "Add the first player" CTA; import hint.
- **Games**, none: "+ New tournament" CTA.
- **History**, no sessions: "No history" / "Sessions appear here" / "Split your first teams and
  they'll be saved automatically." (`src/session/HistoryScreen.tsx:41-43`)
- **Squads**, none: "Nothing saved yet" / "No saved squads" / "Run a split and hit Save squad. It
  shows up here, ready for a tournament." (`src/session/SquadsScreen.tsx:124-126`)
- **Tournament draft**, no matching saved squads: the "Or use a saved squad" section is hidden.

## 6. What this flow is NOT

- No URL routing, no browser back/forward: a local-first single-user tool; in-app Back
  covers navigation, and breadcrumbs name the path (ADR-0004).
- No modal-based flows with more than one step: the only multi-step flow is Match setup →
  Split result, which is a leaf pair, not a modal.
- No implicit cross-feature jumps: the single sanctioned cross-hub CTA is
  Squads → Games (prefilled create), and it is labeled and user-initiated.
