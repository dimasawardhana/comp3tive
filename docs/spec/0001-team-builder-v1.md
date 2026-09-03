# Team Builder v1 — Fair Split

## Problem Statement

Organizing futsal nights and Mobile Legends sessions with friends means splitting the people who showed up into teams that are fair and playable. Doing that by hand is slow, biased, and contentious: someone has to eyeball skill levels, argue over who plays goalkeeper, fight over who covers tank, and renegotiate whenever someone arrives late. It gets worse as the roster grows, and the result is almost never actually balanced.

## Solution

A local web app (deployable later) where the organizer maintains a roster of Players once, then generates balanced teams in seconds. Each Player carries a Capability per Discipline (futsal, MLBB) with attribute ratings, an eligibility list of Roles they can fill, and one preferred Role. For a session, the organizer picks who is present, chooses the Discipline, and the app computes a **Fair split**: an exact search that minimizes the strength gap between teams while honoring role coverage (hard for MLBB, soft for futsal) and team size rules (futsal min 5 with Subs, MLBB exactly 5). The result is fully editable — swap players with a live gap indicator, re-roll freely — and saved as a Session so history is never lost.

## User Stories

### Roster

1. As an organizer, I want to add a player to the roster with a name and optional notes, so that I can build teams from a known list of people.
2. As an organizer, I want to record a player's capability in a discipline with attribute ratings (1–5), so that team strength can be computed.
3. As an organizer, I want to record which roles a player can fill in a discipline plus their preferred role, so that role coverage reflects what people actually play.
4. As an organizer, I want to edit a player's details and capabilities, so that I can correct ratings when someone improves or their preferences change.
5. As an organizer, I want to delete a player from the roster, so that the list reflects who is still around.
6. As an organizer, I want the roster to show each player's strength per discipline at a glance, so that I can sanity-check my data.
7. As an organizer, I want a player to hold capabilities in multiple disciplines, so that the same roster serves futsal and MLBB.

### Disciplines

8. As an organizer, I want the app pre-seeded with Futsal and MLBB, each with its own roles and attributes, so that I can start immediately.
9. As an organizer, I want each discipline to define its own roles, attributes, and strength model, so that the catalog can grow (badminton, volleyball, …) without code changes.
10. As an organizer, I want to create new disciplines with their roles and attributes, so that the tool covers whatever we play next.

### Sessions & balancing

11. As an organizer, I want to start a session by selecting the players who are present, so that absentees never end up in teams.
12. As an organizer, I want to choose the discipline for a session, so that teams are balanced for that activity.
13. As an organizer, I want the app to suggest a default number of teams from the pool size and team minimum, so that I don't do mental math.
14. As an organizer, I want to override the number of teams, so that I can respond to how many people actually want to play.
15. As an organizer, I want the split to minimize the strength gap between teams, so that no one is stuck on a stacked or hopeless team.
16. As an organizer, I want MLBB teams to cover all five roles (tank, assassin, mage, marksman, fighter), so that every team is playable.
17. As an organizer, I want futsal teams to have at least 5 players, so that games are playable.
18. As an organizer, I want extra players assigned as subs on futsal teams, so that rotation is possible and no one is left out.
19. As an organizer, I want the solver to respect role eligibility, so that players only get roles they can actually play.
20. As an organizer, I want the solver to prefer a player's preferred role where balance allows, so that people usually get what they asked for.
21. As an organizer, I want unfilled roles, unbalanced sizes, or forced compromises flagged clearly, so that I know the limits of what was possible.

### Editing the result

22. As an organizer, I want to swap any two players between teams after the split, so that I can accommodate social realities the data doesn't know.
23. As an organizer, I want to see the live strength gap as I edit, so that I know whether manual changes made things fairer or not.
24. As an organizer, I want to re-roll the split, so that I can get a fresh assignment when the last one feels off.

### Sessions & data

25. As an organizer, I want each team-building run saved as a session (pool, discipline, settings, resulting teams), so that I can revisit who played and how teams came out.
26. As an organizer, I want to reopen an old session and rebuild from its pool, so that I can reuse last week's roster with one click.
27. As an organizer, I want to delete old sessions, so that history stays tidy.
28. As an organizer, I want my roster and sessions to persist in the browser between visits, so that I don't re-enter data every time.
29. As an organizer, I want to export my data as a JSON file, so that nothing is lost when I switch browsers or machines.
30. As an organizer, I want to import an exported file, so that I can restore or move my data.

### Edge cases

31. As an organizer, I want a warning when the pool can't fill the requested teams (e.g., an MLBB leftover sits out), so that I can decide what to do.
32. As an organizer, I want players without a capability in the chosen discipline excluded from that session's split, so that teams only contain people who can actually play.
33. As an organizer, I want teams of different sizes handled fairly (strength measured by average), so that 6v5 futsal with subs is still a fair game.
34. As an organizer, I want the app to work offline, so that I can organize teams at the futsal court with no internet.

## Implementation Decisions

- **Stack**: React + Vite + TypeScript SPA, client-only, deployable later as a static site.
- **Persistence** (respects ADR-0001): IndexedDB behind a storage interface — no ORM. Sessions and roster are plain JSON documents. JSON export/import fulfills the ADR's data-migration path.
- **Domain model** (vocabulary per CONTEXT.md):
  - Player: `{ id, name, notes }`
  - Capability: `{ disciplineId, attributeRatings, eligibleRoles, preferredRole }` — at most one per player per discipline
  - Discipline: `{ id, name, roles[], attributes[], strengthModel }` — roles, attributes, and the strength model are all discipline-owned; seed data: Futsal (roles: goalkeeper, defender, winger, pivot; attributes: technical, fitness, game IQ) and MLBB (roles: tank, assassin, mage, marksman, fighter; attributes: mechanics, game sense, hero pool, teamwork)
  - Session: `{ id, pool, disciplineId, settings, teams }` — a saved snapshot of a team-building run
- **Strength**: a pluggable per-discipline function combining the capability's attribute ratings into a single Strength number. v1: weighted sum with equal weights; the interface allows role-aware or differently weighted models later.
- **Solver**: exact search (exhaustive assignment with pruning) that minimizes the strength gap between teams — sum-based for equal team sizes, average-based for unequal sizes (Subs). Constraint handling: MLBB role coverage is hard (all 5 roles on every team), futsal coverage is soft (min 5 players; unfilled roles get best-fit assignment plus a visible flag). Team size is a range (futsal: ≥5 with subs; MLBB: exactly 5). Runs behind a solver interface so a heuristic can be swapped in if pools ever grow beyond v1 scale.
- **Team count**: suggested default `floor(poolSize / minTeamSize)` per session, user-overridable.
- **Editing**: solver output is editable — manual player swaps between teams with a live strength-gap indicator and re-roll.
- **Edge handling**: MLBB leftovers sit out with a warning (swappable in via editing); futsal pools too small for the requested count get best-effort assignment with sizes flagged.

## Testing Decisions

- **Single seam**: the Fair Split solver. It is pure and deterministic: `fairSplit(pool, discipline, settings) → { teams, gap, flags }`. Every behavioral test lives here.
- **What makes a good test**: external behavior only — given a concrete pool, discipline, and settings, assert the output satisfies the constraints (role coverage hard/soft, team sizes, eligibility, preferred-role preference) and that the strength gap is minimal (verified against brute-force ground truth for small cases). Determinism is asserted explicitly. No test touches internals (pruning strategies, data structures).
- **Modules tested**: the solver core (the seam above). Storage and UI get only minimal smoke checks, not behavioral suites — they are thin shells over the solver.
- **Prior art**: none — greenfield repo. This suite establishes the pattern (Vitest for the solver seam; a small in-browser IndexedDB smoke test for the storage adapter).

## Out of Scope

- Role-complete (single-team lineup) mode — backlog; fair split is the v1 scope.
- Backend, multi-user, auth — deferred by ADR-0001.
- Deployment itself.
- Import from external sources (contact lists, WhatsApp, CSV) — only JSON export/import of the app's own data.
- Availability scheduling, contact info, or team history analytics (streaks, win rates).
- Disciplines beyond the two seeded — the catalog is extensible, but only Futsal and MLBB ship in v1.
- Mobile apps.

## Further Notes

- Discipline definitions (roles, attributes, strength weights) are data, not code — intended to be editable without a release.
- Solver optimality is the point: for v1 pool sizes (≤ ~30), exact search is trivially fast and "fair" has a proof. The solver interface is the seam that would absorb a heuristic later.
- The editable result with a live gap is a deliberate product decision: the algorithm proposes, the organizer disposes, and the gap number keeps manual changes honest.
- Data portability (export/import) is not a nice-to-have — it is the migration path ADR-0001 relies on.
