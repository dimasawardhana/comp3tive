# Team Builder · Page Flow (as-to-be)

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

## 1. Hubs

Four bottom-nav hubs. A hub is a top-level home with no back control and no breadcrumb.

| # | Tab | Owns |
|---|-----|------|
| 1 | **Roster** | players + capabilities; add/import/export; **Disciplines** (catalog of the rules players are rated against); the only ad-hoc **"Split match"** entry |
| 2 | **Tournaments** | tournament list, create, draft, bracket, results |
| 3 | **History** | past ad-hoc splits (sessions): view result, re-roll, save-as-squad, delete |
| 4 | **Squads** | saved squads: view result, re-split, delete, feed into a tournament |

## 2. Leaves

Every non-hub view is a **leaf**: one job, one breadcrumb, one back edge.

| Leaf | Job | Source(s) | Breadcrumb | Back goes to |
|------|-----|-----------|------------|--------------|
| **Match setup** | pick discipline, players, team count | ad-hoc (Roster), tournament (draft) | see §3 | the source hub/tournament |
| **Split result** | adjust teams (swap/re-roll), save, submit | ad-hoc, tournament, session, squad | see §3 | Match setup (if source is ad-hoc/tournament) or the source list |
| **Tournament detail** | draft → confirm teams → bracket → results | — (opened from Tournaments) | `Tournaments / {name}` | Tournaments |
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

```
Roster / Match setup                                   (ad-hoc)
Tournaments / {name} / Match setup                     (tournament)
Roster / Match setup / Split result                    (ad-hoc)
Tournaments / {name} / Match setup / Split result      (tournament)
History / {date} / Split result                        (session)
Squads / {name} / Split result                         (squad)
Tournaments / {name}
Squads / {name}
Roster / Disciplines
```

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

### Tournaments (hub)

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
| "Undo last game" / "Delete tournament" | in-place / **Tournaments** (auto redirect) | user (+auto) |
| Back / breadcrumb | Tournaments | user |

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
| (detail) "New tournament with these teams" | **Tournaments** with the create modal open, prefilled (discipline + team count from the squad) | user, explicit cross-feature |
| "Delete" (confirm) | stays (row gone) | user + auto |
| (detail) "← Squads" / breadcrumb | Squads | user |

### Disciplines (leaf)

| Action | To | Kind |
|--------|----|------|
| row click / "+ New discipline" | edit modal (in-place) | user |
| Back / breadcrumb | Roster | user |

## 5. Empty states

- **Roster**, no players: "Add the first player" CTA; import hint.
- **Tournaments**, none: "+ New tournament" CTA.
- **History**, no sessions: "Splits you run from Roster land here."
- **Squads**, none: "Save a split as a squad to reuse it."
- **Tournament draft**, no matching saved squads: the "Or use a saved squad" section is hidden.

## 6. What this flow is NOT

- No URL routing, no browser back/forward: a local-first single-user tool; in-app Back +
  breadcrumbs cover navigation (ADR-0004).
- No modal-based flows with more than one step: the only multi-step flow is Match setup →
  Split result, which is a leaf pair, not a modal.
- No implicit cross-feature jumps: the single sanctioned cross-hub CTA is
  Squads → Tournaments (prefilled create), and it is labeled and user-initiated.
