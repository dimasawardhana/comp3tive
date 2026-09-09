# Dashboard — first screen on load

**Status:** ready-for-agent

## Problem Statement

When the app opens, it lands on the Roster — the player-management surface. On a fresh profile, that screen is empty ("No players in this squad") and gives no sense of where the community stands: how many players exist, what tournaments are running, which squads are saved. There is no "what's going on / what should I do next" moment, and the most useful actions (split a match, start a tournament) are buried inside tabs.

## Solution

The app opens on a **Dashboard** — a home hub that shows the active community's state at a glance and points at the most likely next action. A centered **Home** button in the bottom navigation returns to it from anywhere. The dashboard greets the community by name, shows three numbers (players on the roster, saved squads, tournaments), offers a primary "Split match" action, and on a brand-new community teaches the first step instead of showing empty zeros.

## User Stories

1. As an organizer, I want the app to open on a dashboard, so that I see my community's state before I choose what to do.
2. As an organizer, I want the dashboard to name my active community, so that I know which community I'm looking at.
3. As an organizer, I want to see how many players are on my roster, so that I can tell at a glance whether I have enough to play.
4. As an organizer, I want to see how many saved squads my community has, so that I can tell whether there are reusable team setups.
5. As an organizer, I want to see how many tournaments my community has (drafts + in progress), so that I know what competitions are live or pending.
6. As an organizer, I want a prominent "Split match" action on the dashboard, so that I can start the most common flow without hunting through tabs.
7. As an organizer, I want secondary links from the dashboard to "New tournament", "Saved squads", and "Add player", so that I can reach every main flow from home.
8. As an organizer, I want to return to the dashboard from any hub via a centered Home button in the bottom navigation, so that home is always one tap away.
9. As an organizer on a fresh community (no players yet), I want the dashboard to show a guided empty state instead of zero cards, so that I know what to do first.
10. As an organizer, I want every hub (History, Games) to show only my active community's records, so that the dashboard's numbers match what the tabs show.
11. As an organizer switching communities, I want the dashboard numbers and every hub list to follow the active community, so that I never see another community's data mixed in.
12. As an organizer, I want the dashboard to load instantly from already-loaded lists, so that opening the app feels immediate.

## Implementation Decisions

- **Load target**: the app's initial view stack root becomes the dashboard view; every fresh app load lands there. (ADR-0005.)
- **Navigation**: the bottom nav becomes five slots, ordered `Roster · Games · Home · History · Squads`. The Home slot is centered and visually emphasized (house glyph, label "Home"); the screen it opens carries the h1 "Dashboard". The nav layout tightens (smaller per-tab minimum, tighter spacing) so five slots fit on mobile and desktop.
- **Navigation model**: the dashboard is a hub in the existing view stack — opening it resets the stack to the hub root, and the active-hub highlight derives from the stack root (same pattern as the existing hubs). No new routing layer.
- **Community scoping fix**: History (sessions) and Games (tournaments) lists are filtered to the active community, matching the scoping players and saved squads already apply. This is a pre-existing cross-community leak; the dashboard's counts depend on it, so it ships in the same feature.
- **Dashboard composition**: a header (hub kicker + h1 "Dashboard" + a lede naming the active community), three stat cards (players · saved squads · tournaments), one primary CTA ("Split match"), and secondary links ("+ New tournament", "Browse saved squads", "+ Add player"). Cards render from lists already loaded by the existing hooks; no new data source.
- **Empty state**: when the active community has no players (fresh profile), the dashboard shows a guided hero ("Run your first split" / "Add players") in place of the stat cards.
- **Count semantics**: players and saved squads are community-scoped already; tournaments count = the community-scoped tournament list (after the fix), draft + in-progress only.

## Testing Decisions

- **Good tests assert external behavior** — what the user sees and where navigation lands — not component internals.
- **The e2e seam is the primary test surface** (Playwright, per the existing saved-squad/discipline/split-tourney specs): the dashboard is view composition over existing data, and this repo verifies screen behavior via e2e.
- **New e2e coverage**: fresh load lands on the dashboard; Home tab navigates there from each hub; dashboard shows the correct community-scoped counts; switching community updates the numbers; a fresh community shows the guided empty state; dashboard CTAs land on their destinations.
- **Cross-community isolation e2e**: with two communities, History and Games show only the active community's records, and the dashboard counts match.
- **Prior art**: `e2e/tests/squads/saved-squad.spec.ts`, `e2e/tests/tournament/split-tourney.spec.ts`, `e2e/tests/discipline/discipline.spec.ts` — same Playwright + preview-server pattern.
- **Unit tests**: not needed for the dashboard itself (no pure module); the community-scoping change is asserted via the e2e isolation test, not a unit test.

## Out of Scope

- A recent-activity / history feed on the dashboard (decided against in grilling — the History tab is two taps away).
- Customizable dashboard widgets or layout preferences.
- Per-community dashboard configuration.
- Restoring last-visited hub between sessions (dashboard always loads first).
- The wordmark acting as a home link (the centered Home tab is the home affordance).
- Any change to the discipline catalog's global (non-community) scope.

## Further Notes

- ADR-0005 records the dashboard-first decision; CONTEXT.md defines "Dashboard", "Home", and the community-scoping rule.
- Existing e2e specs assume Roster-first or use positional `.nth()` on the 4-tab nav; they are re-anchored to the 5-tab layout as part of shipping (specs: saved-squad, setup, split, history, create).
- The dashboard's kicker label should follow the existing section-label convention (numbered "Match Sheet · 01" / "Game Tape · 02") — the specific label is a micro-decision left to implementation.


## Dashboard Teasers: Recent Players + Active Tournaments

Follow-on to the dashboard spec. The Dashboard (already shipped per the sections above)
gains two teaser sections below the stat cards: the three most recently added players and
the three most recently created active tournaments, each card showing a little detail and
drilling into the full record.

## User Stories (follow-on)

1. As an organizer, I want to see the three most recently added players on the Dashboard, so that I can tell at a glance who just joined my roster.
2. As an organizer, I want each recent-player teaser to show the player's name and the disciplines they can play, so that I can gauge who is available without opening the roster.
3. As an organizer, I want to tap a recent-player teaser and open that player's edit screen, so that I can act on a new sign-up immediately.
4. As an organizer, I want to see the three most recently created active tournaments on the Dashboard, so that I know which competitions are live.
5. As an organizer, I want each active-tournament teaser to show the name, discipline, format, teams filled out of the target, and status, so that I can assess progress at a glance.
6. As an organizer, I want to tap an active-tournament teaser and open that tournament, so that I can record results or check the bracket.
7. As an organizer, when a section has nothing to show, I want a one-line invite with a link to create the first record, so that the dashboard stays actionable rather than silently empty.

## Implementation Decisions (follow-on)

- **Sources**: both sections render from the already community-scoped lists the Dashboard receives (players and tournaments props) — no new data source.
- **Recency semantics**: "recently added player" = last three of the roster's insertion order (a Player carries no creation timestamp; the roster list appends on add). "Most recent active tournament" = active-status tournaments ranked by createdAt descending (a tournament carries no last-played timestamp, so recency is creation time), take three.
- **Sort logic lives in a pure helper module** so it is unit-testable at the repo's existing pure-module seam (the same seam solver/bracket/transfer use): functions that take the scoped list and return the top three with their order, handling fewer-than-three and empty inputs.
- **Card content**: player = name + discipline short-name badges (Roster badge styling); tournament = name + discipline short name + format label + teams filled/target + status label.
- **Click-through**: player teaser opens the roster's player-edit flow for that player; tournament teaser opens the tournament (reuse the App open flows; the Dashboard screen receives the callbacks as props, never reimplementing a flow).
- **Empty sub-sections**: a section with nothing to show renders a one-line invite — "No active tournaments" with a create link, "No players yet" with an add-player link — rather than hiding.
- **Placement**: below the stat cards, above the actions; two stacked sections, each a horizontal row of up to three cards.

## Testing Decisions (follow-on)

- **Unit**: the recency helpers are tested at the pure-module seam (what counts as top-three, order, fewer-than-three, empty, ties across equal createdAt).
- **E2e**: the existing dashboard spec extends or a follow-on asserts the sections render the expected players/tournaments for a seeded community, update on community switch, drill to the right record on click, and show the one-line invite when a section is empty.
- **Prior art**: unit tests mirror src/solver/solver.test.ts / src/tournament/bracket.test.ts style; e2e mirrors e2e/tests/dashboard/dashboard.spec.ts.

## Out of Scope (follow-on)

- Adding a createdAt to Player or an updatedAt/last-played timestamp to Tournament (recency uses insertion/creation order; a true "last played" ranking needs a schema change).
- More than three teasers, paging, or a "view all" list on the dashboard.
- Any change to the stat cards or the guided empty state.
