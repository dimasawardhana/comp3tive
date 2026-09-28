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

## Comments

**Document edits landed.** `docs/FLOW.md` is retitled, says five hubs with a five-row table in
the shipped `NAV_ITEMS` order, and names the tournaments hub **Games** at all eleven occurrences
(`:32`, `:48`, `:85`, `:87`, `:90`, `:129`, `:146`, `:147`, `:162`, `:176`, `:188`) — `grep -n
"Tournaments" docs/FLOW.md` returns nothing, and the lowercase container noun survives (20
occurrences). `docs/spec/0002-tournaments-v1.md` carries a status line, DB **v7**, backup v4, a
Data Model matching `src/domain/types.ts` (`players: Id[]`, tournament-level `seriesLength`,
`winnerNext`/`loserNext`, tournament-level `thirdPlace`), and the Games tab's real neighbours.
`docs/superpowers/plans/2026-09-10-paper-pencil-redesign.md:9` no longer claims Tailwind.

**Three corrections this ticket's evidence table did not anticipate.**

1. **DB v6 → v7, not v5 → v6.** The evidence row cites `DB_VERSION = 6`
   (`src/storage/indexed-db.ts:18`); the shipped constant is `7` (`:19`), bumped by the
   badminton seed backfill. The spec was corrected to v7, not to the v6 the ticket assumed.
2. **The hub is not centred.** The ticket and the plan both say "five hubs with **Home**
   centred". `NAV_ITEMS` (`src/App.tsx:63-69`) is `[Home, Roster, Games, History, Squads]` and
   both the rail (`:815`) and the bottom bar (`:1300`) render that array in order, with no CSS
   `order` anywhere in `src/index.css`. Commit `1702342` shipped Home **first**;
   `.scratch/team-builder/dashboard/issues/03` already records "the centering claim is
   superseded". `docs/FLOW.md` §1 is therefore written in the shipped order and says so. The
   Games tab's neighbours are **Roster and History**, not "Home and History".
3. **The Games empty state is quoted wrong in the spec.** It read
   `"No games yet. Create a tournament and split your teams."`; the screen renders
   `"No games yet"` / `"Run a competition"` / `"Create a tournament, set the format, and split
   your teams inside it."` (`src/tournament/GamesScreen.tsx:138-145`). Corrected, because the
   alternative was to re-land a quote the code does not produce.

**`DOMAIN_MODEL.md` moved; `IMPLEMENTATION_PLAN.md` did not.** `docs/archive/DOMAIN_MODEL.md`
carries the superseded banner (292 lines: 289 plus the banner and its separating blank).
`IMPLEMENTATION_PLAN.md` **stays at the repo root, unmodified.** It is not the frozen 2026-09-17
artifact this ticket's table describes: it was rewritten on 2026-09-28 as the live current-state
index of the whole five-phase programme and now carries the known-open items table, so a
"superseded, describes work that has shipped" banner would be false of it. Recording the
decision here rather than in the file.

**Owner confirmation.** This ticket requires it for the two moves, and none was recorded in a
`## Comments` section before the task ran — the ticket had none. `DOMAIN_MODEL.md` was moved on
the phase owner's explicit ruling to archive that file alone; it is a move, not a deletion, and
no content was lost. `IMPLEMENTATION_PLAN.md` and `COMP3TIVE_COMPREHENSIVE_ANALYSIS.md` were not
touched. If a recorded owner answer is required for the record, it is still outstanding.

**`COMP3TIVE_COMPREHENSIVE_ANALYSIS.md` deliberately unedited, per this ticket's disposition.**
It still names `DOMAIN_MODEL.md` and `IMPLEMENTATION_PLAN.md` in its root-filesystem tree
(`:132-133`, `:1391`) and its drift tables (`:1248`, `:1250`, `:1251`), which is the point of
keeping a dated snapshot. Two of its statements are nevertheless now stale rather than merely
historical: `:365` and `:1247` say "the current code is v6/v4" (it is v7/v4), and `:1245` says
"Five hubs with Home centered" (Home is first). Flagged, not edited — the file is dated evidence
and this ticket's table keeps it unchanged.

**Breadcrumb rule left normative.** `:10` (P1) and `:77` ("Breadcrumbs are links") are
unchanged. Two of the three hand-rolled crumb sites already navigate
(`src/session/MatchScreen.tsx:41-45`, `src/tournament/TournamentScreen.tsx:263-269`); only
`src/session/SplitScreen.tsx`'s is dead. §3 now carries a forward note naming that site and
ticket 28, plus a sentence recording that every screen renders two segments, not the full chain.
No follow-up edit is owed to either line.

**Acceptance rows that are now stale, left as written.** "`docs/FLOW.md` §3 says breadcrumbs are
labels and Back is the control" is **not** what landed, on purpose: that statement is false in
the opposite direction. See the breadcrumb note above.

**`docs/spec/0001-team-builder-v1.md:94`** already reads "the catalog is extensible, but only
Futsal, MLBB and Badminton ship in v1" — corrected by ticket 19 in an earlier commit. Verified,
left alone.

**`docs/agents/*` verified unchanged**; `docs/agents/domain.md` points at `CONTEXT.md` and
`docs/adr/`, both of which survive.

### Review round 1 — prescribed sentences that were false of the shipped build

The first pass followed the plan's wording wherever the wording was not itself wrong. It was
wrong in four places, and holding "the brief said so" alongside "it is true of the code" is what
found them. All four are corrected; the corrections are in the next commit.

**1. `docs/FLOW.md` claimed a crumb string no screen renders.** The first pass wrote that "a
tournament split shows `Games / Split result`". It does not. `SplitScreen`'s crumb block
(`src/session/SplitScreen.tsx:316-320`) hardcodes `Match setup / Split result` whatever the
source, so the sentence also contradicted its own rule one clause earlier — the last two
segments of `Games / {name} / Match setup / Split result` *are* `Match setup / Split result`.
Now: the three crumb sites and their exact separators are named (`:43`, `:318`, `:266`), the two
leaves that render no breadcrumb are named, and the "Ticket 28 keeps the rendered depth at two"
attribution is dropped, since ticket 28 says nothing about depth.

**2. The Disciplines leaf was documented as a Roster child, and it is a Games one.** The file
claimed Roster at five places (`:31`, `:50`, `:92`, `:106`, `:171`) while the previous commit's
own new line in `docs/spec/0002:33` said Games — the file contradicted itself and one of the two
contradicted the code. The only entry point is the Games hub's toolbar button
(`src/tournament/GamesScreen.tsx:134-136` → `src/App.tsx:1175`); the Roster hub has no
Disciplines control and `showDisciplines` (`src/App.tsx:695-697`) has no caller. `docs/FLOW.md`
was the wrong one. All five sites corrected, and the Disciplines leaf's back target is now
stated as the literal `Back` button it renders rather than a `Back / breadcrumb` row.

**3. `COMP3TIVE_COMPREHENSIVE_ANALYSIS.md` gained one line and nothing else.** A dated
snapshot note under the title, saying the findings are as-of 2026-09-11 and that several have
since been fixed. This resolves the tension the previous pass recorded: the file is kept
unchanged *as evidence*, and a reader can no longer mistake `:365`, `:1245` and `:1247` for
live claims. Its body is untouched.

**4. `docs/spec/0002:67` said backup v4 "adds" `tournaments[]`.** v3 added tournaments
(`src/data/transfer.ts:6`); v4 carries both. Now "carries", with the v3 and v4 attributions
stated.

**Path drift this move created, in a later phase's plan.** `docs/superpowers/plans/2026-09-17-shell-and-structure.md`
tests `-e DOMAIN_MODEL.md` in its smoke loop, which would have printed `MISSING PATH` during
Phase C. Corrected to `docs/archive/DOMAIN_MODEL.md` in the loop (`:2997`) and in the knowledge
table (`:2977`, which also said "Six numbered decisions" for `docs/adr/`; there are eight).
Recorded here because the phase's own file list is otherwise silently wrong: `DOMAIN_MODEL.md`
no longer exists at the root.

**Also fixed, in documents this phase already touched.** `docs/FLOW.md` gained a `**Reconciled:**`
date (`:4`); the §4 edge table gained the `### Home (hub)` table its heading's "complete" was
promising, built from `DashboardScreen`'s real actions, so the two player-modal entries record
the `gotoHub("roster")` hop the handlers actually make; the History and Squads empty states now
quote their shipped copy, matching the standard the Games row was held to in the previous
commit. And the dead-crumb note's reasoning was wrong: the first pass said the crumb is dead
"because a `session` or `squad` split has no match-setup screen beneath it", which the code does
not support — `SplitScreen` takes `onBack`, `src/App.tsx:1228` passes it, and a working `← Back`
button renders at `:397-399`. The defect is the crumb, not a missing affordance, and the note now
says that with the cites corrected (`:316-320` for the block; the old `:293-297` was stale).
