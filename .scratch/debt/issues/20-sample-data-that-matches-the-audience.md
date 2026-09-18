# 20: Sample data that matches the audience

**Status:** ready-for-agent

**What to build:** The roster files a new organizer downloads look like the rosters `PRODUCT.md`
names — a futsal night organizer's group, an MLBB squad — instead of a professional esports league,
and each one splits cleanly under the app's own defaults. The futsal file stops shipping data the
app's own validator rejects.

**Evidence.** `PRODUCT.md` names "Futsal night organizers", "MLBB squad captains", and
"Multi-sport community managers". Both shipped samples are 25 Indonesian esports professionals
with real org tags:

```
mpl-id-roster.json   25 players   ONIC · Jungle, RRQ · Mid, EVOS · Gold, Aura Fire · EXP, Alter Ego · Roam
futsal-roster.json   25 players   same names: Kairi is a goalkeeper, Lemon is a winger
```

Measured with the repo's own validator (`src/domain/validation.ts`):

- **`futsal-roster.json`: 7 of 25 players fail `validatePlayer`** — `cw`, `cr1te`, `wannn`, `oura`,
  `luminaire`, `nino`, `blustine`, every one for
  `Preferred role "pivot"|"winger" must be inside the eligibility list`. The file ships data the
  app rejects.
- Its role spread is unusable: `goalkeeper` eligible for 25/25 players, `defender` 25/25, `winger`
  11/25, `pivot` 0/25. A 5-team futsal split emits **8 `role-uncovered` flags** on the shipped
  sample.
- `mpl-id-roster.json` is valid but thin (`mage` 5/25, `marksman` 5/25, `tank` 15/25, `fighter`
  15/25, `assassin` 10/25), and its 5-team split costs **4,000,001 nodes** and returns
  `optimal: false`, gap 0.350.

**What to build, exactly.** Three files. Every figure below was produced by running the shipped
solver over the proposed roster.

**1. `sample-data/futsal-roster.json`** — 25 players, five bands of five:

- ids `futsal-01` … `futsal-25`; `notes` `"Sunday League · <Role>"`; `exportedAt` an ISO string;
  `sessions: []`; `version: 1`.
- names, in order: `Rangga, Bayu, Dimas, Yoga, Fikri, Adit, Gilang, Reza, Tio, Bagas, Nanda, Ucok,
  Wahyu, Ilham, Rafi, Bima, Sandi, Arif, Doni, Hendra, Yudi, Panji, Aldo, Bram, Cakra`.
- construction, with `roles = ["goalkeeper","defender","winger","pivot"]` and `i` the 0-based
  index:
  - `eligibleRoles: roles` (all four — every player can fill any futsal position)
  - `preferredRole: roles[Math.floor(i / 5) % 4]`
  - `attributeRatings: { technical: r, fitness: r, "game-iq": r }` where
    `r = 2 + (Math.floor(i / 5) % 4)`
  - bands result: 0–4 `goalkeeper`/2, 5–9 `defender`/3, 10–14 `winger`/4, 15–19 `pivot`/5,
    20–24 `goalkeeper`/2
- measured: `validatePlayer` — 0 invalid; suggested team count 5; `teams=5`,
  `sizes=[5,5,5,5,5]`, `gap=0.000`, `optimal=true`, `flags=[]`.

**2. `sample-data/mpl-id-roster.json`** — 25 players, five per role:

- ids `mlbb-01` … `mlbb-25`; `notes` `"Ranked squad"`.
- names, in order: `Kiww, Jendral, Saber, Lumos, Renz, Vandal, Ozzy, Kenz, Ryuu, Taka, Nori, Zeke,
  Panca, Vier, Monz, Kuro, Kaze, Sora, Volt, Refa, Tora, Wira, Yuki, Zenn, Ari`.
- construction, with `roles = ["tank","assassin","mage","marksman","fighter"]`:
  - `preferredRole: roles[i % 5]`
  - `eligibleRoles: [roles[i % 5], roles[(i + 2) % 5]]` (a primary and a secondary role, so every
    player is genuinely playable in the split)
  - all four attributes rated `2 + ((i + k) % 4)` for `k = 0..3`
- measured: 0 invalid; suggested team count 5; `teams=5`, `sizes=[5,5,5,5,5]`, `gap=0.000`,
  `optimal=true`, `flags=[]`, every team `tank+assassin+mage+marksman+fighter`.
- this intentionally trades the shipped sample's harder problem for a clean demo: five specialists
  per role and even ratings make the default split fully provable, which is what a sample is for.

**3. `sample-data/badminton-roster.json`** (new, for ticket 19) — 10 players. Ticket 20 authors
the file; ticket 19 owns registering it in `src/data/sample-data.ts` and the matching catalog
assertion, so the two tickets do not edit the same file:

- ids `badminton-01` … `badminton-10`; `notes` `"Club night"`.
- names: `Dimas, Sari, Rangga, Putri, Bayu, Ayu, Fikri, Nadia, Yoga, Intan`.
- `eligibleRoles: ["front-court", "rear-court"]`; `preferredRole` alternating
  `rear-court`/`front-court`; three attributes rated `3 + ((i + k) % 3)` for `k = 0..2`.
- measured: 0 invalid; suggested team count 5; `teams=5`, `sizes=[2,2,2,2,2]`, `gap=0.000`,
  `optimal=true`, `flags=[]`.
- register it in `src/data/sample-data.ts` so `listDisciplinesWithSampleData()` includes it.

**Format requirements.** All three keep `"version": 1`, an `exportedAt` string, `players`, and
`sessions: []` — the shape `parseBackup` accepts (`src/data/transfer.ts:100-104`) and the shape
`src/data/sample-data.ts` imports. The v1 backup format is unchanged.

**Name discipline.** The new samples share no names with each other (the current files share all
25 between the two disciplines), and none collide with the landing hero's roster
(`Budi, Andi, Citra, Dewi, Eka, Fajar, Gita, Hana, Irfan, Joko`, `src/landing.tsx:19-30`) or its
bracket preview (`Eka, Irfan, Citra, Gita`), so a downloaded sample can never be mistaken for the
page's demo.

**The Vite dynamic-import warning: recorded, not fixed.** `npx vite build` warns:

> `src/data/sample-data.ts is dynamically imported by src/App.tsx but also statically imported by
> src/domain/useDisciplines.ts, dynamic import will not move module into another chunk.`

This is a bundling concern, and `contracts.md` gives `vite.config.ts` and the shell decomposition
to Phase C. Fixing it means moving the static import out of `useDisciplines.ts` — an architectural
edit, not a data edit. The three new/changed JSON files do not change the warning: it is about the
module, not the data. This ticket records the warning so it is not mistaken for something B20 left
undone. If Phase C declines it, it is a one-line follow-up ticket.

**Coupling check.** `src/data/sample-data.ts:2-3` is the only importer of the JSON
(`grep -rn "futsal-roster\|mpl-id-roster" src/ e2e/`). No e2e spec reads the files:
`e2e/tests/squads/saved-squad.spec.ts:22-31` builds its own 10 players in memory. Changing the
files cannot break a spec.

**Acceptance criteria:**
- [ ] Every player in all three files passes `validatePlayer` for their discipline
- [ ] Futsal splits 25 players into 5 teams with `gap = 0.000`, `optimal = true`, and zero flags
- [ ] MLBB splits 25 players into 5 teams with `gap = 0.000`, `optimal = true`, zero flags, and every team covering all five roles
- [ ] Badminton splits 10 players into 5 teams of 2 with `gap = 0.000`, `optimal = true`, and zero flags
- [ ] No file contains `ONIC`, `RRQ`, `EVOS`, `Aura Fire`, or `Alter Ego`
- [ ] The futsal and MLBB files share no player names, and neither collides with the landing hero's names
- [ ] All three files have `"version": 1`, an `exportedAt`, `players`, and `sessions: []`
- [ ] `sample-data/badminton-roster.json` exists at the path and shape ticket 19's registry entry expects (the registry edit itself is ticket 19's)
- [ ] `npx vitest run` passes (ticket 19 owns the `sample-data.test.ts` catalog assertion)
- [ ] `npx vitest run` passes

**Blocked by:** — (ticket 19 consumes the badminton file; the other two files are independent)
