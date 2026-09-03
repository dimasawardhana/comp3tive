# 08: Discipline management

**What to build:** The catalog grows without code: the organizer can create new Disciplines with their own Roles and Attributes (using the default strength model), and use them in roster Capabilities and Sessions alongside the seeded Futsal and MLBB.

**Blocked by:** 03 (Roster management), 04 (Session split flow)

**Status:** resolved

## Answer

Built Discipline management: the catalog is now data, not code.

- `DisciplineStore` (IndexedDB object store, DB version 3, seeded with Futsal + MLBB on first open) + `useDisciplines` hook that ALSO lazy-seeds when the catalog is ever found empty (robustness: a fresh/rebuilt database can't leave the app without disciplines).
- App now loads disciplines dynamically everywhere they were a static import (roster badges, PlayerForm capability entry, Match game selection, History, Split).
- Disciplines screen (topbar "Disciplines" link): lists the catalog (built-ins marked "built in" and undeletable), and a create form - name, role list, attribute list (slugged, collision-proof ids), min players per team. Custom disciplines use the mean strength model with soft role coverage and get random-suffixed ids (e.g. "badminton-7a51").

Verified in a real browser (10 checks): create Badminton (roles Singles/Doubles, attributes Skill/Speed, min 2) -> it persists, players seeded against its real id show BADMINTON badges, it appears in game selection, splits 4 players into 2v2, and can be deleted (built-ins cannot). Also hardened seed-on-empty after the browser test exposed the gap. 50 unit tests green, tsc + build clean.

- [ ] The organizer can create a Discipline with a name, Role list, and Attribute list
- [ ] New Disciplines appear in roster Capability entry and in Session Discipline selection
- [ ] Sessions can be built for a new Discipline using the solver
