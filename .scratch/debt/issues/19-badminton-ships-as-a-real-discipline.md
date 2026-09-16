# 19: Badminton ships as a real discipline

**Status:** ready-for-agent

**What to build:** Badminton becomes a discipline you can pick, with roles and team rules the solver
actually supports, a sample roster, and a landing card that describes what ships. The landing page
stops advertising a discipline that is not in the catalog.

**Evidence.** The landing page advertises badminton three times and the app ships two disciplines:

- `index.html:73` — "Futsal, MLBB, badminton, then the tournament on those teams."
- `index.html:157` — the Roster rail's `Disciplines` fact reads `3+`.
- `src/landing.tsx:110-116` — a card with `desc: "1v1 or doubles — the split still balances,
  whether it's singles or a pair."`, `roles: ["Singles", "Doubles"]`, `teamSize: "1v1 or 2v2"`.

`SEED_DISCIPLINES = [FUTSAL_DISCIPLINE, MLBB_DISCIPLINE]` (`src/domain/seed.ts:52`). `grep -rni
badminton src/` hits only `types.ts` (a comment), `DisciplineEditModal.tsx:189` (a placeholder),
`landing.tsx` (the card), and three test files. Badminton is not a discipline you can pick.

**Why the card as written is incoherent with the model.** Read as a `Discipline`, the card is
`team: { minTeamSize: 1, maxTeamSize: 2, rolesRequired: true }` with roles `singles`/`doubles`.
Probed against the real solver, that shape returns teams (4 teams of 2 from 8 players) — but:

- `assignRoles` returns `null` unless `players.length === roleIds.length`
  (`src/solver/solver.ts:93-94`), and `consider()` rejects any team where
  `rolesRequired && !teams.every((t) => roleCoverPossible(t, roleIds))` (`:532-534`). A 2-player
  team therefore needs exactly two roles filled by exactly two players. `Singles` and `Doubles`
  are not two positions on one team; they are two *formats*, one of which puts one player per
  side. The card encodes a format choice as a role pair.
- With `minTeamSize: 1`, a 1-player team under `rolesRequired: true` needs two role slots filled
  by one player, so `roleCoverPossible` returns `false` (`if (team.length < roleIds.length) return
  false`, `:81`). 1v1 cannot be expressed by that shape at all.
- 1v1 as its own discipline works arithmetically but breaks the product:
  `suggestTeamCount` is `floor(pool / minTeamSize)` (`src/solver/solver.ts:37`), so a 10-player
  pool with `minTeamSize: 1` is offered **10 teams**. Measured: `teams=10, sizes=[1×10],
  optimal=true`. Ten friends become ten teams.

**What to build, exactly.**

**1. Add the discipline to `src/domain/seed.ts`:**

```ts
export const BADMINTON_DISCIPLINE: Discipline = {
  id: "badminton",
  name: "Badminton",
  shortName: "Badminton",
  builtIn: true,
  roles: [
    { id: "front-court", name: "Front court" },
    { id: "rear-court", name: "Rear court" },
  ],
  attributes: [
    { id: "technical", name: "Technical" },
    { id: "fitness", name: "Fitness" },
    { id: "game-iq", name: "Game IQ" },
  ],
  strengthModel: { kind: "mean" },
  team: { minTeamSize: 2, maxTeamSize: 2, rolesRequired: true },
};
```

and `SEED_DISCIPLINES = [FUTSAL_DISCIPLINE, MLBB_DISCIPLINE, BADMINTON_DISCIPLINE]`.

Why this shape, from the solver's rules rather than from taste:

| Property | Value | Solver rule it satisfies |
|---|---|---|
| `minTeamSize: 2`, `maxTeamSize: 2` | teams are exactly pairs | `sizeLow = sizeHigh = 2` (`src/solver/solver.ts:468-472`) |
| 2 roles, `rolesRequired: true` | every pair covers both courts | `roleCoverPossible` needs `team.length >= roleIds.length`; 2 ≥ 2 (`:81`) |
| one role per player | `assignRoles` succeeds | it requires `players.length === roleIds.length` (`:90`); 2 players against 2 roles holds |

Measured with a purpose-built 10-player pool (every player eligible for both courts, alternating
preferences): suggested team count 5, `teams=5`, `sizes=[2,2,2,2,2]`, `gap=0.000`, `optimal=true`,
`flags=[]`, every team `front-court+rear-court`.

**Hard coverage is deliberate.** On a degenerate pool — everyone eligible for front court only —
hard coverage returns **zero teams** (measured: `teams=0`), because no pair can cover the rear
court. Soft coverage returns teams but emits 4 `role-uncovered` flags on the same pool. MLBB
already makes the hard-coverage tradeoff (`team.rolesRequired: true`, `src/domain/seed.ts:49`), and
the split screen already has an actionable state for it: `Solver failed / Couldn't build teams`
with "Not enough eligible players for this game. Adjust the pool or change the discipline."
(`src/session/SplitScreen.tsx:349-352`). Consistency with MLBB wins.

**2. Author the badminton sample registry entry.** Ticket 20 writes
`sample-data/badminton-roster.json` (10 players, contents specified there); this ticket imports it
in `src/data/sample-data.ts` and adds it to `SAMPLE_DATA` so `hasSampleData("badminton")` is true
and `listDisciplinesWithSampleData()` includes it. The file is B20's; the registry is B19's, so
neither ticket edits the other's file.

**3. Update the landing card** (`src/landing.tsx:110-116`, owned by B14):

```tsx
{
  name: "Badminton",
  desc: "Doubles on a badminton court — pairs balanced by strength, one at the front and one at the back.",
  roles: ["Front court", "Rear court"],
  attributes: ["Technical", "Fitness", "Game IQ"],
  teamSize: "2 v 2",
},
```

and the Roster rail's `Disciplines` fact (`index.html:157`) becomes `3`.

**4. Fix the fixtures that assumed two seeded disciplines.** Verified collisions:

- `src/domain/seed.test.ts:6` asserts `["futsal", "mlbb"]` → `["futsal", "mlbb", "badminton"]`.
- `src/domain/seed.test.ts` gains badminton assertions: roles `["front-court","rear-court"]`,
  attributes `["technical","fitness","game-iq"]`, team
  `{ minTeamSize: 2, maxTeamSize: 2, rolesRequired: true }`, and the mean strength model.
- `src/storage/indexed-db.test.ts:85` and `:97` assert the seeded catalog is exactly
  `["futsal","mlbb"]` after `.sort()` → `["badminton","futsal","mlbb"]` (both sites).
- `src/data/sample-data.test.ts:20-24` asserts `listDisciplinesWithSampleData()` has length 2 →
  3, and add a `hasSampleData("badminton")` case.
- `src/domain/validation.test.ts:42` uses `disciplineId: "badminton"` as its **unknown** discipline
  and asserts `Unknown discipline "badminton"`. Its `disciplines` fixture is built locally, so it
  still passes — but it now reads as a lie. Change the id to `"padel"`.
- `src/storage/migration.test.ts:170` and `src/storage/indexed-db.test.ts:73` use `"badminton"`
  for a *custom*-discipline fixture. `migration.test.ts:176` asserts `ids` contains `"badminton"`,
  which would pass vacuously once badminton is seeded. Rename both fixtures to `"padel"`.

**5. `docs/spec/0001-team-builder-v1.md:94`** — "only Futsal and MLBB ship in v1" is corrected to
name badminton too.

**Alternative considered: remove badminton from the landing page instead.** The roadmap allows
either. Shipping is better: it makes the page's promise true rather than deleting a claim, the
discipline is one seed entry, the solver handles it correctly, and `PRODUCT.md` opens by naming
badminton as in scope.

**Acceptance criteria:**
- [ ] `SEED_DISCIPLINES` contains futsal, MLBB, and badminton, in that order
- [ ] A 10-player badminton pool with mixed court eligibility splits into 5 teams of `2 v 2` with `flags: []` and `optimal: true`
- [ ] Every team's slots carry `front-court` and `rear-court`, one each
- [ ] `src/domain/seed.test.ts`, `src/storage/indexed-db.test.ts`, and `src/data/sample-data.test.ts` assert the three-discipline catalog and pass
- [ ] The `"badminton"`-as-custom fixtures in `validation.test.ts`, `migration.test.ts`, and `indexed-db.test.ts` use a non-seeded id
- [ ] The landing card reads `roles: ["Front court", "Rear court"]` and `teamSize: "2 v 2"`, and the Roster rail's `Disciplines` fact reads `3`
- [ ] `npx vitest run` passes
- [ ] `npm run e2e` passes

**Blocked by:** 20 (the `badminton-roster.json` file). The seed constant, the fixture renames, and
the landing-card strings are independent and can land first; the `sample-data.test.ts` catalog
assertion and the registry entry need B20's file to exist.
