# Honest Claims — 2026-09-17

**Status:** ready-for-agent

Phase B of the comp3tive debt-repayment roadmap (tickets 13–20). Every phase-B ticket is
`.scratch/debt/issues/NN-*.md` with `Status: ready-for-agent`.

## Problem Statement

comp3tive's unfairness is not in its solver. It is in what the product says about the solver,
and about itself. Measured on 2026-09-17 (audit `d87ac7b`; re-measured for this spec):

**The proof does not reach the sizes tournaments use.** `SplitResult.solver` already carries
`{ optimal, nodesExplored, elapsedMs }` (`src/domain/types.ts:157`), and `optimal` is
`!aborted` (`src/solver/solver.ts:685`) — false only when the search exhausts
`NODE_BUDGET = 4_000_000` (`src/solver/solver.ts:21`). Measured:

| Pool | `optimal` | nodes | time | gap |
|---|---|---|---|---|
| futsal 20 / 2, mlbb 25 / 2 | true | ≤ 443 | ≤ 1 ms | 0.000 |
| landing hero (mlbb 10 / 2) | true | 51 | 7 ms | 0.10 |
| futsal, 20 players, 4 teams | **false** | 4,000,001 | 1,974 ms | 0.020 |
| futsal, 30 / 6 | **false** | 4,000,001 | 695 ms | 0.020 |
| MLBB, 25 / 5 (the shipped sample) | **false** | 4,000,001 | 755 ms | 0.320 |
| MLBB, 25 / 5 re-measured here | **false** | 4,000,001 | — | 0.350 |

`optimal` is referenced in exactly one place in the whole codebase: `src/solver/solver.test.ts`.
No `.tsx` file reads it. The split screen renders a proven-minimum result and a best-found
heuristic identically (`src/session/SplitScreen.tsx:135`, and the same copy again at `:334`):

```
Gap {gap.toFixed(1)}. <span className="fine">{leader ? teamName(leader.index) : "?"} leads.</span>
```

**The landing page sells four things that are not true.** `index.html:181` promises "The gap
is the **proven minimum** for your pool, not a heuristic" — false for 4+ teams, which is what
tournaments need. `index.html:182` promises "**Works with no signal**. The court has no wifi" —
`grep -rn "serviceWorker\|manifest.json\|workbox" src/ index.html app/index.html` returns no
matches, `public/` holds only `404.html`/`_headers`/`comp3tive.svg`, and fonts load from
`fonts.googleapis.com` (`index.html:25-29`, `app/index.html:8-11`). `index.html:72-73` promises
"the smallest strength gap that exists for that pool — **exact, not estimated**" and advertises
"Futsal, MLBB, **badminton**" while `SEED_DISCIPLINES = [FUTSAL_DISCIPLINE, MLBB_DISCIPLINE]`
(`src/domain/seed.ts:52`) — badminton is not a discipline you can pick.
`src/landing.tsx:111-115` shows a badminton card advertising roles `Singles`/`Doubles` and
`1v1 or 2v2`.

One landing claim does hold and must be preserved: the hero renders live solver output over a
real roster, and the advertised `GAP 0.10` is genuinely optimal. Verified by hand and by probe:
strengths are `4.25×1, 4.0×4, 3.25×5` (sum 36.5), no 5-subset sums to 18.25, so the best
achievable split is 18.0/18.5 → gap 0.1. The probe confirms `optimal: true`, `nodesExplored: 51`,
`gap: 0.10000000000000009` → `toFixed(2)` = `0.10`.

**The group has two names.** The UI asks for a "new community" (`src/App.tsx:884`, `:931`;
`getByTitle("New community")` in six spec files) while the switcher is labelled
"**SQUAD ▾**" and `CONTEXT.md` bans "squad" for the group, reserving it for Saved Squad
(`CONTEXT.md`, Team: "_Avoid_: squad"; Saved Squad: "The word 'squad' is reserved for this
artifact"). Current state, measured: the switcher's visible kicker is already "Community"
(`src/App.tsx:821`) and `BUSINESS_FLOW_REVIEW.md:166` records renaming `+ New Community` →
`+ New Squad`, but `src/App.tsx:1061` still reads "No players in this **squad**" and `:1123`
"**Split the squad**", `src/session/MatchScreen.tsx:48` reads "then the **squad**", and
`src/session/SplitScreen.tsx:304`/`:400` render "Tournament **squad**" / "Save tournament
**squad** →" — "squad" still names both the group and a tournament's team set.

**Seven documents contradict the code.** Verbatim from the audit table and re-verified here:

| Document | Claim | Reality |
|---|---|---|
| `docs/FLOW.md:1` | title "(**as-to-be**)" | the app is built |
| `docs/FLOW.md:26` | "**Four** bottom-nav hubs" | five with Home centred; the tournaments hub is labelled **Games** (`src/App.tsx:62-68`) |
| `docs/FLOW.md:74` | "Breadcrumbs are links" | no screen renders `Breadcrumb` (`src/nav.tsx`, zero consumers); `src/session/SplitScreen.tsx:294` is a dead `<a href="#">` |
| `docs/spec/0002-tournaments-v1.md:63` | "DB **v5** … Backup **v3**" | `DB_VERSION = 6` (`src/storage/indexed-db.ts:18`), backup `version: 4` (`src/data/transfer.ts:9`) |
| `docs/spec/0002-tournaments-v1.md:48` | `players: [{playerId, roleId}]` | `TournamentTeam.players: Id[]` (`src/domain/types.ts:36`) |
| `docs/spec/0002-tournaments-v1.md:54` | `nextMatchId` | `winnerNext`/`loserNext` (`src/domain/types.ts:55-56`) |
| `docs/adr/0002-tournament-first-flow.md:5` | "**Status**: proposed" | shipped and a primary hub |
| `docs/design.md:3` | "**Scoreboard**", cobalt accent | `DESIGN.md:3` says "**Paper & Pencil**", amber `#C2410C` |

The shipped CSS is Paper & Pencil: `src/tokens.css` declares `--accent: #c2410c` and
`--surface: #faf8f5`, and `grep -rn "2B6BFF\|Chakra\|cobalt" src/ index.html app/index.html public/`
returns no matches, so `docs/design.md`'s entire token set and type stack (Chakra Petch, cobalt)
appear nowhere in the build. The paper-pencil plan also claims a Tailwind stack
(`docs/superpowers/plans/2026-09-10-paper-pencil-redesign.md:9`); there is no Tailwind anywhere.

**The demo data does not match the stated audience.** `PRODUCT.md` names "Futsal night
organizers … MLBB squad captains". Both shipped samples are 25 Indonesian esports
professionals: `sample-data/*.json` carry `ONIC · Jungle`, `RRQ · Mid`, `EVOS · Gold`,
`Aura Fire · EXP`, `Alter Ego · Roam`, and the *futsal* sample reuses the same pro names —
`Kairi` is a goalkeeper, `Faker`'s absence aside, `Lemon` is a winger. Measured with the
repo's own validator (`src/domain/validation.ts`): the futsal sample has **7 of 25 players
failing `validatePlayer`** — every one for "Preferred role "X" must be inside the eligibility
list" (`cw`, `cr1te`, `wannn`, `oura`, `luminaire`, `nino`, `blustine`) — and its role spread is
unusable (`goalkeeper` eligible for all 25, `defender` for all 25, `winger` for 11, `pivot` for
0), so a 5-team futsal split emits 8 `role-uncovered` flags on the shipped sample.

## Scope

**In scope.** Making every claim the product makes about itself true:

- B13 — the split screen states whether its gap was proven minimal or is the best found.
- B14 — the landing page claims only what ships; every claim mapped to true/removed/restored.
- B15 — one noun for the group everywhere in the UI: **Community** (D2).
- B16 — the documents that contradict the code are reconciled; stale root docs are dispositioned.
- B17 — the two competing design directions are resolved to one.
- B18 — ADR-0002's status reflects reality.
- B19 — badminton either ships as a real discipline or is removed from the landing page.
- B20 — the shipped sample data matches the stated audience.

**Out of scope (explicit).**

- **The solver.** D1 is honest-now: the engine is not changed, not tuned, and not extended.
  Extending proof reach to 4-team pools is a deferred stretch bet with a recorded baseline
  (20 players / 4 teams: 4,000,000 nodes, ~3.1 s, `optimal: false`). No ticket here touches
  `NODE_BUDGET`, the pruning bound, or the search order.
- **The PWA.** A manifest, a service worker, and self-hosted fonts are D02's ticket. B14
  removes the offline claim; D02 restores it. This sequencing is frozen in `contracts.md`.
- **Landing Page visual redesign.** The Ledger composition is settled and its specs pass 16/16.
  B14 changes what the page *claims*, not how it looks.
- **A backend, multi-user, sync, accounts, ESLint, a formatter.** All out of scope per the
  roadmap.
- **Phase A's fixes and Phase C's decomposition.** B may not restructure `src/App.tsx`
  (C's job) and may not fix re-roll or deletes (A's job).

## Design

### B13 — The split says whether its gap is proven

**New module: `src/session/gapProvenance.ts`.** One source of truth, importable by Phase D's
share text so the chat message and the screen cannot disagree.

```ts
import type { SplitResult } from "../domain/types";

export type GapKind = "proven" | "best-found";

/** "proven" iff the search that produced these teams ran to completion. */
export function gapKind(result: SplitResult): GapKind;

/** The screen's qualifier, or null when the gap is proven (nothing to qualify). */
export function gapQualifier(result: SplitResult): string | null;
```

`gapKind` returns `"proven"` **iff** `result.solver.optimal === true`, and `"best-found"`
otherwise. It reads the field and nothing else: not the source, not a re-roll counter, not
`nodesExplored`.

That is the only rule that is true on every path. `varietySplit` sets `optimal: false`
(`src/solver/solver.ts:419`), so a re-roll normally reads best-found — but `varietySplit`
delegates to `fairSplit` when it finds no candidate (`src/solver/solver.ts:409`), and that
fallback really is the exact optimum. "Proven iff optimal" is true in both cases; "re-rolls are
never proven" is not. This is the invariant Phase A03 confirmed it will not violate (A03 changes
`reroll` only and never writes `result.solver`).

**Exact copy — on the screen.** The qualifier appends to the existing readout at both render
sites. There are two, and both must change: `src/session/SplitScreen.tsx:135` (inside
`GapMeter`, the 2-team pitch layout) and `:334` (the 3+ team stack).

Proven case (`optimal: true`) — unchanged strings, because a proven result must not be hedged:

```
Dead even. Fair game.                    ← when gap <= 0.1 (balanced)
Gap 0.1. Team A leads.                   ← otherwise
```

Best-found case (`optimal: false`):

```
Dead even. Best gap found.               ← when gap <= 0.1 (balanced)
Gap 0.3. Team A leads. Best gap found.   ← otherwise
```

The exact JSX for the unproven, non-balanced case, at both sites:

```tsx
Gap {gap.toFixed(1)}.{" "}
<span className="fine">
  {leader ? teamName(leader.index) : "?"} leads{gapQualifier(result) ? ` ${gapQualifier(result)}` : ""}.
</span>
```

Because `gapQualifier` returns `null` when proven, the proven path emits byte-identical markup
to today — no regression for the small pools where the claim is strong. The balanced branch
becomes:

```tsx
{balanced ? (
  <>Dead even. <span className="fine">{gapQualifier(result) ?? "Fair game."}</span></>
) : ( … )}
```

**Voice.** `DESIGN.md` sets the register: "Plain verbs." `PRODUCT.md`: "No marketing-speak, no
friendly chatter." The qualifier is five words of plain English. It contains no jargon — not
"aborted", not "node budget", not "search", not "heuristic", not "exhaustive". "Best gap found"
states what happened (the search ended and this was the best it found) without accusing the
engine of failure. `docs/design.md:72` bans em-dashes in visible copy; the qualifier uses none.

**Both layouts.** `GapMeter` is rendered only in the 2-team branch (`:330`); the 3+ branch
renders its own `.readout` (`:334-345`). The 1-team/0-team branch renders an `.empty` state with
no gap, so it needs no qualifier. `gapQualifier` is called in both live branches.

**Styling.** No new CSS. The qualifier rides inside the existing `<span className="fine">`,
styled at `src/index.css:2149` (Familjen Grotesk 13px, opacity 0.8). No new classes, no layout
change, no new visual element: this is copy inside the product's signature moment, not a panel.
`contracts.md` scopes B13 to "gap copy only" in `SplitScreen.tsx`; the file's other
responsibilities (header, actions, deal animation) are untouched.

**Re-roll, swap, and what the field means afterwards.** No new work, and deliberately so:

- A re-roll calls `varietySplit`, which stamps `optimal: false`, so the qualifier appears with
  no extra wiring.
- A **swap** is the case worth stating: `swapPlayers` returns
  `recomputeResult(teams, discipline, result.unassigned, roster)` (`src/session/edit.ts:55`),
  and `recomputeResult`'s `solver` parameter defaults to
  `{ optimal: true, nodesExplored: 0, elapsedMs: 0 }` (`src/session/edit.ts:64`). Verified by
  probe: a 2-team split with `optimal: true, gap 0.100` becomes, after swapping Citra for Joko,
  `optimal: true, nodesExplored: 0, gap 0.500`. `optimal: true` after a hand edit means "no
  search was run", not "this arrangement is minimal" — the field is provenance, not a property
  of the current teams.

  B13's copy must therefore hold on the swap path too. At `:334`/`:135` the qualifier is driven
  by `gapQualifier(result)`, so a swapped result still reads "Gap 0.5. Team A leads." with no
  provenance word — which is honest under the stated meaning of the field (an edit is not a
  claim of optimality) and is why **the design does not promise "proven" after a swap**. The
  alternative — stamping swaps as best-found — would be a lie in the other direction: a swap is
  neither proven nor best-found, it is user-authored, and the screen has no third word for it.

  This is a note for the executor, not a code change: keep the copy reading from
  `gapQualifier(result)` and do not special-case the swap path. Changing what
  `recomputeResult` stamps is Phase A territory and is not proposed here.

### B14 — The landing page claims only what ships

Three edits, in `index.html` and `src/landing.tsx`.

**1. The trust list (`index.html:180-184`).** Today:

```html
<li>The gap is the proven minimum for your pool, not a heuristic.</li>
<li>Works with no signal. The court has no wifi.</li>
<li>Your data stays on your device. No account, no server.</li>
```

After B14, three rows, in this order and with these exact strings:

```html
<li>The gap is the proven minimum for a two-team split.</li>
<li>Your data stays on your device. No account, no server.</li>
<li>Free, no account. Runs in your browser.</li>
```

Row 1 is the claim made true by scoping it to where it holds (verified: 2-team pools return
`optimal: true`, ≤ 443 nodes). Row 2 is true today and is kept verbatim. Row 3 replaces the
offline claim with the action note that already carries it (`index.html:194`), so the close
still has three rows and the layout is unchanged. The offline sentence is **deleted**, not
softened: D02's ticket restores it when the manifest and service worker ship, at which point
`.landing-trust` row 3 becomes `Works with no signal. The court has no wifi.` again.

**2. The lede (`index.html:71-74`).** Today:

```
comp3tive splits your roster with the smallest strength gap that exists for that pool —
exact, not estimated — honoring every role along the way. Futsal, MLBB, badminton, then
the tournament on those teams.
```

After:

```
comp3tive splits your roster into teams with the smallest strength gap it can prove, honoring
every role along the way. Futsal, MLBB, badminton, then the tournament on those teams.
```

"exact, not estimated" is the phrase that overclaims, and it is what the spec e2e asserts on
(`landing.spec.ts:47` asserts "smallest strength gap" — preserved). The new sentence keeps
"smallest strength gap" and attaches "it can prove", which is true for every pool size and does
not read as a hedge on the 2-team case: a small pool still gets the exact minimum, and the split
screen says so in five words.

**3. The badminton card (`src/landing.tsx:110-116`).** Removed by B19 (see below), which is the
ticket that owns the discipline decision. B14's edit to the card is the `DISCIPLINES` array
losing its third entry **only if** B19 recommends removal; if B19 ships badminton, B14 keeps the
card and B19's ticket supplies the corrected `desc`, `roles`, and `teamSize` strings. Either
way the rail fact "Disciplines: 3+" (`index.html:157`) is corrected, because it is false today
(`SEED_DISCIPLINES` has two entries): it becomes `2` if badminton is removed and `3` if it ships.

**4. The claims that survive.** The hero, the deal, the bracket preview, and the discipline grid
are mounted from real code and are left alone. Specifically preserved: the rail labels
`["Split","Edit","Play","Roster","Open"]` (`index.html:80,105,127,152,171`); the wordmark and
its `<title>`; the footer (`index.html:200`); the CTA at `index.html:185-193` and its note
(`:194`); the hero's live `data-landing-gap` fill from `result.gap.toFixed(2)`
(`src/landing.tsx:210-217`), whose measured value for the shipped hero roster is genuinely
optimal (`optimal: true`, `nodesExplored: 51`, gap `0.10`).

**5. Every landing claim, mapped.** This table is the ticket's acceptance surface.

| Claim (file:line) | Verdict | Action |
|---|---|---|
| `GAP 0.10` in the rail, live solver output (`src/landing.tsx:210-217`) | **true today** (verified `optimal: true`, 51 nodes) | keep unfilled |
| "the smallest strength gap that exists for that pool — exact, not estimated" (`index.html:72-73`) | **overclaim** — false for 4+ teams | reword to "the smallest strength gap it can prove" |
| "the smallest strength gap" (`index.html:72`, asserted by `landing.spec.ts:47`) | true as a phrase | keep |
| "Re-rolls ∞", "re-roll until it says what you want" (`index.html:111`, `:123`) | **falsified by the audit**: re-roll is a no-op today | **restored by A03** (re-roll produces a different split); copy unchanged by B14 |
| "the number that proves it" (`index.html:123`) | overclaim, same defect class as the lede | reword to "the number that shows it" |
| "the solver just proved fair" (`index.html:145`) | overclaim on 3+ team tournaments | reword to "the solver just balanced" |
| "Then run the tournament … 3 formats" (`index.html:133-134`) | **true today** — series/single-elim/swiss | keep |
| "Disciplines 3+" (`index.html:157`) | **false** — `SEED_DISCIPLINES` has 2 | `2` (B19 removes badminton) or `3` (B19 ships it) |
| Badminton card (`src/landing.tsx:110-116`) | **false** — not a shipped discipline | removed by B19, or corrected to the shipped definition |
| "The gap is the proven minimum for your pool, not a heuristic." (`index.html:181`) | **overclaim** — false for 4+ teams | scoped to "a two-team split" |
| "Works with no signal. The court has no wifi." (`index.html:182`) | **false** — no SW, no manifest, CDN fonts | **removed by B14, restored by D02** |
| "Your data stays on your device. No account, no server." (`index.html:183`) | **true** (IndexedDB, ADR-0001) | keep verbatim |
| "Free, no account. Runs in your browser." (`index.html:194`) | **true** | keep; promoted into the trust list |
| `<meta name="description">` "Works offline, no account." (`index.html:9`) | **false** on the offline half | drop "Works offline," keep "no account" |
| "fair teams for futsal nights, MLBB sessions" (`index.html:200`) | **true** | keep |

**6. The e2e spec changes — required, not optional.** This is the one place the repo currently
*enforces* the false claims. `e2e/tests/landing/landing.spec.ts:57-63` asserts them verbatim:

```ts
const trust = page.locator(".landing-trust li");
await expect(trust).toHaveCount(3);
await expect(trust).toContainText([
  "proven minimum",
  "no signal",
  "stays on your device",
]);
```

After B14, the same test in the same place reads:

```ts
const trust = page.locator(".landing-trust li");
await expect(trust).toHaveCount(3);
await expect(trust).toContainText([
  "proven minimum for a two-team split",
  "stays on your device",
  "no account",
]);
```

Three notes for the executor:

- **The "no spec edited" discipline does not apply to B14.** That rule guards Phase C's
  behaviour-preserving refactors. B14 changes user-visible copy, so editing this spec is
  correct and required. Do not preserve the old assertions to keep the spec byte-stable.
- **`"stays on your device"` stays.** That claim is true and its assertion is not weakened.
- **D02 updates these assertions again.** When the service worker and manifest land, the
  third slot becomes the offline sentence once more. The B14 ticket carries this as an
  explicit handoff note.

Everything else in `landing.spec.ts` survives untouched: the rail-label assertion
(`:49-55`), the lede assertion `"smallest strength gap"` (`:47`), the wordmark accessible-name
assertion (`:46`), the CTA href and role assertions (`:72-73`, `:86-87`), the hero mount
assertions (`:95-113`), the deal animation suite, the theme assertions, and all five
returning-organizer redirect specs.

**7. New coverage for the changed copy.** B14 adds one spec so the corrected claims are pinned:
a test that asserts the trust list contains no "no signal", and that the lede contains
"it can prove". Without it, the next copy edit can quietly reintroduce the offline promise.
The spec lives in `e2e/tests/landing/landing.spec.ts` (the file that already owns this surface)
and follows A01's seeded conventions.

### B15 — One noun: Community, everywhere

D2. `CONTEXT.md` is authoritative: **Community** is the group; **Saved Squad** keeps its name.
`CONTEXT.md` lists `_Avoid_: group, club, team, profile` under Community and states of Saved
Squad that "'squad' is reserved for this artifact: never a single Team, never the Community
roster."

**The exact string replacements.** Every user-visible occurrence of "squad" that means the
group or a team set, with its location:

| File:line | Current | After |
|---|---|---|
| `src/App.tsx:1061` | `No players in this squad` | `No players in this community` |
| `src/App.tsx:1123` | `Split the squad` | `Split the roster` |
| `src/session/MatchScreen.tsx:48` | `then the squad` | `then the roster` |
| `src/session/SplitScreen.tsx:304` | `Tournament squad` | `Tournament teams` |
| `src/session/SplitScreen.tsx:400` | `Save tournament squad →` | `Save teams to tournament →` |

"Roster" is the right replacement in `:1123` and `MatchScreen:48`, not "Community": both
sentences are about the players being split, and `CONTEXT.md` defines Player as "a person on the
roster" and reserves Community for the container. `:304` and `:400` describe teams being handed
to a tournament, so they become "teams" — `CONTEXT.md` defines Team as "a group of players
assigned to play together in a session" and explicitly bans squad for it.

**Already correct, verified, and left alone.** The switcher's kicker is "Community"
(`src/App.tsx:821`), the menu heading is "Community" (`:838`), the switcher's `aria-label` is
"Active community" (`:829`), the add-community button is `aria-label="New community"` /
`title="New community"` (`:883-884`), and the add form's label is "New community" (`:931`). The
audit's "SQUAD ▾" label refers to the visible name plus caret, not a literal `SQUAD`; `git grep
-n "SQUAD" $(git rev-list --all)` finds no such string in any revision of `src/App.tsx`. **No
change is needed for the switcher itself** — the collision today is the five strings above.

**Saved Squad keeps its name.** Do not touch: `SquadsScreen.tsx:60` (`kicker="Saved squad"`),
`:115-116` (`kicker="Squad bank"`, `title="Saved squads"`), `:125-126`, `:174`;
`DashboardScreen.tsx:119` ("Saved squads"), `:264` ("Browse saved squads");
`SplitScreen.tsx:164` (`Save squad` modal title), `:179`, `:191` (`Save squad`),
`:383-385` (`Save squad`, `data-testid="save-squad-button"`);
`TournamentScreen.tsx:310` ("Or use a saved squad"); `App.tsx:67` (the nav label "Squads") and
`App.tsx:625`/`:643`/`:450` ("saved squad", in delete/import summaries).

**The nav label.** `NAV_ITEMS` (`src/App.tsx:62-68`) keeps `label: "Squads"` for the Saved
Squads hub, consistent with `Saved squads` as the screen title and A11's `hubButton` accessible
name `"Squads"`. Renaming the group strings does not require touching the hub.

**Spec strings that change.** The e2e suite locates the create-community control by title, so
`title="New community"` must not change — it does not, and no spec needs an edit for it. The
affected spec strings are only the two copy assertions that quote the changed strings:

| Spec | Line | Current | After |
|---|---|---|---|
| `e2e/tests/squads/saved-squad.spec.ts` | `:59`, `:62` (#squad-name, save-squad-button) | unaffected — Saved Squad | no change |
| `e2e/tests/tournament/split-tourney.spec.ts` | `:2` (comment only) | "Tournament squad split" | comment may be reworded; no assertion |

Verified: no e2e assertion quotes `No players in this squad`, `Split the squad`, `then the
squad`, `Tournament squad`, or `Save tournament squad`. The specs that create a community do so
via `page.getByTitle("New community")` — `panel/no-overlap.spec.ts:10`, `history/history.spec.ts:8`,
`tournament/inspect.spec.ts:8`, `inspect2.spec.ts:9`, `inspect3.spec.ts:9`, `journey.spec.ts:8`,
`create.spec.ts:8`, `draft.spec.ts:8`, `split-tourney.spec.ts:17`, `match-setup/setup.spec.ts:8`,
`split-flow/split.spec.ts:12`, `community/cancel-dropdown.spec.ts:8`,
`community/community.spec.ts:9` — and none of those strings change, so **B15 edits no spec
assertion**. It does add one, because the rename is user-visible behaviour: a spec asserting the
Roster empty state reads "No players in this community" and the split CTA reads "Split the
roster".

**Sequencing.** B15 runs after Phase A is green (per `contracts.md`: "B may run in parallel with
C after A is green"). The rename spans `src/App.tsx`, which Phase C later decomposes; B15's edit
is string-only and adds no structure, and C24/C25/C26 preserve it. `contracts.md` is explicit
that C must not rename independently — C reads B15's outcome. Those five exact strings are that
outcome.

### B16 — Reconcile the documents that contradict the code

Correct the drifts, keep each document's existing shape, and disposition the stale root docs.
Every change is specified; nothing is left to "update as needed".

**`docs/FLOW.md`** (the file others read as a contract — ADR-0004 says so):

- `:1` — retitle from `# comp3tive · Page Flow (as-to-be)` to `# comp3tive · Page Flow`. The
  doc's own `:4` ("Status: Accepted — this document is the contract. The app must conform to
  it.") already says as-is; the "(as-to-be)" title contradicts it.
- `:26` — "Four bottom-nav hubs" becomes "Five bottom-nav hubs", and the table gains a Home row
  and relabels the tournaments row. The corrected table, in nav order:

  | # | Tab | Owns |
  |---|---|---|
  | 1 | **Roster** | players + capabilities; add/import/export; **Disciplines**; the ad-hoc **"Split match"** entry |
  | 2 | **Games** | tournaments: list, create, draft, bracket, results |
  | 3 | **Home** | the Dashboard: active-community state and next actions (ADR-0005) |
  | 4 | **History** | past ad-hoc splits (Sessions): view, re-roll, save as squad, delete |
  | 5 | **Squads** | saved squads: view, re-split, delete, feed a tournament |

  Source of truth: `NAV_ITEMS` at `src/App.tsx:62-68`; the centre slot is Home (ADR-0005).
- `:74` — "Breadcrumbs are links — every crumb above the current screen navigates there" becomes
  "Breadcrumbs are labels, not links: every crumb above the current screen names where you came
  from, and Back is the control that returns there (ADR-0004)." Reality: `src/nav.tsx`'s
  `Breadcrumb` has zero consumers, and `src/session/SplitScreen.tsx:294` is a dead `<a href="#">`.
  Phase C28 wires the shared `Breadcrumb` into the screens; when that lands, this sentence is
  the one to revisit, so add the forward note in that same paragraph.
- `:11` (P1) — same correction as `:74`, in the rule list: "Every non-hub screen shows its path"
  stays; "breadcrumb of active links" becomes "breadcrumb of the path taken".
- The `§3` breadcrumb table (`:76-88`) keeps its values but its heading becomes "§3 Path table
  (P1)" and its intro sentence matches `:74`.
- `:175` — "in-app Back + breadcrumbs cover navigation" becomes "in-app Back covers navigation;
  breadcrumbs name the path". ADR-0004 stays the citation.
- `:20-23` (Entry) is already correct post-ADR-0006 and is left alone.

**`docs/spec/0002-tournaments-v1.md`** — the Data Model block and the persistence line:

- `:63` — "new `tournaments` store, DB **v5**" → "DB **v6**" (`src/storage/indexed-db.ts:18`),
  and "Backup **v3** adds `tournaments[]`; v1/v2 imports migrate with an empty list" →
  "Backup **v4** adds `tournaments[]` and `savedSquads[]`; v1–v3 imports migrate with empty
  lists" (`src/data/transfer.ts:9`, `:17-19`).
- `:48` — `teams: [{ id, bibIndex, name, players: [{playerId, roleId}], strength }]` →
  `teams: [{ id, bibIndex, name, players: Id[], strength }]`, with the comment
  `// player ids at submission; roles are not snapshotted` (`src/domain/types.ts:36`).
  Add the missing `thirdPlace: boolean` field at tournament level (`src/domain/types.ts:70`).
- `:54` — `nextMatchId?` → `winnerNext: { matchId, slot } | null` and
  `loserNext: { matchId, slot } | null` (`src/domain/types.ts:55-56`), with the comment updated
  from "double elim later" to "the loser slot carries the 3rd-place match today".
- `:46` — `seriesLength: 1 | 3 | 5` is correct as written and stays; the audit's "per-match
  seriesLength" defect is `:52`'s `matches: [{ …, seriesLength, … }]`, where the field is
  tournament-level. Delete `seriesLength` from the match object and note that a match inherits
  the tournament's.
- `:26-31` (Flow §1) — "between History and Disciplines" is stale: the five slots are
  Roster, Games, Home, History, Squads (`src/App.tsx:62-68`), and Disciplines is reached from
  Games' "Disciplines" button (`src/tournament/GamesScreen.tsx:134`, `onManageDisciplines`).
  Rewrite the parenthetical to say so.
- The document's own `Status` is absent; add `**Status**: shipped (DB v6, backup v4)` under the
  title so a reader knows it describes the build, not a plan.

**`docs/adr/0002-tournament-first-flow.md`** — B18 owns this change; see that section.

**Root documents — dispositions.** Three files, three dispositions, and the reason for each:

| File | Lines | Disposition | Reason |
|---|---|---|---|
| `DOMAIN_MODEL.md` | 289 | **Move to `docs/archive/DOMAIN_MODEL.md`** with a superseded banner | Duplicates `CONTEXT.md` as vocabulary, and `CONTEXT.md` is the live, authoritative glossary the agent docs point at (`docs/agents/domain.md`). Archiving preserves the record without leaving a second glossary in the root where `COMP3TIVE_COMPREHENSIVE_ANALYSIS.md:1455` lists it as a design-token source. |
| `IMPLEMENTATION_PLAN.md` | 234 | **Move to `docs/archive/IMPLEMENTATION_PLAN.md`** with a superseded banner | Its "Critical Gaps Identified" are all closed (Sessions exist, formats are pinned, participation is implemented). It reads as a live plan next to `PRODUCT.md`, which is the actual brief. |
| `COMP3TIVE_COMPREHENSIVE_ANALYSIS.md` | 1,463 | **Keep in the root, unchanged** | It is the source document for the app-health tickets and is dated and self-describing ("Generated: 2026-09-11"). It is a snapshot, not a claim about current state. Deleting it would destroy the provenance of the tickets already written from it. |
| `DESIGN.md` | 202 | **Keep** — it is the surviving direction (B17) | — |
| `docs/design.md` | 98 | **Delete** — B17 owns this | Competing direction, contradicted by the shipped CSS. |
| `CONTEXT.md` | 91 | **Keep, unmodified** | The live vocabulary; the audit explicitly scopes it out. |
| `PRODUCT.md` | 2,272 B | **Keep, unmodified** | Current brief. |

The banners are two lines each, placed under the `# ` title:

```
> **Superseded 2026-09-17.** This document describes work that has shipped. The live
> vocabulary is `CONTEXT.md`; the current flow contract is `docs/FLOW.md`. Kept for history.
```

**A note on deletion authority.** `DOMAIN_MODEL.md`, `IMPLEMENTATION_PLAN.md`,
`COMP3TIVE_COMPREHENSIVE_ANALYSIS.md`, and `docs/design.md` were authored by the repo owner.
This spec recommends **moving** three of them and **deleting** one, and does not delete any of
them itself. The B16 ticket states the same, so the executor confirms the moves before running
them; if the owner prefers to keep `docs/design.md`, the ticket's fallback is to replace its
body with a one-line pointer to `DESIGN.md`. Nothing is silently removed.

**`docs/superpowers/plans/2026-09-10-paper-pencil-redesign.md:9`** — the Tailwind claim:
`**Tech Stack:** TypeScript, React, Tailwind CSS, Vite, Vitest — no new dependencies required.`
becomes `**Tech Stack:** TypeScript, React, Vite, Vitest, hand-written CSS custom properties —
no new dependencies required.` No Tailwind exists anywhere in the repo.

**`docs/agents/*`** — verified clean. `docs/agents/domain.md` points at `CONTEXT.md` and
`docs/adr/`, both of which remain; it also names `CONTEXT-MAP.md` and `src/<context>/docs/adr/`
as optional and instructs the reader to "proceed silently" when absent, which is the case here.
No edit. The roadmap's exit criterion "`docs/agents/*` agree with the code" is satisfied by
leaving it alone, and the B16 ticket records that verification.

**Acceptance for B16** is a grep: no remaining statement in `docs/`, the root markdown, or
`src/` contradicts the code on a fact a reader would act on. The ticket lists the ten exact
claims from the table above so the executor checks a closed set, not an open-ended sweep.

### B17 — Resolve the two competing design directions

**Two documents describe two different products.**

- `docs/design.md:3` — "Direction: **Scoreboard.** Monochrome structure with one electric pop…
  a single saturated cobalt accent", with `cobalt #2B6BFF`, `paper #F4F5F2`, `ink #14161A`, and
  a type stack of Chakra Petch + Familjen Grotesk.
- `DESIGN.md:3` — "**Direction: 'Paper & Pencil.'** … warm paper, quiet ink, and a single amber
  mark", with `amber #C2410C` (B17's line 3 is `DESIGN.md:3`), `paper #FAF8F5`, `ink #1C1917`,
  and Outfit + Familjen Grotesk.

**The shipped build decides it.** `src/tokens.css:2` states "Design system: 'Paper & Pencil'
(per DESIGN.md)" and declares `--surface: #faf8f5`, `--text: #1c1917`, `--accent: #c2410c`,
`--whistle: #c2410c` — the Paper & Pencil set. `grep -rn "2B6BFF\|Chakra\|cobalt" src/
index.html app/index.html public/` returns **no matches**: not one cobalt value or Chakra Petch
reference exists in the build. `index.html:37-38`'s landing contract comment names the world
"Inherited from DESIGN.md, unchanged" and gives `#FAF8F5`, `#1C1917`, `#C2410C`. The landing
spec's own assertions pin the shipped tokens by rgb value
(`landing.spec.ts:236-239`: light `rgb(250, 248, 245)`, dark `rgb(28, 25, 23)`), which are
Paper & Pencil's numbers.

**The survivor is `DESIGN.md`.** It is the direction that ships, it covers the Landing Page as
well as the app, and it is cited as the source of truth by the code that implements it.

**What happens to the loser.** `docs/design.md` is deleted. Its whole content is a competing
palette and type stack that appear nowhere in the build, and leaving a second "Design Direction"
document in `docs/` — the directory the agent docs tell agents to read — is exactly how the
drift started. The B17 ticket deletes it and, if the owner prefers a trail, replaces its body
with a one-line pointer: `Superseded by DESIGN.md (Paper & Pencil). See docs/adr/ for decisions.`
No token moves, no CSS changes, no visual work: B17 is a documentation decision.

**One consequence worth stating.** `DESIGN.md` contains no copy-voice or accessibility section;
`docs/design.md` carried the em-dash ban (`:72`) and the accessibility floor (`:86`). Those
rules are live (the B13 qualifier obeys the em-dash ban) and would be lost with the file, so the
B17 ticket carries two short sections into `DESIGN.md` verbatim before deleting the loser:

- `## Copy voice` — the em-dash rule and the "errors don't apologize and are never vague"
  sentence.
- `## Accessibility & quality floor` — the 44px target, `min-height: 100dvh`, focus-ring,
  and 4.5:1 contrast rules.

`DESIGN.md` currently has `## Things that don't change` as its last section; these two go
immediately before it. This is a move of existing text, not new rules.

### B18 — ADR-0002 is accepted, not proposed

`docs/adr/0002-tournament-first-flow.md:5` reads `**Status**: proposed`. The feature shipped and
is a primary hub: `Tournament` is in the data model (`src/domain/types.ts:61`), the Games hub
lists and creates tournaments (`src/tournament/GamesScreen.tsx`), the draft/bracket/standings
states exist (`src/tournament/TournamentScreen.tsx`), and `docs/adr/0003` and `0005` build on it
as settled. The other five ADRs read `**Status**: accepted` (`0001:5`, `0003:5`, `0005:20`,
`0006:5`); `0004` carries no status line at all.

**The change:** one line, `**Status**: proposed` → `**Status**: accepted` on `:5`, plus a dated
`**Accepted**: 2026-09-17` immediately after it, because the ADR predates its own acceptance and
a reader deserves to know the decision was ratified later, not on the day it was written.

**One correction in the same file.** The Consequences section's last bullet says "the Match
carries a `nextMatchId` with a winner slot now and a loser slot when double elim lands." Reality:
the Match carries `winnerNext` **and** `loserNext` today, and `loserNext` is in active use for
the 3rd-place match (`src/domain/types.ts:55-56`; `docs/spec/0002` §4 describes the 3rd-place
row as default-on). The bullet becomes: "the Match carries `winnerNext` and `loserNext`; the
winner slot advances the bracket today, and the loser slot carries the 3rd-place match. Double
elimination remains deferred, and its loser-bracket semantics would be the decision that
revisits this."

Also add `**Status**: accepted` to `docs/adr/0004-origin-aware-navigation.md`, which has the
heading and body of a decision but no status line, unlike its five siblings. That is an
inconsistency a reader acts on (they cannot tell whether 0004 is settled), so it belongs in this
ticket rather than being left for a later sweep.

### B19 — Badminton: ship it as a real discipline

**The decision, and why it is not the marketing card.** `src/landing.tsx:110-116` advertises
`roles: ["Singles", "Doubles"]` and `teamSize: "1v1 or 2v2"`. Read as a `Discipline`, that is
`team: { minTeamSize: 1, maxTeamSize: 2, rolesRequired: true }` with roles `singles`/`doubles`.
Probed against the real solver, that shape **does** return teams (4 teams of 2 from 8 players,
gap 0.000) — but the card is still incoherent with the model, for a reason the probe exposes:

- The solver's role assignment is `assignRoles(players, roleIds)`, which returns `null` unless
  `players.length === roleIds.length` (`src/solver/solver.ts:93-94`) and `consider()` rejects any
  team where `rolesRequired && !teams.every((t) => roleCoverPossible(t, roleIds))`
  (`:532-534`). A team of 2 therefore needs **exactly two** roles filled by exactly two players.
  `Singles` and `Doubles` are not two positions on one team — they are two *formats*, one of
  which has one player per side. The card encodes a format choice as a role pair.
- With `minTeamSize: 1, maxTeamSize: 2`, a 1-player team under `rolesRequired: true` needs two
  role slots filled by one player, so `roleCoverPossible` (`:84-93`, `if (team.length <
  roleIds.length) return false`) rejects it. 1v1 cannot be expressed by this shape at all.

**Badminton ships as doubles, with two coherent court roles and hard coverage.** This is a real
discipline, verifiable by the same path the other two use, and the roles are positions rather
than formats:

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

`SEED_DISCIPLINES` (`src/domain/seed.ts:52`) becomes
`[FUTSAL_DISCIPLINE, MLBB_DISCIPLINE, BADMINTON_DISCIPLINE]`.

**Why this shape, from the solver's rules, not from taste:**

| Property | Value | Solver rule it satisfies |
|---|---|---|
| `minTeamSize: 2`, `maxTeamSize: 2` | teams are exactly pairs | `sizeLow = sizeHigh = 2` (`src/solver/solver.ts:468-472`), so every team is a doubles pair |
| 2 roles, `rolesRequired: true` | every pair covers front and rear court | `roleCoverPossible` needs `team.length >= roleIds.length`; 2 ≥ 2 holds (`:81`) |
| one role per player | `assignRoles` is exact | `assignRoles` requires `players.length === roleIds.length` (`:90`); a 2-player team against 2 roles satisfies it, and the probe confirms `front-court+rear-court` on every team |

Measured with a purpose-built 10-player pool (every player eligible for both courts, alternating
preferences): suggested team count 5, `teams=5`, `sizes=[2,2,2,2,2]`, `gap=0.000`,
`optimal=true`, `flags=[]` — a clean split with full coverage. A per-team role spread of
`front-court+rear-court` on all five teams.

**Why not 1v1.** Modelled as its own discipline it works mathematically
(`minTeamSize: 1, maxTeamSize: 1`, one role, 4 teams of 1 from 8 players, gap 1.000,
`optimal=true`), but it is the wrong product: `suggestTeamCount` is
`floor(pool / minTeamSize)` (`src/solver/solver.ts:37`), so a 10-player badminton club with
`minTeamSize: 1` is offered **10 teams** — a 10-way round robin, not a night of 1v1s. The
solver returns `teams=10, sizes=[1×10], optimal=true`. A discipline that turns ten friends into
ten teams is not shipping an honest default. Doubles it is, and the landing card says doubles.

**What the landing card becomes** (B14 carries the edit; B19 supplies the strings):

```tsx
{
  name: "Badminton",
  desc: "Doubles on a badminton court — pairs balanced by strength, one at the front and one at the back.",
  roles: ["Front court", "Rear court"],
  attributes: ["Technical", "Fitness", "Game IQ"],
  teamSize: "2 v 2",
},
```

And the rail fact `Disciplines` becomes `3` (`index.html:157`).

**Alternative considered and rejected: remove badminton instead.** The roadmap's exit criterion
allows either ("badminton is either shipped or removed from the page"). Shipping is better here
because the discipline is cheap (a seed entry and a sample roster), the solver already handles
it correctly, it makes the landing card's promise true rather than deleting a product claim, and
it gives `DisciplineEditModal.tsx:189`'s `placeholder="e.g. Badminton"` a real referent. The
cost of removal would be a landing page that advertises two activities, and a `PRODUCT.md` that
opens by naming badminton as in scope.

**Collisions to fix in the same ticket**, verified:

- `src/domain/seed.test.ts:6` asserts `SEED_DISCIPLINES.map((d) => d.id)).toEqual(["futsal",
  "mlbb"])` — becomes `["futsal", "mlbb", "badminton"]`.
- `src/domain/seed.test.ts` gains the badminton assertions alongside the futsal and MLBB ones:
  roles `["front-court","rear-court"]`, attributes `["technical","fitness","game-iq"]`, team
  `{ minTeamSize: 2, maxTeamSize: 2, rolesRequired: true }`.
- `src/storage/indexed-db.test.ts:85` and `:97` assert the seeded catalog is exactly
  `["futsal", "mlbb"]` — both become `["badminton", "futsal", "mlbb"]` after `.sort()`.
- `src/data/sample-data.test.ts:20-24` asserts `listDisciplinesWithSampleData()` has length 2 —
  becomes 3 once B20 adds `badminton-roster.json`.
- `src/domain/validation.test.ts:42` uses `disciplineId: "badminton"` as its **unknown**
  discipline and asserts `Unknown discipline "badminton"`. Its `disciplines` fixture is built
  locally, not from `SEED_DISCIPLINES`, so the assertion still passes — but the fixture now
  reads as a lie about a shipped discipline. Change the id to `"padel"` (not shipped, not
  planned) so the test says what it means.
- `src/storage/migration.test.ts:170` and `src/storage/indexed-db.test.ts:73` use `"badminton"`
  for a *custom* discipline fixture. `migration.test.ts`'s assertion is
  `expect(ids).toContain("badminton")` against seeded defaults that will also contain badminton,
  so it would pass vacuously. Rename both fixtures to a non-seeded id (`"padel"`) so the tests
  keep proving what they claim.
- `docs/spec/0001-team-builder-v1.md:94` says "only Futsal and MLBB ship in v1" — B16's sweep
  catches this; B19's ticket carries the one-line correction so the discipline change and its
  doc change land together.
- A new sample roster is needed: `sample-data/badminton-roster.json` (B20 authors it; B19's
  ticket depends on B20's file, or B19 adds the registry entry that B20 fills).

**Hard vs soft coverage.** Hard coverage (`rolesRequired: true`) is correct here and is what the
probe validated: on a balanced pool it produces full coverage with zero flags. On a degenerate
pool — every player eligible for front court only — hard coverage returns **zero teams**
(measured: `teams=0`), because no pair can cover the rear court. That is the same tradeoff MLBB
already makes (`team.rolesRequired: true`, `src/domain/seed.ts:49`), and the split screen already
has a state for it: the `Solver failed / Couldn't build teams` empty state at
`src/session/SplitScreen.tsx:349-352`, whose copy says "Not enough eligible players for this
game. Adjust the pool or change the discipline." Soft coverage would avoid the empty state but
would emit `role-uncovered` flags (measured: 4 flags on the same pool) on a discipline whose
whole point is having a front and a back player. Consistency with MLBB wins.

### B20 — Sample data that matches the audience

`PRODUCT.md` names "Futsal night organizers", "MLBB squad captains", and "Multi-sport community
managers". The samples should look like those people's rosters, not like the MPL Indonesia
league.

**The defect, measured.** Both shipped files are 25 Indonesian esports professionals with real
org tags (`ONIC · Jungle`, `RRQ · Mid`, `EVOS · Gold`, `Aura Fire · EXP`, `Alter Ego · Roam`),
and the futsal file reuses the same names as the MLBB file. Run through the repo's own
validator:

- `sample-data/futsal-roster.json` — **7 of 25 players fail `validatePlayer`**, all for
  `Preferred role "pivot"|"winger" must be inside the eligibility list` (`cw`, `cr1te`, `wannn`,
  `oura`, `luminaire`, `nino`, `blustine`). The file ships data the app's own validator rejects.
- Its role spread is unusable: `goalkeeper` eligible for 25/25, `defender` 25/25, `winger` 11/25,
  `pivot` 0/25. A 5-team futsal split emits **8 `role-uncovered` flags** on the shipped sample.
- `sample-data/mpl-id-roster.json` is valid but its role spread is thin (`mage` 5/25,
  `marksman` 5/25, `tank` 15/25, `fighter` 15/25, `assassin` 10/25), and a 5-team split costs
  **4,000,001 nodes** and returns `optimal: false` with gap 0.350.

**The replacement data.** Three files, each shaped so the app's own default split is clean. All
figures below were produced by running the shipped solver over the proposed rosters.

**`sample-data/futsal-roster.json`** — 25 players, five groups of five, one preferred role
group per band, every player eligible for all four futsal roles, rating constant within a band:

- ids `futsal-01` … `futsal-25`; names `Rangga, Bayu, Dimas, Yoga, Fikri, Adit, Gilang, Reza,
  Tio, Bagas, Nanda, Ucok, Wahyu, Ilham, Rafi, Bima, Sandi, Arif, Doni, Hendra, Yudi, Panji,
  Aldo, Bram, Cakra`; `notes` `"Sunday League · <Role>"`.
- bands (index range → preferred role / rating, all three attributes equal): 0–4 →
  `goalkeeper`/2, 5–9 → `defender`/3, 10–14 → `winger`/4, 15–19 → `pivot`/5, 20–24 →
  `goalkeeper`/2. The construction rule, which produces exactly that: `preferredRole =
  roles[floor(i/5) % 4]`, rating = `2 + (floor(i/5) % 4)`, `eligibleRoles` = all four roles.
- Measured: `validatePlayer` — 0 invalid; suggested team count 5; `teams=5`,
  `sizes=[5,5,5,5,5]`, `gap=0.000`, `optimal=true`, `flags=[]`.

**`sample-data/mpl-id-roster.json`** — 25 players, five per role, handle-style names:

- ids `mlbb-01` … `mlbb-25`; names `Kiww, Jendral, Saber, Lumos, Renz, Vandal, Ozzy, Kenz, Ryuu,
  Taka, Nori, Zeke, Panca, Vier, Monz, Kuro, Kaze, Sora, Volt, Refa, Tora, Wira, Yuki, Zenn,
  Ari`; `notes` `"Ranked squad"`.
- each player: `preferredRole = roles[i % 5]`, `eligibleRoles = [roles[i % 5],
  roles[(i + 2) % 5]]` with `roles = ["tank","assassin","mage","marksman","fighter"]`, and all
  four attributes rated `2 + ((i + k) % 4)` for k = 0..3.
- Measured: 0 invalid; suggested team count 5; `teams=5`, `sizes=[5,5,5,5,5]`, `gap=0.000`,
  `optimal=true`, `flags=[]`, every team `tank+assassin+mage+marksman+fighter`. This trades the
  shipped sample's harder problem for a clean demo: 5 five-player teams with 5 specialists per
  role and even ratings is fully provable, which is the point of a sample.

**`sample-data/badminton-roster.json`** (new, per B19) — 10 players:

- ids `badminton-01` … `badminton-10`; names `Dimas, Sari, Rangga, Putri, Bayu, Ayu, Fikri,
  Nadia, Yoga, Intan`; `notes` `"Club night"`.
- each: `eligibleRoles: ["front-court", "rear-court"]`, `preferredRole` alternating
  rear/front, three attributes rated `3 + ((i + k) % 3)`.
- Measured: 0 invalid; suggested team count 5; `teams=5`, `sizes=[2,2,2,2,2]`, `gap=0.000`,
  `optimal=true`, `flags=[]`.

**Format requirements.** All three keep `"version": 1`, an `exportedAt` ISO string, `players`,
and `sessions: []` — the shape `parseBackup` accepts (`src/data/transfer.ts:100-104`) and the
shape `src/data/sample-data.ts` imports. The v1 format is not changed.

**The dynamic-import warning.** `npx vite build` warns:

> `src/data/sample-data.ts is dynamically imported by src/App.tsx but also statically imported by
> src/domain/useDisciplines.ts, dynamic import will not move module into another chunk.`

B20 does **not** fix this. It is a bundling change in Phase C's territory
(`contracts.md` gives C `vite.config.ts` and shell decomposition), and fixing it means moving the
static import out of `useDisciplines.ts` — an architectural edit, not a data edit. The B20 ticket
records the warning, states that the new files do not change it (the warning is about the module,
not the JSON), and cites the constraint so the next reader does not mistake it for something B20
left undone. If C does not take it, it is a one-line follow-up ticket, not silent debt.

**Name collisions with the app's own demo content.** The landing page's hero roster uses
`Budi, Andi, Citra, Dewi, Eka, Fajar, Gita, Hana, Irfan, Joko` (`src/landing.tsx:19-30`) and its
bracket preview uses `Eka, Irfan, Citra, Gita`. The new samples use none of those names, so the
landing hero and a downloaded sample roster cannot be mistaken for each other. The futsal and
MLBB samples share no names with each other either (verified: no overlap), so a person who
downloads both sees two different groups — the defect the current files have (`Kairi` is a
goalkeeper in the futsal file).

## Acceptance criteria

**B13.** With a 2-team split on the landing roster (10 MLBB players), the split screen readout
reads `Gap 0.1. Team A leads.` and contains no provenance word. With a 5-team split of the
shipped MLBB sample (25 players), it reads `Gap 0.4. Team A leads. Best gap found.`
(`optimal: false`, 4,000,001 nodes). After clicking Re-roll on the landing hero, the qualifier
appears — `best-found`, because `varietySplit` stamps `optimal: false`
(`src/solver/solver.ts:419`). `gapQualifier(result)` returns `null` for the first case and
`"Best gap found."` for the other two.

**B14.** On `/`, the trust list has exactly three items and contains no substring `no signal`;
the lede contains `it can prove` and still contains `smallest strength gap`; the description meta
contains neither `Works offline` nor `badminton` unless B19 shipped it; `Disciplines` in the
Roster rail reads `2` or `3` matching `SEED_DISCIPLINES.length`.

**B15.** Grep-level: `grep -rn "No players in this squad\|Split the squad\|then the squad\|Tournament squad\|Save tournament squad" src/` returns nothing. The five replacement strings are present. Every "Saved squad" occurrence listed in the design is unchanged.

**B16.** `docs/FLOW.md` says five hubs and lists Home; `docs/spec/0002` says DB v6 / backup v4
and matches `src/domain/types.ts`; `docs/adr/0002` is accepted; no root document describes
unshipped work as live; the Tailwind claim is gone.

**B17.** Only one of `DESIGN.md` / `docs/design.md` remains, and it is `DESIGN.md`, and
`DESIGN.md` contains the `## Copy voice` and `## Accessibility & quality floor` sections.

**B18.** `docs/adr/0002` reads `**Status**: accepted`; `docs/adr/0004` carries a status line.

**B19.** `SEED_DISCIPLINES` has three entries; a 10-player badminton pool splits into five
`2 v 2` teams with `flags: []` and `optimal: true`; `src/domain/seed.test.ts`,
`src/storage/indexed-db.test.ts`, and `src/data/sample-data.test.ts` assert the new catalog size;
the `"badminton"`-as-custom fixtures in `validation.test.ts`, `migration.test.ts`, and
`indexed-db.test.ts` use a non-seeded id.

**B20.** All three sample files pass `validatePlayer` for every player; each splits to its
suggested team count with `gap = 0.000`, `optimal: true`, and zero flags; `sample-data/*.json`
contain no ONIC/RRQ/EVOS/Aura Fire/Alter Ego tags and no shared names between files.

**Commands.** After the phase, from the repo root:

| Command | Expected |
|---|---|
| `npx vitest run` | all unit tests pass, including the corrected seed and storage assertions (114 passing before B; the count rises with B19's and B20's new assertions) |
| `npx tsc -b` | exit 0, clean |
| `npx vite build` | succeeds; the `sample-data.ts` dynamic-import warning is unchanged (B20 records it, does not fix it) |
| `npm run e2e` | the suite passes, **including** the edited `e2e/tests/landing/landing.spec.ts` and the new copy assertions. This command exists only after A10 lands; before that, `npx playwright test --config=e2e/playwright.config.ts` |

The phase is proven done when a fresh `npm run e2e` run is green with the corrected landing
assertions, `npx vitest run` is green with the corrected catalog assertions, and the grep
checks above return the stated results.

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| B14 edits a spec that currently passes 16/16, and Phase C's "no spec edited" rule is read as applying here | The executor preserves the false assertions and the landing page keeps lying in its own test | Stated in three places: this spec, the B14 ticket, and the ticket's acceptance criteria. The rule is scoped to Phase C's behaviour-preserving refactors. |
| The offline claim is removed now and never restored | A product capability silently disappears from the marketing | `contracts.md` freezes the sequencing (B14 removes, D02 restores); the B14 ticket carries the exact restore string and the spec line D02 must re-edit. |
| B13's qualifier reads as a hedge on the 2-team case, which is where the claim is strongest | The honesty work reads as scope reduction (the roadmap names this risk) | `gapQualifier` returns `null` when proven, so the proven path emits byte-identical markup to today. The copy adds no "only" or "approximately". |
| Badminton ships and a degenerate pool returns zero teams | The split screen shows `Couldn't build teams` on a discipline the landing page advertises | Hard coverage matches MLBB's existing tradeoff, the empty state already exists with actionable copy, and the shipped sample is built to cover both courts. Records the tradeoff in B19 rather than hiding it. |
| B19 changes seeded disciplines, which shifts every fixture that assumed two | Unit tests fail in Phase A's already-green suite | Six collisions enumerated with file:line and their exact new expectations; the `"badminton"`-as-custom fixtures are renamed to `"padel"` so they keep proving their claim. |
| B20 replaces sample data and silently breaks a spec that imports it | Hidden coupling to specific pro names | Verified: `sample-data.ts` is the only importer (`src/data/sample-data.ts:2-3`), and no e2e spec reads the JSON files — `saved-squad.spec.ts:22-31` builds its own 10 players in-memory. The B20 ticket re-verifies with the same grep. |
| B16 moves or deletes files the repo owner authored | Losing documents the owner wanted | Three moves and one deletion are recommended, not performed; the ticket requires confirmation, every file is named, and the deletion has a stated fallback (replace the body with a pointer). |
| B15 renames a string a spec locates by title | A green suite goes red | Verified that no spec asserts the five changed strings, and that `getByTitle("New community")` — used by 13 spec files — is unchanged. The ticket lists both facts. |

## Files

| Action | Path |
|---|---|
| Create | `docs/superpowers/specs/2026-09-17-honest-claims-design.md` (this file) |
| Create | `.scratch/debt/issues/13-the-split-says-whether-its-gap-is-proven.md` |
| Create | `.scratch/debt/issues/14-the-landing-page-claims-only-what-ships.md` |
| Create | `.scratch/debt/issues/15-one-noun-community-everywhere.md` |
| Create | `.scratch/debt/issues/16-reconcile-the-documents-that-contradict-the-code.md` |
| Create | `.scratch/debt/issues/17-resolve-the-competing-design-directions.md` |
| Create | `.scratch/debt/issues/18-adr-0002-is-accepted-not-proposed.md` |
| Create | `.scratch/debt/issues/19-badminton-ships-as-a-real-discipline.md` |
| Create | `.scratch/debt/issues/20-sample-data-that-matches-the-audience.md` |
| Create (ticket 13) | `src/session/gapProvenance.ts` |
| Modify (ticket 13) | `src/session/SplitScreen.tsx` (gap copy at `:135` and `:334` only) |
| Modify (ticket 14) | `index.html`, `src/landing.tsx`, `e2e/tests/landing/landing.spec.ts` |
| Modify (ticket 15) | `src/App.tsx` (`:1061`, `:1123`), `src/session/MatchScreen.tsx` (`:48`), `src/session/SplitScreen.tsx` (`:304`, `:400`), plus one new e2e spec |
| Modify (ticket 16) | `docs/FLOW.md`, `docs/spec/0002-tournaments-v1.md`, `docs/spec/0001-team-builder-v1.md`, `docs/superpowers/plans/2026-09-10-paper-pencil-redesign.md`, `docs/agents/domain.md` (verify only) |
| Move (ticket 16) | `DOMAIN_MODEL.md` → `docs/archive/DOMAIN_MODEL.md`; `IMPLEMENTATION_PLAN.md` → `docs/archive/IMPLEMENTATION_PLAN.md` |
| Modify (ticket 17) | `DESIGN.md` (absorb two sections), delete `docs/design.md` |
| Modify (ticket 18) | `docs/adr/0002-tournament-first-flow.md`, `docs/adr/0004-origin-aware-navigation.md` |
| Modify (ticket 19) | `src/domain/seed.ts`, `src/data/sample-data.ts` (badminton registry entry), `src/domain/seed.test.ts`, `src/storage/indexed-db.test.ts`, `src/storage/migration.test.ts`, `src/domain/validation.test.ts`, `src/data/sample-data.test.ts`, `docs/spec/0001-team-builder-v1.md` |
| Modify (ticket 20) | `sample-data/futsal-roster.json`, `sample-data/mpl-id-roster.json`, create `sample-data/badminton-roster.json` |

Tickets 19 and 20 share the badminton sample but not a file: B20 authors
`sample-data/badminton-roster.json`, B19 imports and registers it in `src/data/sample-data.ts`
and updates the catalog assertion in `src/data/sample-data.test.ts`. No file appears in both
tickets.

Ownership check against `contracts.md`: every file above is inside Phase B's exclusive set
(`index.html`, `src/landing.tsx`, `src/landing.css`, `src/session/SplitScreen.tsx` gap copy,
`src/domain/seed.ts`, `docs/FLOW.md`, `docs/design.md`, `docs/spec/0002-tournaments-v1.md`,
`docs/adr/0002-*.md`, `sample-data/*.json`, root `DOMAIN_MODEL.md`/`IMPLEMENTATION_PLAN.md`) with
three additions this spec must justify:

- **`src/session/gapProvenance.ts` (new)** and **`src/domain/seed.test.ts`,
  `src/storage/indexed-db.test.ts`, `src/storage/migration.test.ts`,
  `src/domain/validation.test.ts`, `src/data/sample-data.test.ts` (test files)** — the
  contract's ownership table lists production paths, and B19 changes a production constant whose
  assertions live in these files. The alternative is a phase that ends with a red `vitest run`,
  which the roadmap forbids. These five test files are named explicitly so no sibling phase
  assumes ownership.
- **`e2e/tests/landing/landing.spec.ts` and one new e2e spec** — `e2e/**` is Phase A's exclusive
  write set, but B14 must edit an assertion that currently enforces a false claim, and the
  edit cannot be made by A (A does not know B's copy). This is a deliberate, minimal, named
  exception: B14 touches only the landing spec's trust-list block, its lede assertion, and adds
  one test. The sequencing in `contracts.md` ("B may run in parallel with C after A is green")
  keeps A's suite green before B starts. If the maintainer prefers strict ownership, B14's plan
  defers the spec edit to a handoff message with A — but the edit must land with the copy or the
  suite stays green while the page lies, which is the defect this phase exists to fix.

## Spec Self-Review

- **Placeholders.** None. Every ticket names exact files, exact line numbers, and exact strings.
  No "TBD", "TODO", "handle edge cases", or "similar to ticket N". The B13 copy is given as
  literal strings and literal JSX. The B20 rosters are given as literal name lists, id schemes,
  and construction rules, with the measured result of each.
- **Internal consistency.** Checked the following couplings:
  - B13's qualifier and B14's trust list both assert the 2-team case is provable, using the same
    measurement (`optimal: true`, ≤ 443 nodes for 2-team pools). They do not contradict.
  - B14's "Disciplines" rail count is conditional on B19's outcome in two places (the design and
    the claim table), and both say the same thing: `2` if removed, `3` if shipped. B19 ships it,
    so the resolved value is `3`.
  - B19 adds a third seeded discipline; B20's `sample-data.test.ts` assertion of length 3 and
    B19's seed assertions agree, and both are listed in B19's collision table.
  - B16 and B18 both touch `docs/adr/0002` region and `docs/spec/0002`; B18 owns the ADR,
    B16 owns the spec, and neither edits the other's file.
  - B17 deletes `docs/design.md` and B16's sweep lists `docs/design.md` in its document table;
    B16's table names B17 as the owner and does not delete it.
  - Phase order: no B ticket depends on C or D. B14 depends on D02 only in the *future* direction
    (D02 restores the claim), which is the frozen sequencing.
- **Scope.** Eight tickets, each confined to one concern, each small enough for one
  implementation plan. B13 is a new 30-line module plus two call sites. B14 is copy plus one
  spec block. B15 is five strings. B16 is prose edits to three documents plus two moves. B17 and
  B18 are single-file decisions. B19 is one seed constant, one sample roster, and six test
  expectation updates. B20 is three data files. The phase is one plan.
- **Ambiguity.** Resolved during review: (a) the B13 copy for a *swapped* result — decided to
  keep reading from `gapQualifier(result)` and not special-case the swap path, with the reason
  and the alternative recorded rather than left open; (b) whether `recomputeResult`'s
  `optimal: true` default should change — decided no, it is Phase A territory; (c) the B14
  badminton card — B19 ships the discipline, so the resolution is deterministic: the card stays
  with B19's strings and the rail count becomes `3`; (d) which document deletes `docs/design.md`
  — decided B17, with B16's table deferring to it; (e) the nav label "Squads" — decided it stays,
  because it names the Saved Squads hub and is not one of the group-meaning strings; (f) which
  ticket owns the badminton sample — decided B20 writes the JSON, B19 owns the registry entry and
  the catalog assertion, so no file appears in both tickets. Two items remain genuinely for the
  owner and are marked as such: whether to move the two stale root docs, and whether B14's e2e
  edit is acceptable inside Phase A's `e2e/**` ownership. Both are stated with a fallback rather
  than left ambiguous.
- **Citation pass.** Every `file:line` reference in this spec and in all eight tickets was
  resolved against the working tree and checked to contain the symbol it is cited for (30 anchors
  verified, including `src/domain/types.ts:55-56`, `:61`, `:67`, `:70`, `:166`, `:157`;
  `src/solver/solver.ts:419`, `:409`, `:81`, `:94`, `:515`, `:468-472`; `src/session/edit.ts:55`,
  `:64`; `src/session/SplitScreen.tsx:135`, `:334`, `:294`, `:304`, `:400`, `:349-352`;
  `src/App.tsx:821`, `:838`, `:884`, `:931`, `:1061`, `:1123`; `src/landing.tsx:210-217`, `:111`;
  `docs/design.md:11`, `:32-37`, `:78-80`; `DESIGN.md:15-24`, `:196`; `docs/FLOW.md:1`, `:26`,
  `:74`; `docs/spec/0002-tournaments-v1.md:31`, `:48`, `:52`, `:54`, `:63`;
  `e2e/tests/landing/landing.spec.ts:47`, `:237-239`). Numbers that describe solver or validator
  behaviour were produced by running the shipped code over the proposed data, and every one is
  quoted above.
