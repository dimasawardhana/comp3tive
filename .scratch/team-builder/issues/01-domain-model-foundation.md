# 01: Domain model foundation

**What to build:** The shared substrate the solver and the app both build on: the domain vocabulary as types (Player, Capability, Discipline, Role, Attribute, Strength, Session, Team, Sub), the seeded Futsal and MLBB disciplines with their roles, attributes, and strength model, and the pure Strength computation that turns a capability's attribute ratings into a number. No UI, no storage — this exists so parallel work can't define conflicting models.

**Blocked by:** None (can start immediately)

**Status:** resolved

## Answer

Built the domain substrate in `src/domain/` (types, strength model, validation, seed data) with the Vite + React + TS scaffold and Vitest. All model invariants enforced and tested: at most one Capability per Discipline, ratings in 1-5, eligibility inside the Discipline's roles, preferred Role inside the eligibility list. Strength uses the discipline-owned "mean" model (equal-weight average); the dispatcher is the single switch for future models. Futsal (4 roles, 3 attributes, soft roles, min 5 + subs) and MLBB (5 roles, 4 attributes, hard roles, exactly 5) seeded. 19 tests green; `tsc -b` clean. Team size constraints were added to Discipline as a natural part of the model (needed by ticket 02).

- [ ] The domain types enforce the model: a Player carries Capabilities, at most one per Discipline; a Capability holds attribute ratings (1–5), an eligibility list of Roles, and one preferred Role (preferred must be in the eligibility list)
- [ ] Futsal and MLBB are seeded with their roles and attributes per the spec: Futsal (goalkeeper, defender, winger, pivot; technical, fitness, game IQ), MLBB (tank, assassin, mage, marksman, fighter; mechanics, game sense, hero pool, teamwork)
- [ ] Strength is computed per Discipline through its strength model (v1: weighted sum with equal weights) and covered by tests
- [ ] The strength model is pluggable per Discipline — a Discipline owns its model and a different model can be attached without changing callers
