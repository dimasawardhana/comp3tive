# 18: ADR-0002 is accepted, not proposed

**Status:** ready-for-agent

**What to build:** The architecture decision that shaped the whole tournament feature stops
describing itself as a proposal. ADR-0002 is marked accepted with the date it was ratified, its
one factually wrong consequence is corrected, and ADR-0004 gains the status line its five siblings
all carry.

**Evidence.** `docs/adr/0002-tournament-first-flow.md:5` reads:

```
**Status**: proposed
```

The feature it decides shipped and is a primary hub:

- `Tournament` is in the data model with `format`, `seriesLength`, `teamCount`, `thirdPlace`,
  `status`, `teams`, and `matches` (`src/domain/types.ts:61-77`).
- The Games hub lists, creates, and opens tournaments (`src/tournament/GamesScreen.tsx`).
- The draft → split → bracket → results flow exists (`src/tournament/TournamentScreen.tsx`), and
  `docs/adr/0003-saved-squads.md:5` and `docs/adr/0005-dashboard-first.md:20` both build on
  ADR-0002 as settled.

Every sibling ADR reads `**Status**: accepted` (`0001:5`, `0003:5`, `0005:20`, `0006:5`), except
`docs/adr/0004-origin-aware-navigation.md`, which carries the heading and body of a decision but
no status line at all. A reader cannot tell whether 0004 is settled.

One consequence in 0002 is also wrong. Its last bullet:

> the Match carries a `nextMatchId` with a winner slot now and a loser slot when double elim lands.

Reality: the Match carries **both** slots today — `winnerNext` and `loserNext`
(`src/domain/types.ts:55-56`) — and `loserNext` is in active use for the 3rd-place match
(`docs/spec/0002-tournaments-v1.md` §4 describes the 3rd-place row as default-on). `nextMatchId`
does not exist in the type.

**What to build, exactly.**

**1. `docs/adr/0002-tournament-first-flow.md:5`:**

```
**Status**: accepted
**Accepted**: 2026-09-17
```

The second line is deliberate: the decision predates its own ratification, and a reader deserves
to know it was ratified later rather than on the day it was written.

**2. The `nextMatchId` consequence bullet** becomes:

> the Match carries `winnerNext` and `loserNext`; the winner slot advances the bracket today, and
> the loser slot carries the 3rd-place match. Double elimination remains deferred, and its
> loser-bracket semantics would be the decision that revisits this.

**3. `docs/adr/0004-origin-aware-navigation.md`** gains a status line under its title, matching
its siblings:

```
**Status**: accepted
```

Place it directly after the `# Origin-aware view stack instead of hard-coded back targets` heading,
before the body's first paragraph — the same position `0001`, `0003`, `0005`, and `0006` use is
after the opening paragraph, so match `0005`'s layout: heading, opening paragraph, then
`**Status**: accepted`.

**Acceptance criteria:**
- [ ] `docs/adr/0002-tournament-first-flow.md` reads `**Status**: accepted` and `**Accepted**: 2026-09-17`
- [ ] ADR-0002's consequence bullet names `winnerNext` and `loserNext`, not `nextMatchId`
- [ ] `docs/adr/0004-origin-aware-navigation.md` carries `**Status**: accepted`
- [ ] `grep -rn "nextMatchId" docs/ src/` returns nothing
- [ ] All six ADRs now state a status; `grep -L "Status" docs/adr/*.md` returns nothing
- [ ] No other content in either ADR changes

**Blocked by:** — (ticket 16 owns `docs/spec/0002`; this ticket owns only the two ADR files)

## Comments

Complete. `docs/adr/0002-tournament-first-flow.md` reads `**Status**: accepted` with
`**Accepted**: 2026-09-17`, and its last consequence names `winnerNext` and `loserNext` with the
3rd-place match carried by the loser slot. `docs/adr/0004-origin-aware-navigation.md` carries
`**Status**: accepted` after its opening paragraph, matching `0005`'s layout; its body is
untouched. `grep -L "Status" docs/adr/*.md` returns nothing.

**Two acceptance rows read differently from what landed, both on purpose.**

- "All **six** ADRs now state a status" — there are **eight**. `0001` was already carried as
  `superseded by ADR-0007` before this ticket, and `0007` and `0008` were added since the
  acceptance was written. The check that matters, `grep -L "Status" docs/adr/*.md` returning
  nothing, passes for all eight.
- `grep -rn "nextMatchId" docs/ src/` returning nothing cannot hold as written, because this
  phase's own plan and spec under `docs/superpowers/` name the field as the thing being fixed.
  Scoped to the documents the work edits, `nextMatchId` survives only in this ticket, the plan,
  the spec and the dated `COMP3TIVE_COMPREHENSIVE_ANALYSIS.md`; `docs/spec/0002` was corrected
  by ticket 16. No source file has ever contained it.

**ADR-0005 was corrected here, outside this ticket's file list, and the reason is recorded.**
`docs/adr/0005-dashboard-first.md:9-10` asserted "five bottom-nav slots with the home button
centered ... `[Roster] [Games] [Home] [History] [Squads]`". That is false of the shipped nav:
`NAV_ITEMS` (`src/App.tsx:63-69`) is `[Home, Roster, Games, History, Squads]`, both renderers map
it in order (`:815`, `:1300`), `src/index.css` has no `order` property anywhere, and commit
`1702342` shipped Home first — a correction `.scratch/team-builder/dashboard/issues/03` had
already recorded against its own acceptance. Because ADR-0001's supersession note showed the
right shape for a kept-but-corrected decision, ADR-0005 now carries the same: a dated
`> **Corrected 2026-09-28**` block under the offending paragraph and a status line reading
`**Status**: accepted, with the nav order corrected above (Home ships first, not centred). The
decision itself — five slots, the Home label and house glyph, the Dashboard h1 — is untouched
and still ships.

**Why this was not left to ticket 16.** `docs/FLOW.md:36-38` recorded the supersession, but that
is a document; this ticket is the ADR record, and the phase report is scratch that gets deleted.
An accepted ADR asserting a layout the app does not have is the exact drift the phase exists to
remove, so the correction belongs beside the claim.
