# 02: Fair Split solver

**What to build:** The product's brain, verified headlessly: given a pool of players (with their Capabilities), a Discipline, and session settings, produce the Fair split that minimizes the strength gap between teams while honoring role coverage and size rules. MLBB role coverage is hard (all five roles on every team); futsal coverage is soft (minimum 5 players; unfilled roles get best-fit assignment plus a visible flag). Role eligibility is respected; preferred roles are preferred where balance allows; Subs and unequal team sizes are measured by average Strength; output is deterministic. Returns teams, the gap, and flags.

**Blocked by:** 01 (Domain model foundation)

**Status:** resolved

## Answer

Built the Fair split solver at `src/solver/solver.ts` (the single test seam per the spec). API: `fairSplit(pool, discipline, settings) -> { teams, gap, flags, unassigned, solver }`, plus `buildSettings`, `suggestTeamCount`, `poolFromPlayers`. Exact search over canonical set partitions (each split generated exactly once), minimizing max(avg) - min(avg). Role coverage hard for MLBB (backtracking role assignment maximizing preferred matches), soft for futsal (best-fit + role-uncovered flags); even team sizes (differ by at most 1); MLBB leftovers sit out and are flagged; sub-min pools flagged best-effort.

Two real bugs found and fixed during development: (1) an initial pruning rule made the search only explore contiguous-run partitions (a team once closed could never re-open), so the solver missed optimal splits - replaced with the full canonical partition enumeration; (2) TypeScript keeps `= null` narrowing across closure assignments, which required an explicit type assertion on the captured result.

Performance: branch-and-bound over strength-sorted players with suffix-restricted prefix-sum bounds proves optimality for pools up to ~20 (futsal 16 -> 3 in 6ms, 20 -> 4 in 33ms, MLBB 20 -> 4 in 45ms); very large futsal pools (24+) fall back to greedy-quality (gap <= 0.017) in under 250ms with `solver.optimal: false` reported honestly. 33 tests green (19 domain + 14 solver), `tsc -b` and `vite build` clean.

- [ ] For small pools, the split's strength gap is optimal (verified against brute-force ground truth)
- [ ] MLBB teams always cover all five roles; futsal teams always have at least 5 players when the pool allows
- [ ] Players only ever get Roles they are eligible for; preferred Roles are used unless balance forces otherwise
- [ ] Teams of different sizes (Subs) are balanced by average Strength
- [ ] Deterministic: identical input yields identical output
- [ ] Flags surface unfilled Roles, players left out (MLBB leftovers), and teams below minimum size
- [ ] Tested only through its public behavior at the solver seam, per the spec's Testing Decisions — no tests on internals
