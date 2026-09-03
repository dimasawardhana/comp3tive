# Team Builder Tournament Implementation Plan

## Overview
Address critical gaps in tournament creation, format specification, and team participation identified during domain model analysis. This plan provides actionable steps to implement missing functionality while maintaining consistency with existing codebase.

## Critical Gaps Identified

### 1. Session/Tournament Relationship Gap
**Problem**: CONTEXT.md defines "Session" (team-building run) but implementation only has "Tournament" concept
**Impact**: Unclear flow from players → teams → tournament creation

### 2. Format Specification Ambiguities  
**Problem**: Series vs Tournament relationship unclear; bye handling missing; Swiss completion criteria undefined
**Impact**: Unpredictable tournament behavior for edge cases

### 3. Teams Participation Mechanics
**Problem**: Tournament immutability scope unclear; Role-Complete mode ambiguous; Subs impact undefined
**Impact**: Inconsistent tournament management and team composition

### 4. Competition Progression Rules
**Problem**: Frontier recording edge cases; undo behavior; penalty/rematch resolution missing
**Impact**: Incomplete tournament lifecycle management

## Implementation Phases

### Phase 1: Core Relationships (Week 1)
**Deliverable**: Clear Session/Tournament Integration

**Actions**:
- [ ] Define Session entity structure matching CONTEXT.md description
- [ ] Establish Session → Tournament creation workflow
- [ ] Implement Session-based tournament team assignment
- [ ] Create Session management UI component
- [ ] Update CONTEXT.md with accurate terminology

**Files to Modify**:
- `src/domain/types.ts` - Add Session interface
- `src/tournament/TournamentScreen.tsx` - Integrate session selection
- `src/tournament/useTournaments.ts` - Session tournament creation logic
- `docs/adr/0003-session-integration.md` - Document changes

### Phase 2: Format Specification Standards (Week 2)
**Deliverable**: Clear Format Definitions with Edge Case Handling

**Actions**:
- [ ] Clarify Series vs Tournament relationship (CONTEXT.md spec)
- [ ] Implement bye handling for non-power-of-2 team counts
- [ ] Define Swiss completion criteria (top-of-table vs all-rounds)
- [ ] Document third place match optionality
- [ ] Add double elimination documentation (out-of-scope)

**Files to Modify**:
- `docs/spec/0002-tournaments-v1.md` - Enhanced format specifications
- `src/tournament/bracket.ts` - Bye and edge case implementations
- `src/tournament/TournamentScreen.tsx` - Format validation UI
- `docs/adr/0004-format-standards.md` - Document standards

### Phase 3: Teams Participation Mechanics (Week 3)
**Deliverable**: Clear Team Immutability and Role-Complete Logic

**Actions**:
- [ ] Define tournament team immutability scope
- [ ] Implement Role-Complete mode activation and logic
- [ ] Clarify Subs impact on tournament participants
- [ ] Document team composition rules
- [ ] Create team management UI components

**Files to Modify**:
- `src/domain/types.ts` - Enhanced tournament team interface
- `src/tournament/TournamentScreen.tsx` - Team management UI
- `src/tournament/bracket.ts` - Role-complete logic implementation
- `docs/adr/0005-team-participation.md` - Document mechanics

### Phase 4: Competition Progression Rules (Week 4)
**Deliverable**: Complete Tournament Lifecycle Management

**Actions**:
- [ ] Define edge cases for frontier recording
- [ ] Implement undo behavior (delete last recorded game)
- [ ] Document penalty/rematch resolution
- [ ] Add timeout/duration handling
- [ ] Create result validation system

**Files to Modify**:
- `src/tournament/bracket.ts` - Enhanced result management
- `src/tournament/TournamentScreen.tsx` - Result editing UI
- `docs/spec/0002-tournaments-v1.md` - Enhanced rules
- `docs/adr/0006-progression-rules.md` - Document lifecycle

## Technical Implementation Details

### Session/Tournament Integration
```typescript
// CONTEXT.md Session structure
interface Session {
  id: Id;
  pool: Id[]; // player ids
  disciplineId: Id;
  settings: SessionSettings;
  teams: SplitResult; // fair split results
}

// Enhanced Tournament with session relationship
interface Tournament {
  // existing fields
  sessionId?: Id; // optional session reference
  teams: TournamentTeam[]; // snapshot from session or fair split
}
```

### Format Specification Standards
```typescript
// Enhanced format constraints
enum TournamentFormat {
  SERIES = "series",           // exactly 2 teams, BO1/BO3/BO5
  SINGLE_ELIM = "single-elim", // 2/4/8 teams, byes for odd counts
  SWISS = "swiss"              // 4/6/8 teams, ceil(log2 N) rounds
}

// Format-specific rules
interface FormatRules {
  teamCounts: number[];
  hasByes: boolean;
  hasThirdPlace: boolean;
  completionCriteria: "top-of-table" | "all-rounds";
}
```

### Teams Participation Mechanics
```typescript
// Enhanced tournament team with role-complete
interface TournamentTeam {
  // existing fields
  roleComplete: boolean;     // secondary mode activation
  immutable: boolean;        // true after tournament creation
  subs: Sub[];               // rotation participants
}

// Role-Complete logic
function isRoleComplete(team: TournamentTeam, discipline: Discipline): boolean {
  const requiredRoles = discipline.roles;
  const teamRoles = team.players.map(p => getPlayerRole(p, discipline));
  return requiredRoles.every(role => teamRoles.includes(role));
}
```

## Risk Mitigation

### High Priority Risks
1. **Session/Tournament Integration** - May break existing tournament creation flow
   - **Mitigation**: Implement as optional feature first, migrate existing tournaments

2. **Format Edge Cases** - Bye handling for odd team counts could introduce bugs
   - **Mitigation**: Comprehensive test coverage for edge cases

3. **Teams Participation Changes** - Inconsistent behavior across formats
   - **Mitigation**: Format-specific team management logic

### Medium Priority Risks
1. **Progressive Enhancement** - New features may slow initial implementation
   - **Mitigation**: Priority-based implementation (core first)

2. **Documentation Updates** - CONTEXT.md drift over time
   - **Mitigation**: Version-controlled documentation

## Testing Strategy

### Unit Tests
- Format constraint validation
- Session/tournament relationship tests
- Team immutability verification
- Result frontier and undo logic

### Integration Tests
- Session creation → Tournament flow
- Format-specific tournament building
- Teams composition across formats
- Complete tournament lifecycle

### E2E Tests
- UI tournament creation workflow
- Format selection interactions
- Team management scenarios
- Match recording and progression

## Success Metrics

### Functional
- [ ] Session-based tournament creation works 90% of time
- [ ] All format constraints validated correctly
- [ ] Team participation mechanics consistent across formats
- [ ] Tournament lifecycle fully functional

### Performance
- [ ] Tournament creation < 2 seconds
- [ ] Team assignment < 1 second
- [ ] Match result recording < 500ms
- [ ] Tournament bracket building < 1 second

### Quality
- [ ] 100% test coverage for new functionality
- [ ] Zero breaking changes to existing features
- [ ] Documentation updated for all changes
- [ ] Code follows existing patterns

## Timeline Summary

**Week 1**: Session/Tournament Integration
**Week 2**: Format Specification Standards  
**Week 3**: Teams Participation Mechanics
**Week 4**: Competition Progression Rules

**Total**: 4 weeks for core implementation
**Buffer**: 2 weeks for testing and refinement
**Total Project**: 6 weeks

## Dependencies

### Internal
- Existing fair split solver must support Session integration
- Tournament bracket system must handle new format edge cases
- UI components must accommodate enhanced tournament creation

### External
- No external dependencies required
- All changes contained within codebase

## Next Steps

1. **Kickoff Meeting**: Review plan with team
2. **Phase 1 Sprint**: Begin Session/Tournament integration
3. **Weekly Reviews**: Assess progress and adjust plan
4. **Final Delivery**: Complete implementation with full testing

This implementation plan provides a structured approach to addressing critical gaps while maintaining system consistency and minimizing risk.