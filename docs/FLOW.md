# comp3tive · Page Flow

**Date:** 2026-09-08
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
| 2 | **Roster** | players + capabilities; add/import/export; **Disciplines**; the ad-hoc **"Split match"** entry |
| 3 | **Games** | tournaments: list, create, draft, bracket, results |
| 4 | **History** | past ad-hoc splits (Sessions): view, re-roll, save as squad, delete |
| 5 | **Squads** | saved squads: view, re-split, delete, feed a tournament |

Source of truth: `NAV_ITEMS` at `src/App.tsx:63-69`, rendered in that order by both the desktop
rail and the bottom bar. ADR-0005 recorded Home as the **centred** slot; the shipped nav puts it
first, so the centring claim is superseded by the code.

## 2. Leaves

Every non-hub view is a **leaf**: one job, one breadcrumb, one back edge.

| Leaf | Job | Source(s) | Breadcrumb | Back goes to |
|------|-----|-----------|------------|--------------|
| **Match setup** | pick discipline, players, team count | ad-hoc (Roster), tournament (draft) | see §3 | the source hub/tournament |
| **Split result** | adjust teams (swap/re-roll), save, submit | ad-hoc, tournament, session, squad | see §3 | Match setup (if source is ad-hoc/tournament) or the source list |
| **Tournament detail** | draft → confirm teams → bracket → results | — (opened from Games) | `Games / {name}` | Games |
| **Squad detail** | read the saved teams; re-split; feed tournament | — (opened from Squads) | `Squads / {name}` | Squads |
| **Disciplines** | create/edit/delete discipline rules | Roster | `Roster / Disciplines` | Roster |

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

Not yet universally true: `src/session/SplitScreen.tsx:293-297`'s first crumb is a dead link (its handler only calls `preventDefault`), because a `session` or `squad` split has no match-setup screen beneath it. Ticket 28 replaces all three hand-rolled crumb blocks with the shared `src/nav.tsx` `Breadcrumb`, which renders a plain `<span>` when a crumb has no destination, and fixes this screen. Until then, treat this paragraph as the rule and the split screen as the exception.

```
Roster / Match setup                                   (ad-hoc)
Games / {name} / Match setup                           (tournament)
Roster / Match setup / Split result                    (ad-hoc)
Games / {name} / Match setup / Split result            (tournament)
History / {date} / Split result                        (session)
Squads / {name} / Split result                         (squad)
Games / {name}
Squads / {name}
Roster / Disciplines
```

The chains above are the **path taken**, which is what P1 is about. Every screen renders the last two segments of it and no more: measured, each of the three crumb sites emits exactly one separator (`src/session/MatchScreen.tsx:44`, `src/session/SplitScreen.tsx:295`, `src/tournament/TournamentScreen.tsx:265`), so a tournament split shows `Games / Split result`, not the four-segment chain listed here. Ticket 28 keeps the rendered depth at two; expanding the crumbs to match the full chain would be a visible redesign no ticket asks for.

## 4. Edge table (complete)

`user` = direct click. `auto` = navigation as a side effect of an async action (create/save/delete).

### Roster (hub)

| Action | To | Kind |
|--------|----|------|
| "Split match" | Match setup (source: ad-hoc) | user |
| "Disciplines" | Disciplines | user |
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
| (detail) "← Squads" / breadcrumb | Squads | user |

### Disciplines (leaf)

| Action | To | Kind |
|--------|----|------|
| row click / "+ New discipline" | edit modal (in-place) | user |
| Back / breadcrumb | Roster | user |

## 5. Empty states

- **Roster**, no players: "Add the first player" CTA; import hint.
- **Games**, none: "+ New tournament" CTA.
- **History**, no sessions: "Splits you run from Roster land here."
- **Squads**, none: "Save a split as a squad to reuse it."
- **Tournament draft**, no matching saved squads: the "Or use a saved squad" section is hidden.

## 6. What this flow is NOT

- No URL routing, no browser back/forward: a local-first single-user tool; in-app Back
  covers navigation, and breadcrumbs name the path (ADR-0004).
- No modal-based flows with more than one step: the only multi-step flow is Match setup →
  Split result, which is a leaf pair, not a modal.
- No implicit cross-feature jumps: the single sanctioned cross-hub CTA is
  Squads → Games (prefilled create), and it is labeled and user-initiated.
