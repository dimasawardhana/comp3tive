# 03: Roster management

**What to build:** The app runs locally and the organizer manages the roster: add, edit, delete, and list Players, each with Capabilities per Discipline (attribute ratings 1–5, eligibility list, preferred Role); the roster shows each Player's Strength per Discipline at a glance; everything persists across reloads through the storage layer (IndexedDB behind an interface, per ADR-0001).

**Blocked by:** 01 (Domain model foundation)

**Status:** resolved

## Answer

Built the roster flow end-to-end, following the design reference (docs/design.md + prototype).

- Storage (ADR-0001): `RosterStore` interface + IndexedDB adapter (`src/storage/`) with in-memory store for tests; smoke-tested with fake-indexeddb (persistence across adapter instances = reload).
- UI: Squad screen (list, empty state, add/edit form with per-discipline Capability entry - 1-5 attribute ratings, eligible role chips, preferred role) and a `useRoster` hook that loads and writes through the store.
- Validation is wired to the domain rules with inline errors under each discipline block.
- Design system ported to `src/index.css` (tokens, both themes, Squad styles) + a `--danger` token added for error states (palette lacked one). `Discipline.shortName` added for badge fidelity (MLBB not "Mobile Legends").

Verified in a real browser via Playwright (system Chrome): 11 checks - add player with capabilities, strength badge computed live (FUTSAL 4.0, MLBB 3.5), persistence across reload, edit, delete, and all three validation paths (empty name, missing ratings, no eligible roles). Two bugs found by the browser tests and fixed: validation issue paths were double-wrapped (capabilities[mlbb][mlbb]) so inline errors never rendered; badge used the full discipline name. 36 unit tests green, tsc + vite build clean.

**Design reference:** `docs/design.md` (tokens, type, copy voice, dark mode) plus the working prototype in `prototype/` (three screens, both themes). Follow them; the prototype is the visual contract.

- [ ] The app runs locally (Vite + React + TypeScript) and starts with the seeded Futsal and MLBB Disciplines
- [ ] The organizer can add, edit, and delete Players with a name, optional notes, and Capabilities
- [ ] Capability entry validates attribute ratings (1–5) and requires an eligibility list with a preferred Role inside it
- [ ] The roster displays each Player's Strength per Discipline, computed via that Discipline's strength model
- [ ] Roster data survives reloads, persisted through the storage interface
- [ ] The storage adapter gets a minimal smoke check (the behavioral test surface stays at the solver seam)
