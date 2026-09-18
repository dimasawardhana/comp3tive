# 16: Reconcile the documents that contradict the code

**Status:** ready-for-agent

**What to build:** Every document a human or an agent reads states what the shipped app actually
does. `docs/FLOW.md` is the worst offender because it calls itself "the contract"; `docs/spec/0002`
carries a wrong schema version and a wrong field name; and two root planning documents describe
work that has already shipped.

**Evidence.** Absorbed from `.scratch/app-correctness/issues/06` and re-verified:

| Document | Claim | Reality |
|---|---|---|
| `docs/FLOW.md:1` | title "(**as-to-be**)" | the app is built; `:4` already says "Accepted — this document is the contract" |
| `docs/FLOW.md:26` | "**Four** bottom-nav hubs" (Roster/Tournaments/History/Squads) | five with **Home** centred; the tournaments hub is labelled **Games** (`NAV_ITEMS`, `src/App.tsx:62-68`) |
| `docs/FLOW.md:74` | "Breadcrumbs are links — every crumb above the current screen navigates there" | no screen renders `Breadcrumb` (`src/nav.tsx`, zero consumers); `src/session/SplitScreen.tsx:294` is a dead `<a href="#" onClick={preventDefault}>` |
| `docs/spec/0002-tournaments-v1.md:63` | "DB **v5**", "Backup **v3** adds `tournaments[]`" | `DB_VERSION = 6` (`src/storage/indexed-db.ts:18`); backup `version: 4` (`src/data/transfer.ts:9`) |
| `docs/spec/0002-tournaments-v1.md:48` | `players: [{playerId, roleId}]` — roles snapshotted | `TournamentTeam.players: Id[]` (`src/domain/types.ts:36`) |
| `docs/spec/0002-tournaments-v1.md:54` | `nextMatchId?` | `winnerNext`/`loserNext` (`src/domain/types.ts:55-56`) |
| `docs/spec/0002-tournaments-v1.md:52` | `seriesLength` on each **match** | `seriesLength` is tournament-level (`src/domain/types.ts:67`) |
| `docs/spec/0002-tournaments-v1.md:31` | Games tab "between History and Disciplines" | five slots are Roster, Games, Home, History, Squads; Disciplines is reached from Games' own button (`src/tournament/GamesScreen.tsx:134`) |
| `docs/adr/0002-tournament-first-flow.md:5` | "**Status**: proposed" | shipped and a primary hub — **B18 owns this file** |
| `docs/adr/0004-origin-aware-navigation.md` | no status line | its five siblings all carry one — **B18 owns this file** |
| `docs/superpowers/plans/2026-09-10-paper-pencil-redesign.md:9` | "Tech Stack: TypeScript, React, **Tailwind CSS**, Vite, Vitest" | `grep -rn "tailwind" src/ package.json` → no matches |
| `docs/spec/0001-team-builder-v1.md:94` | "only Futsal and MLBB ship in v1" | false after B19 ships badminton — **B19 owns this line** |

Root documents, measured:

```
COMP3TIVE_COMPREHENSIVE_ANALYSIS.md   1463 lines  (the source of the app-health tickets)
DOMAIN_MODEL.md                        289 lines  describes a model that shipped
IMPLEMENTATION_PLAN.md                 234 lines  "Critical Gaps Identified" — all closed
DESIGN.md                              202 lines  the surviving direction (B17)
docs/design.md                          98 lines  the competing direction (B17 deletes it)
```

`IMPLEMENTATION_PLAN.md`'s "Critical Gaps" are all closed: its Phase 1 asks to "Define Session
entity structure", and `Session` is in `src/domain/types.ts:166` with its own hook
(`src/session/useSessions.ts`) and screen.

**What to build, exactly.**

**1. `docs/FLOW.md`** — keep its shape, correct the facts.

- `:1` → `# comp3tive · Page Flow` (drop "(as-to-be)"). Its own `:4` already declares it accepted.
- `:26` and the table at `:28-34` → "Five bottom-nav hubs", with these rows, in nav order:

  | # | Tab | Owns |
  |---|---|---|
  | 1 | **Roster** | players + capabilities; add/import/export; **Disciplines**; the ad-hoc **"Split match"** entry |
  | 2 | **Games** | tournaments: list, create, draft, bracket, results |
  | 3 | **Home** | the Dashboard: active-community state and next actions (ADR-0005) |
  | 4 | **History** | past ad-hoc splits (Sessions): view, re-roll, save as squad, delete |
  | 5 | **Squads** | saved squads: view, re-split, delete, feed a tournament |

  Source: `src/App.tsx:62-68`; Home is the centred slot (ADR-0005).
- `:74` → "Breadcrumbs are labels, not links: every crumb above the current screen names where you
  came from, and Back is the control that returns there (ADR-0004)." Add a forward note that
  Phase C28 wires the shared `Breadcrumb` in, and that this sentence is the one to revisit when it
  does.
- `:11` (P1) → "Every non-hub screen shows its path", and "breadcrumb of active links" becomes
  "breadcrumb of the path taken".
- The `§3` heading at `:72` → `## 3. Path table (P1)`, with its intro sentence matching `:74`.
- `:175` → "in-app Back covers navigation; breadcrumbs name the path".
- `:20-23` (Entry) is already correct post-ADR-0006 and stays.

**2. `docs/spec/0002-tournaments-v1.md`** — the Data Model block and persistence line.

- `:63` → "DB **v6**" and "Backup **v4** adds `tournaments[]` and `savedSquads[]`; v1–v3 imports
  migrate with empty lists".
- `:48` → `teams: [{ id, bibIndex, name, players: Id[], strength }]` with the comment
  `// player ids at submission; roles are not snapshotted`. Add the missing tournament-level
  `thirdPlace: boolean` (`src/domain/types.ts:70`).
- `:54` → `winnerNext: { matchId, slot } | null` and `loserNext: { matchId, slot } | null`, with
  the comment updated: the winner slot advances the bracket, the loser slot carries the 3rd-place
  match.
- `:52` → delete `seriesLength` from the match object; note that a match inherits the
  tournament's.
- `:26-31` → the parenthetical "between History and Disciplines" becomes "between Home and
  History", and the Disciplines entry is described as reached from the Games hub's Disciplines
  button (`src/tournament/GamesScreen.tsx:134`).
- Add `**Status**: shipped (DB v6, backup v4)` under the title, so a reader knows it describes the
  build rather than a plan.

**3. Root documents — dispositions (require owner confirmation before running).**

| File | Disposition | Reason |
|---|---|---|
| `DOMAIN_MODEL.md` (289) | **Move to `docs/archive/DOMAIN_MODEL.md`** | duplicates `CONTEXT.md`, which is the live glossary the agent docs point at (`docs/agents/domain.md`) |
| `IMPLEMENTATION_PLAN.md` (234) | **Move to `docs/archive/IMPLEMENTATION_PLAN.md`** | its four phases all describe shipped behaviour |
| `COMP3TIVE_COMPREHENSIVE_ANALYSIS.md` (1463) | **Keep in place, unchanged** | it is dated ("Generated: 2026-09-11") and is the provenance for the app-health tickets |
| `CONTEXT.md` | Keep, unmodified | the live vocabulary |
| `PRODUCT.md` | Keep, unmodified | the current brief |
| `DESIGN.md` | Keep | B17's survivor |

Both moved files get this banner directly under the `# ` title:

```
> **Superseded 2026-09-17.** This document describes work that has shipped. The live
> vocabulary is `CONTEXT.md`; the current flow contract is `docs/FLOW.md`. Kept for history.
```

**These files were authored by the repo owner. Confirm the two moves before running them.** No
file is deleted by this ticket. `docs/design.md` is B17's to delete, not this ticket's.

**4. `docs/superpowers/plans/2026-09-10-paper-pencil-redesign.md:9`** — the Tailwind claim:

```
**Tech Stack:** TypeScript, React, Vite, Vitest, hand-written CSS custom properties —
no new dependencies required.
```

**5. `docs/agents/*` — verified clean, no edit.** `docs/agents/domain.md` points at `CONTEXT.md`
and `docs/adr/`, both of which survive. It names `CONTEXT-MAP.md` and `src/<context>/docs/adr/`
as optional and instructs the reader to proceed silently when absent, which is the case here.

**Absorbed ticket correction.** `app-correctness/06`'s table row for `docs/FLOW.md` §3 P1 and the
`docs/spec/0002` rows are accurate and are carried above verbatim. Its "Related" list is wider than
this ticket: it also asks for `docs/adr/0004`'s "FLOW.md is the contract and the edge table must
stay in sync" sentence to be revisited. That sentence is still true once `docs/FLOW.md` is
corrected — ADR-0004 genuinely does designate FLOW.md as the contract — so no edit is made and
this ticket records the reasoning rather than silently dropping the row.

**Acceptance criteria:**
- [ ] `docs/FLOW.md` says five hubs, lists Home, and has no "(as-to-be)" in its title
- [ ] `docs/FLOW.md` §3 says breadcrumbs are labels and Back is the control
- [ ] `docs/spec/0002` says DB v6 and backup v4, and its Data Model matches `src/domain/types.ts` (`players: Id[]`, `thirdPlace`, `winnerNext`/`loserNext`, tournament-level `seriesLength`)
- [ ] `docs/spec/0001` no longer says only two disciplines ship (with B19)
- [ ] The Tailwind claim is gone from the paper-pencil plan
- [ ] `DOMAIN_MODEL.md` and `IMPLEMENTATION_PLAN.md` each carry the superseded banner and live under `docs/archive/` — or the owner has declined, which is recorded in `## Comments`
- [ ] `grep -rn "as-to-be\|Four bottom-nav\|DB v5\|Backup v3\|nextMatchId" docs/ *.md` returns nothing
- [ ] `docs/agents/domain.md` is verified unchanged and still points at live files

**Blocked by:** — (the `docs/spec/0001` line depends on 19; every other edit is independent)

**Not in scope:** `docs/adr/0002` and `docs/adr/0004` belong to ticket 18; `docs/design.md` belongs
to ticket 17.
