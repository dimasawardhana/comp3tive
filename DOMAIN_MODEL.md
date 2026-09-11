# comp3tive Domain Model

## Overview

comp3tive is a comprehensive system for managing player rosters and creating competitive tournaments across multiple disciplines. This domain model documents the core concepts, relationships, and rules for tournament creation, format specification, and team participation.

## Core Domain Vocabulary

### Players & Capabilities

**Community**
- A profile in the app with its own squad and history
- Every player and session belongs to exactly one community
- Players are never shared across communities
- **Avoid**: group, club, team, profile

**Player**
- A person on the roster who can be assigned to teams in one or more disciplines
- Each player can have at most one capability per discipline
- **Avoid**: person, member, user

**Capability**
- A player's proficiency in a discipline
- Includes attribute ratings, an eligibility list of roles, and one preferred role
- **Avoid**: skill, ability, discipline

**Attribute**
- A strength factor defined by a discipline and rated for each capability
- futsal: technical, fitness, game IQ
- Ratings combine via the discipline's strength model
- **Avoid**: stat, trait, skill

**Strength**
- A numeric measure of a player's value in a discipline
- Computed by the discipline's strength model from capability's attributes
- **Avoid**: rating, level, skill level

### Disciplines & Competition Structure

**Discipline**
- A catalog entry — an activity teams can be built for (futsal, MLBB, badminton)
- Defines its own roles, attributes, and strength model
- **Avoid**: activity, type, category, game, sport

**Role**
- A position within a discipline that a player fills
- futsal: goalkeeper, defender, winger, pivot
- MLBB: tank, assassin, mage, marksman, support
- Each discipline defines its own role set
- **Avoid**: position, lane, slot

### Tournament & Competition Management

**Tournament**
- A competition container created BEFORE teams are split
- Fixes: discipline, format (Series, single elimination, Swiss), series length, target team count
- Teams from the split are submitted into it
- Match results and progress are saved inside it
- **Avoid**: room, game room, tourney, competition, bracket (bracket = visual form, not entity)

**Tournament Team**
- A snapshot of a split team owned by the tournament
- Represents a group of players assigned to play together in tournament competition
- Immutable after submission (snapshot concept)

**Match**
- One play between two tournament teams
- Always produces a winner (no draws)
- Optional scores
- **Avoid**: game, fixture, battle

**Series**
- A best-of-N run of matches between the same two teams
- First team to win the majority takes the series
- A standalone best-of match is a Tournament with 2 teams
- **Avoid**: rubber, set, tie

**Game**
- Banned as a domain term (a Discipline is what a game is not called)
- Individual plays inside a series are Matches

### Team Creation & Management

**Team**
- A group of players assigned to play together in a session
- Size range: futsal teams have minimum 5, may include subs
- MLBB teams are fixed at 5 with all roles covered
- **Avoid**: squad, side, lineup

**Sub**
- A player assigned to a team beyond its minimum size
- Available for rotation
- **Avoid**: bench, reserve

**Fair Split**
- Dividing a session's player pool into teams of roughly equal strength
- Measured by average strength when sizes differ
- Honors role coverage and size constraints
- **Avoid**: balanced composition

**Role-Complete Team**
- A single team whose required roles are all filled, built from the pool
- Secondary mode; fair split is the primary mode

### Tournament Creation Process

**Tournament Creation Steps**

1. **Initial Creation**
   - Create tournament container BEFORE any teams exist
   - Define core specs: discipline, format, series length, team count
   - Tournament locks these parameters before team creation begins

2. **Team Count Constraints**
   - Series format: exactly 2 teams
   - Single elimination: 2, 4, or 8 teams
   - Swiss format: 4, 6, or 8 teams
   - Format determines valid team count range

3. **Discipline Specification**
   - Tournament fixed to specific discipline (e.g., futsal, MLBB, badminton)
   - Discipline defines: roles, attributes, strength model
   - Tournament inherits discipline rules and constraints

4. **Format Selection**
   - **Series**: Two teams, best-of-1/3/5
   - **Single Elimination**: 2/4/8 teams, standard bracket, optional 3rd place
   - **Swiss**: 4/6/8 teams, ceil(log2 N) rounds, standings table

5. **Series Length**
   - 1 (best-of-1), 3 (best-of-3), or 5 (best-of-5)
   - Only applicable to Series format
   - Determines match count to majority for series winner

6. **Team Submission Process**
   - Tournament enters "draft" state waiting for teams
   - Split screen enters tournament mode with team count LOCKED
   - Teams created through fair split solver with tournament constraints
   - Split result locked upon first team submission

7. **Team Snapshot Creation**
   - Submitted teams become TournamentTeam snapshots
   - Players, roles, and strengths captured in tournament
   - Source session no longer affects tournament teams

8. **Bracket Building**
   - Bracket computed immediately upon first team submission
   - Seeding: teams ordered by split strength (strongest = seed 1)
   - Match structure follows format rules

### Tournament State Management

**Tournament Status States**

- **Draft**: Tournament created, no teams submitted yet
  - UI: specs summary + "Split your teams" CTA
  - Can edit tournament specs, no teams submitted

- **Active**: Teams submitted, bracket built, competition in progress
  - Matches scheduled based on format
  - Results can be recorded as they occur
  - Re-roll/re-split locked after first recorded result

- **Complete**: Tournament finished, champion determined
  - All matches played, winner determined
  - No further edits to results

### Match & Result Management

**Match Structure**
- Round and position within bracket
- Two team slots (A/B), nullable until assigned
- Series length (for Series format matches)
- Games played within series (series of matches)
- Winner determined by series majority
- Optional scores per game
- Next match reference (for bracket progression)

**Recording Rules**
- **Frontier-only**: Only matches whose prerequisites are decided can record results
- **Always Editable**: Results can be fixed after the fact
- **No Draws**: Every game needs a winner
- **Series Resolution**: Majority wins determines series winner

### Data Model Relationships

```
Community
├── Player
│   └── Capability (1 per Discipline)
│       └── Attribute (Discipline-specific)
│           └── Strength (computed)
├── Session
│   ├── SplitResult
│   │   ├── TeamAssignment
│   │   │   ├── TeamSlot
│   │   │   └── Role
│   │   └── Flags (role-uncovered, leftover, below-min)
│   └── Settings (teamCount)
└── Tournament (Discipline, Format, TeamCount, SeriesLength)
    ├── TournamentTeam (snapshot of TeamAssignment)
    ├── Match (TournamentTeam A, TournamentTeam B, Series, Games)
    └── ResultHistory (editable match outcomes)
```

### Key Domain Rules & Constraints

1. **Temporal Ordering**
   - Tournaments created BEFORE teams exist
   - Team count locked before team creation
   - Source sessions independent from tournament teams

2. **Format Constraints**
   - Team counts constrained by format (Series: 2, Single elim: 2/4/8, Swiss: 4/6/8)
   - Series length only applies to Series format
   - Different formats have distinct progression rules

3. **Team immutability**
   - Tournament teams are snapshots after submission
   - Deleting source session doesn't affect active tournaments
   - Re-roll/re-split lock after first recorded result

4. **Competition Rules**
   - No draws in any match
   - Series wins by majority
   - Bracket structure varies by format
   - Frontier-only result recording maintains consistency

5. **State Transitions**
   - Draft → Active: First team submission
   - Active → Complete: Tournament finished
   - All state changes persisted and recoverable

### Design Decisions & Rationale

1. **Tournament-First Approach**
   - Competition container established before teams exist
   - Ensures format and size constraints before team creation
   - Prevents half-formed tournaments with invalid specifications

2. **Snapshot Teams**
   - Tournament teams independent from source sessions
   - Ensures tournament integrity regardless of future session changes
   - Enables retrospective analysis and historical consistency

3. **Locked Parameters**
   - Team count and discipline fixed before team creation
   - Prevents parameter drift and ensures competition fairness
   - Simplifies user experience with clear contract

4. **Editable Results**
   - Maintains organizer flexibility
   - Allows correction of recording errors
   - Preserves competitive integrity while accommodating human factors

### Implementation Considerations

1. **Seeding Algorithm**
   - Strongest team as seed 1
   - Single elimination: 1v8, 4v5 pairing
   - No byes at standard team counts

2. **Progress Validation**
   - Frontier-only matching prevents out-of-order progression
   - Bracket integrity maintained through settling algorithm
   - State transitions clear and auditable

3. **Storage Strategy**
   - One document per tournament in persistent storage
   - Community-scoped for access control
   - Team snapshots ensure historical consistency

4. **UI Flow Optimization**
   - Clear distinction between draft and active states
   - Tournament specs visible throughout lifecycle
   - Appropriate actions available per state

## Domain Model Completeness

This domain model addresses the gaps identified in the current CONTEXT.md:

1. **Clear tournament creation process** documented
2. **Format specifications** with constraints detailed
3. **Team participation mechanics** explained
4. **State management** clearly defined
5. **Data relationships** comprehensively mapped
6. **Design decisions** and rationale included
7. **Implementation considerations** provided

The model provides a solid foundation for implementing tournament creation, format specification, and team participation while maintaining consistency with existing codebase patterns.