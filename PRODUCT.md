# comp3tive — Product Brief

## What it is
A local-first web app for casual sports organizers (futsal, MLBB, badminton, and more) who need to split a group of players into fair teams for a session or tournament. Everything is stored in IndexedDB on the device and works with no network. An optional Account for cross-device durability is decided and planned (`docs/adr/0007-optional-backend.md`) and is not built yet; the app does not require one.

## Who uses it
- **Futsal night organizers** picking sides from a group chat
- **MLBB squad captains** balancing roles for ranked sessions
- **Multi-sport community managers** running mini-tournaments

The user is the organizer, not the player. They own the data.

## What the organizer does
1. **Creates a community** (a self-contained group of players)
2. **Builds a roster** of players, each with capabilities in one or more disciplines
3. **Configures disciplines** if playing something beyond the three that ship
4. **Picks the discipline + players** for a session
5. **Splits** the players into N teams (the solver honors role coverage, team size, and strength balance)
6. **Edits the split** (swaps players, re-rolls) with a live strength-gap indicator
7. **Optionally runs a tournament** (series, single elim, swiss) — records match results, sees a bracket, declares a champion
8. **Reviews history** of past sessions

## What's NOT in scope (v1)
- Multi-user and sharing. One account owns its data and nothing is shared between organizers. An **optional** account with cross-device sync is in scope (ADR-0007); collaboration is not.
- Mobile apps
- External import (contact lists, WhatsApp)
- Real-time scoreboard
- Stats across tournaments (streaks, win rates)
- Role-complete single-team mode
- Double elimination

## Success looks like
- The organizer opens the app and **runs a session in under a minute** from "we have 10 people" to "balanced teams on the court"
- The split is **defensible** — every player can see *why* the teams are fair
- **History is reliable** — they can reopen last week's session, see the teams, and rebuild from the same pool
- **No friction** — the path from "import roster" to "split into 4 teams" has no dead ends

## Constraints
- Local-first, single-organizer by default: data lives in browser IndexedDB, with an optional account for cross-device access
- Must work offline (futbol court has no signal)
- Data must be exportable as JSON (per ADR-0001)
- v1 ships Futsal, MLBB and Badminton; other disciplines are user-defined

## Voice
Plain verbs. "Pick a community." "Add a player." "Split." No marketing-speak, no friendly chatter. The product is a tool, not a friend.
