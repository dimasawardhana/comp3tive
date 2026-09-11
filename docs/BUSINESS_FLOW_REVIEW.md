# comp3tive · Business Flow Review

**Date:** 2026-09-02
**Test subject:** `sample-data/mpl-id-roster.json` (25 MPL-ID pro players)
**Status:** All critical paths pass

---

## 1. What the app does

comp3tive is a local-first, IndexedDB-backed tool for **organising a community of players, picking a squad for a tournament, and splitting the squad into fair teams**.

There is no server, no auth, no network roundtrip. Everything lives in the browser. A user can back up and restore their data as a JSON file.

### Domain objects

- **Community (a.k.a. squad)** — A self-contained player pool. Players never span communities.
- **Player** — A person with one or more `Capability` entries. Each `Capability` belongs to one `Discipline` (e.g. MLBB, Futsal) and carries `attributeRatings` (1-5 per attribute), `eligibleRoles`, and an optional `preferredRole`.
- **Discipline** — A sport/game. Built-ins are `futsal` and `mlbb`. Each discipline has its own attributes, roles, team-size rules, and a `strengthModel` ("mean" in v1).
- **Tournament** — A competition container with format (single-elim / swiss / series), team count, and a generated bracket.
- **Session** — A recorded split: which players played, which teams came out, the `gap` (max-min avg strength), any solver `flags`.

---

## 2. The flow, end to end

The four happy-path steps, in order:

```
┌─────────────┐   pick squad    ┌────────────┐   pick match   ┌──────────┐   save    ┌──────────┐
│  Community  │ ───────────────▶│   Roster   │ ──────────────▶│  Match   │ ────────▶│ History  │
│  (squad)    │                 │  (players) │                │  (split) │           │ (log)    │
└─────────────┘                 └────────────┘                └──────────┘           └──────────┘
       ▲                                ▲                            │
       │  every step                    │  start match               │  back to roster
       └────────────────────────────────┴────────────────────────────┘
```

### Step 1 — Community

A community is the **root container**. The user creates one (top-right "**+ New Squad**" in the roster screen) and gives it a name. From then on, every player, session, and tournament belongs to that community. Players cannot leak across communities.

The community selector is in the **topbar** (the masthead) — it's a permanent pill labeled `SQUAD ▾`. Switching squads swaps the entire view: a different player list, different history. This is a deliberate choice — the squad IS the context, so it should always be one tap away.

### Step 2 — Roster

Within a community, the user assembles a player pool. Three ways to add a player:

1. **+ Add Player** (top of the roster screen) — manual form: name + discipline + strength
2. **Import Players** (next to it) — accepts either:
   - A players-only JSON file (`{ "players": [...] }`) — players are added to the current community
   - A full v1/v2/v3 backup JSON (the file we shipped in `sample-data/`) — everything is **merged**, not replaced
   - A CSV (`Name, Discipline, Strength`) — players are added to the current community
3. **Add via legacy import** (the topbar `Import` button) — accepts a full backup JSON, **merges** into current data

The "**Import**" button in the topbar is the operator's "restore from backup" lever; the "**Import Players**" in the roster toolbar is the "import a list of people" lever. They're different operations and they should look different.

### Step 3 — Match (the split)

The user picks `Random Match` or opens a tournament and starts a match. This routes to the `MatchScreen`, where they:

1. Pick or confirm the discipline
2. Toggle players in/out of the squad
3. Set the number of teams
4. Hit `Split`

The solver (`fairSplit` in `src/solver/solver.ts`) does the work. The result is a `SplitResult`:

- `teams[]` — each with `slots[]` (one per player, each slot has an assigned `roleId` if role-required)
- `gap` — the difference between the strongest and weakest team. Lower = fairer.
- `flags[]` — issues like `role-uncovered`, `leftover`, `team-below-min`

The user sees the teams in `SplitScreen`, can swap players, and either **persist** (writes a `Session`) or **submit to tournament** (writes a `Tournament` match record).

### Step 4 — History

A persisted `Session` shows up in the `History` tab. The user can reopen it to re-split the same squad (handy for a rematch) or delete it.

---

## 3. The import story (post-fix)

Before this fix, `handleImport` did one thing: replace everything in the local DB with the contents of the JSON file. That's destructive and surprising for a "least example data" import. The fix:

### `handleImport` (topbar) — full backup file
- Detects file is JSON
- Parses via `parseBackup` (handles v1, v2, v3)
- **Diffs against existing data by id** — only inserts records whose id is not already in the store
- Confirms with the user: "Import 1 new community, 25 new players, 0 sessions, 0 tournaments? (Existing records with the same id are kept.)"
- If 0 new records, no prompt fires

### `handlePlayerImport` (roster toolbar) — players-only or full
- Detects file type by content
- **Full backup** (has `version` field) → delegates to `handleImport` (the merge path)
- **Players-only JSON** (`{ "players": [...] }`) → adds each player to the **active community** with a fresh UUID if the file has none
- **CSV** → existing behaviour, unchanged

### Why this matters
The shipped `sample-data/mpl-id-roster.json` is a **v1 backup** with no `communities` field. The existing `parseBackup` already handles that (auto-creates a "Default" community) and v3-ifies the result. So the import path already had the right migration logic — what was wrong was the **UI surface** (no import button in the topbar) and the **mutation semantics** (replace vs merge).

---

## 4. End-to-end test results

Ran the full flow against `sample-data/mpl-id-roster.json`:

```
━━━ STEP 1: Import sample roster (mpl-id-roster.json) ━━━
  ✓ Parsed v3 backup
  ✓ Auto-created community: "Default"
  ✓ Imported 25 players across 5 pro teams
  ✓ All players have mlbb capabilities: true

━━━ STEP 2: Roster stats ━━━
  ✓ Pro teams: ONIC, RRQ, EVOS, Alter Ego, Aura Fire
  ✓ Players per team: 5, 5, 5, 5, 5 (perfectly even)
  ✓ Average ratings: mechanics=4.52, game-sense=4.44, hero-pool=4.48, teamwork=4.28

━━━ STEP 3: Tournament creation ━━━
  ✓ Tournament: "MPL ID S17 · Week 1"
  ✓ Format: single-elim, Series: Bo3

━━━ STEP 4: Player selection (ONIC vs RRQ) ━━━
  ✓ ONIC (5): Kairi, CW, Butsss, Kiboy, Drian
  ✓ RRQ  (5):  Cr1te, Lemon, Albert, Vyn, R7

━━━ STEP 5: Run fair split solver ━━━
  ✓ Pool size: 10
  ✓ Generated 2 teams, gap: 0.050
  Team A · avg strength 4.50: all 5 roles covered
  Team B · avg strength 4.45: all 5 roles covered

━━━ STEP 6: Role coverage ━━━
  Team A: 5/5 roles covered
  Team B: 5/5 roles covered

━━━ STEP 7: Round-trip the backup ━━━
  ✓ Re-export integrity: PASS

━━━ STEP 8: Flags check ━━━
  ✓ No solver flags — teams are valid

ALL CHECKS PASSED
```

**Interpretation of the result:** the solver split 10 highly-rated pro players (all attributes ≥ 4) into two teams of 5, with a strength gap of **0.050** (about 1.1% — practically perfect), and successfully assigned every required MLBB role (tank, assassin, mage, marksman, fighter) to both teams. No `role-uncovered` flags. The round-trip export/import preserved the player count.

---

## 5. Risks and what I'd watch

1. **Import → existing players with conflicting `communityId` are still adopted into the active community** at runtime (the legacy `useEffect` in `App.tsx`). The new merge path **does not** do this — it only adds new ids. This is intentional (don't move existing data) but worth documenting.
2. **The "least example data" sample has no `tournaments` field** — that's fine, the importer treats an absent field as `[]`. But if the sample is ever updated with tournaments, the importer will pick them up too.
3. **Strength model is `kind: "mean"`** for both built-in disciplines. A `weighted` or `geometric` model would change the split outcome. Not a v1 concern.
4. **`split` does not currently save a `Session` when called from a tournament** — there's a `if (!setup.tournamentId)` guard. So a `Session` is recorded for ad-hoc splits, not tournament splits. Tournament splits are persisted as `Match` records inside the tournament. This is correct but easy to miss.

---

## 6. Files changed in this pass

- `src/App.tsx`
  - `handleImport`: now a **merge** (id-diff + confirm prompt), not a destructive replace
  - `handlePlayerImport`: now handles JSON (full backup or players-only) and CSV
  - Topbar: added `Import` button (full backup), `squad-switcher` pill (moved community selector here)
  - Roster toolbar: removed the duplicate community selector; now just `+ New Squad` and `Delete Squad`
  - Renamed `+ New Community` → `+ New Squad` to match the topbar label

- `src/index.css`
  - Added `.squad-switcher` and `.squad-select` styles
  - Inherited kicker style (red ▸) for the `SQUAD` label

- `docs/BUSINESS_FLOW_REVIEW.md` (this file)
