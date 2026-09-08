# Team Builder

Team Builder is a tool for managing a roster of players and assembling balanced teams from that roster across multiple activities (futsal, MLBB, badminton, and more to come).

**Community**:
A profile in the app with its own squad and history. Every player, session, tournament, and saved squad belongs to exactly one community; records are never shared across communities, and every screen that lists records shows only the active community's.
_Avoid_: group, club, team, profile

**Dashboard**:
The home hub the app lands on at load. It shows the active community's state at a glance — players on the roster, saved squads, tournaments — and the most likely next actions.
_Avoid_: home screen (the bottom-nav label is Home; the screen's h1 is Dashboard), overview, landing page

**Home**:
The centered bottom-nav tab that opens the Dashboard. Tab labels name destinations, so "Home" is the tab and "Dashboard" is the screen it shows.
_Avoid_: dashboard tab

**Player**:
A person on the roster who can be assigned to teams in one or more disciplines, each with its own capabilities.
_Avoid_: person, member, user

**Capability**:
A player's proficiency in a discipline: attribute ratings, an eligibility list of roles they can fill, and one preferred role. A player has at most one capability per discipline.
_Avoid_: skill, ability, discipline

**Attribute**:
A strength factor defined by a discipline and rated for each capability (futsal: technical, fitness, game IQ). Ratings combine via the discipline's strength model.
_Avoid_: stat, trait, skill

**Strength**:
A numeric measure of a player's value in a discipline, computed by the discipline's strength model from their capability's attributes.
_Avoid_: rating, level, skill level

### Disciplines

**Discipline**:
A catalog entry — an activity teams can be built for (futsal, MLBB, badminton). Each discipline defines its own roles, attributes, and strength model.
_Avoid_: activity, type, category, game, sport

**Role**:
A position within a discipline that a player fills (futsal: goalkeeper, defender, winger, pivot; MLBB: tank, assassin, mage, marksman, support). Each discipline defines its own role set.
_Avoid_: position, lane, slot

### Sessions & teams

**Tournament**:
A competition container created before teams are split: it fixes a discipline, a format (Series, single elimination, Swiss), a series length, and a target team count. Teams from the split are submitted into it, and match results and progress are saved inside it.
_Avoid_: room, game room, tourney, competition, bracket (bracket = the visual form, not the entity)

**Match**:
One play between two tournament teams. A match produces a winner (no draws) and optionally scores.
_Avoid_: game, fixture, battle

**Series**:
A best-of-N run of matches between the same two teams (best-of-3, best-of-5). The first team to win the majority takes the series. A standalone best-of match is a Tournament with 2 teams.
_Avoid_: rubber, set, tie

**Game**:
Banned as a domain term (a Discipline is what a game is not called). Individual plays inside a series are Matches.

**Team**:
A group of players assigned to play together in a session. Teams have a size range: futsal teams have a minimum of 5 and may include subs; MLBB teams are fixed at 5 with all roles covered.
_Avoid_: squad, side, lineup

**Session**:
A saved team-building run: the pool, discipline, settings, and resulting teams of one split, recorded automatically for every ad-hoc split. The History tab is the Session log.
_Avoid_: history entry (History is the tab; Sessions are the records)

**Saved Squad**:
A named, self-contained record of one fair split — discipline, player pool, team count, and the resulting teams — that the organizer saves explicitly for reuse. A draft Tournament can consume a matching Saved Squad as its teams (snapshot semantics per ADR-0002). The word "squad" is reserved for this artifact: never a single Team, never the Community roster.
_Avoid_: lineup (see Team), preset, saved session (Sessions are the automatic log; a Saved Squad is curated and keeps its own copy of the teams)

**Split** (module):

**Split** (module): The deep computation module for fair split — takes a player pool, discipline, and team count; produces a `SplitResult`. Separate from session persistence (`Session` adapter) and tournament submission (`Tournament` adapter). Internal seams: `swapPlayers`, `recomputeResult`, `freshSplit`. Tests hit the interface, not the internal seams.
_Avoid_: split-screen (UI term only), split-result (use `SplitResult` type)

**Role-complete team**:
A single team whose required roles are all filled, built from the pool. Secondary mode; fair split is the primary mode.
_Avoid_: complete-lineup, full-roles
