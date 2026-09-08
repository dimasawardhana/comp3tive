# Dashboard-first: the app lands on a Home hub, not the Roster

The app previously opened on the Roster hub (the flat initial view) even though Roster is a
management surface, not a place to decide what to do next. We decided the first screen should
be a **Dashboard** — a "Home" hub that greets the active community with its current state and
the most likely next actions — and that every app load should land there, replacing
"first screen = Roster" as the default orientation.

Navigation becomes five bottom-nav slots with the home button **centered and visually
emphasized**: `[Roster] [Games] [Home] [History] [Squads]`. The center tab is labeled "Home"
and uses the house glyph; the screen's h1 reads "Dashboard". The wordmark stays static — the
center tab is the home affordance (per the grilling record: a home a user is already on does
not need a persistent edge slot; the center slot makes it unmistakable and thumb-reachable).

The Dashboard shows, for the active community: stat cards (players on the roster, saved
squads, tournaments), one primary CTA ("Split match"), and secondary entry links. On a fresh
profile (Default community, no data yet) an empty-state hero teaches the first action instead
of showing zero cards.

**Status**: accepted

**Consequences**:
- The initial `viewStack` root changes from `{ mode: "roster" }` to the dashboard view.
- Every e2e spec that assumed Roster-first or used `.nth()` on the bottom nav must be
  re-anchored (specs: saved-squad, setup, split, history, create).
- History (sessions) and Games (tournaments) lists become community-scoped — a pre-existing
  cross-community leak (App.tsx previously passed both lists unfiltered) is fixed in the same
  pass so dashboard counts tell the truth.
- A new `DashboardScreen` (or equivalent hub) is added; hub conventions (kicker + h1 + lede)
  extend to it; `.tournament-meta-card` styling generalizes into dashboard stat cards.
