# 26: The split and tournament flow move out of the shell

**Status:** ready-for-agent (re-checked 2026-10-01 against `feature/revamp`; verified partial, headline row still unmet)

**What to build:** The rule that decides whether an edit is saved — *whether a mutation
persists depends on where the split was entered from* — is testable on its own instead of being
implied by which callbacks a screen happened to be handed. `src/App.tsx` lands under 400 lines
and holds no flow rules.

**Evidence.** One `SplitScreen` serves four entry points, and whether a mutation persists
depends on the source: `ad-hoc` writes each edit to the Session log; `tournament` submits into
the bracket; `session` and `squad` persist nothing. That is documented normatively in
`docs/FLOW.md` §2 rules 3–4 and ADR-0004, and is currently enforced by three scattered inline
checks — `if (setup.source === "ad-hoc")` at `src/App.tsx:310-314` (with a swallowed catch:
"Non-fatal: still show the split if persistence failed"), `view.source === "ad-hoc"` again at
`:1185-1193`, and `reroll`'s pool rebuilt from `result.teams` rather than the session's own pool
at `src/session/SplitScreen.tsx:255-264`. Every flow handler is inline: `startMatch` (`:238`),
`togglePlayer` (`:269`), `selectDiscipline` (`:273`), `changeTeamCount` (`:283`), `split`
(`:287`), `consumeTeams` (`:318`), `recordResult` (`:359`), `saveSquadFromSplit` (`:365`),
`reSplitSquad` (`:381`), `useSquadInTournament` (`:395`), `newTournamentFromSquad` (`:399`),
`undoLastResult` (`:404`), plus `MatchSetup` (`:81-87`) and `toggleId` (`:89`). Nothing tests
the persistence rule.

**1. `src/shell/useSplitFlow.ts`** — frozen by `contracts.md`:

```ts
export type SplitSource = "ad-hoc" | "tournament" | "session" | "squad";

/** Whether a mutation in the split flow persists, by source (FLOW §2 rules 3–4, ADR-0004). */
export function splitFlowRule(source: SplitSource): {
  persistsSession: boolean;   // true only for "ad-hoc"
  submitsTournament: boolean; // true only for "tournament"
  isSynthetic: boolean;       // true for "session" | "squad"
};

/** The pool a re-roll may draw from: the session's own pool, not the current teams. */
export function rerollPool(
  source: SplitSource, sessionPoolPlayerIds: Id[] | null, currentTeams: TeamAssignment[],
): Id[];
```

`splitFlowRule` returns `{ true, false, false }` for `ad-hoc`, `{ false, true, false }` for
`tournament`, `{ false, false, true }` for both `session` and `squad`. Those rows replace the
three inline checks above. **`rerollPool` gets its real caller**: `reroll` (`:255-264`) swaps
its inline pool expression for `rerollPool(source, session.poolPlayerIds, result.teams)`.
**Ownership note:** `contracts.md` assigns that file to A (re-roll only) and B (gap copy only);
C touches that one expression and nothing else, and lands after A. Leaving `rerollPool` with no
caller was rejected — this ticket exists to delete exactly that, and `noUnusedLocals` does not
catch an unused export.

The hook owns that state and those handlers, taking navigation primitives and store handles as
dependencies so it re-derives neither. `SplitResult` stays reachable as a plain value —
`SplitScreen` already receives `session.result` and hands it out unaltered
(`onPersistResult(result)`, `onSaveSquad(name, result)`, `onSubmitTournament(result.teams)`) —
so no caller reads hook state to get it, and a share helper takes `(result, discipline, roster)`
as props.

**`consumeTeams`' guard is contractual** and is preserved character-for-character, message
included (`src/App.tsx:325-335`): Swiss needs `n >= 2 && n % 2 === 0`; single-elim needs
`n === 2 || n === 4 || n === 8`; series needs `n === 2`; a violation notifies
`` `Could not save: a ${tournament.format} bracket needs a supported number of teams (got ${n}).` ``
and builds no bracket. **Phase D's D35 edits this guard** (in this hook), together with
`getValidTeamCounts` in `src/tournament/tournament-validation.ts`.

**2–5. Four more files.** The flow alone does not get `App.tsx` under 400 — the roster hub is
162 lines of JSX (the empty state at `:1090` and the "Split match" CTA at `:1152` are inside it, but
the CTA sits past `:1137`, so **take both anchors, not one range**) and the chrome is another 147
(`:777-922`) plus nav and toasts
(`:1257-1279`). So:

- **`src/shell/RosterScreen.tsx`** — the roster hub's markup, moved verbatim: filter chips, the
  `+ Add Player` / `Import players` / `Export` toolbar, the hidden file input, the player list
  with its bib stripes, both empty states, the "Split match" CTA. **Phase D's D34/D36 extend
  this file**; the import I/O stays in `src/App.tsx` at first (C27 then moves it to
  `usePlayerImport`), because it needs the store handles and the active community.
- **`src/shell/AppChrome.tsx`** — rail, topbar (community switcher with its delete confirm, ✚,
  settings popover), the `.toast-container` (`aria-live="polite"`, unchanged) and the bottom
  nav, moved from `:777-922` and `:1257-1279`. It **owns its own transient chrome state** — the
  open menu, the settings popover, the add-community form and the community-name input —
  because nothing outside the chrome reads those four (`showCommunityMenu` is read at `:840`,
  `:864`, `:867`). That is what keeps `App.tsx`'s hook count honest instead of relocated.
- **`src/shell/usePreferences.ts`** — `useStoredPref` (`:93-110`) and `useMediaQuery`
  (`:112-121`), moved unchanged.
- **`src/shell/useToasts.ts`** and **`src/ui/Toasts.tsx`** — the toast state (`:162-171`) and
  its renderer (`:1257-1262`), moved verbatim, keeping today's behaviour exactly
  (`crypto.randomUUID()` id, appended, removed after 3000 ms) and becoming `useCallback`-stable
  for C27. This is the shared toast seam Phase D's share sheet calls.

**Guarded by the e2e suite, no spec edited.** `e2e/tests/squads/saved-squad.spec.ts` exercises
this flow end to end (save from split → list → use in tournament) and is the real acceptance
test. `.scratch/app-correctness/01` and `02` both edit code inside this flow and must already
have landed, or the extraction moves the very lines they patched.

**Acceptance criteria:**
- [ ] `wc -l src/App.tsx` is **less than 400**, measured with `wc -l` (`contracts.md` and the roadmap both state this target)
- [ ] `grep -rn 'source === "ad-hoc"\|source === "tournament"' src/App.tsx` returns nothing — every `ad-hoc` / `tournament` / `session` / `squad` branch goes through `splitFlowRule`
- [ ] `src/shell/split-flow.test.ts` passes and covers: `splitFlowRule` for all four sources; `rerollPool` returning the session pool when supplied; `rerollPool` returning the flattened current teams when the session pool is `null` or empty; `rerollPool` including a player who is in no current team (the sat-out case A03 guards)
- [ ] `consumeTeams` still refuses an illegal team count with the same message, for Swiss even ≥ 2, single-elim 2/4/8 and series 2
- [ ] The browser suite passes with `git diff --stat e2e/tests` empty — `saved-squad.spec.ts` is the acceptance test
- [ ] `grep -c "useState(" src/App.tsx` → **4**: the leftover state is `tournamentPrefill`, `filterIds`, `editingPlayer`, `downloadingId`. No `View`, `HubMode` or `NAV_ITEMS` is declared in the file.
- [ ] `src/session/SplitScreen.tsx` changes exactly one expression (the `reroll` pool) — `git diff --numstat src/session/SplitScreen.tsx` shows one added and one removed line
- [ ] `src/shell/useToasts.ts` exports `useToasts` and `src/ui/Toasts.tsx` renders the unchanged `.toast-container` markup; `grep -rn "toast-container" src/` names exactly one file

**Blocked by:** 24, 25 — same file, and each must land green before the next begins.

## Comments

**Status re-checked 2026-09-30 against `feature/revamp` — partial. Status left
`ready-for-agent`, and this is the one ticket in 13-37 where a `resolved` stamp would be actively
harmful.**

**Shipped, verified:** `src/shell/useSplitFlow.ts` exports `splitFlowRule` (`:31`) and `rerollPool`
(`:51`), and `rerollPool` has a real production caller at `src/session/SplitScreen.tsx:299` — which
was this ticket's own stated reason for existing. `grep 'source === "ad-hoc"\|source ===
"tournament"' src/App.tsx` returns nothing, so every source branch goes through `splitFlowRule`.
`RosterScreen.tsx`, `AppChrome.tsx`, `usePreferences.ts`, `useToasts.ts` and `ui/Toasts.tsx` all
exist, `toast-container` is named in exactly one file, and `src/App.tsx` holds exactly the four
`useState` calls this ticket names. The `consumeTeams` guard is preserved character-for-character
including its message, now as `bracketSupports` (`useSplitFlow.ts:76-81,277`) with the round-robin
arm ticket 35 added later.

**Not shipped, verified: the headline target.** The first acceptance row is
`wc -l src/App.tsx` is **less than 400**, measured with `wc -l`. It is **514**. The phase ledger
records the shortfall as a deliberate, reasoned decision rather than an oversight —
`.superpowers/sdd/2026-09-17-shell-and-structure/progress.md:609` ("`src/App.tsx` 600 -> 478. The
under-400 goal was NOT met, and that is reported rather than chased") and `:634` ("Ruling: accept
478 and record the shortfall; the closing extraction is not added here"). The file has since grown
to 514 on Phase D's work.

**Why the shortfall is not being resolved away.** `contracts.md:180` and the roadmap state the same
under-400 target, so this is a real unclosed acceptance row and not a stale number in one ticket.
But the ledger's own reason for not chasing it still stands: the remaining structural lines sit in
a 161-line handler block, and scoping a task to "close 114 lines" would over-scope it into a much
larger refactor than the residual justifies. That judgement has not been made, and it is not this
task's to make — `src/App.tsx` is untouched by this re-check.

## Re-checked 2026-10-01 — the rule, and the row that is still open

Run against the tree at `3297156`, every row re-read rather than taken from the entry above.

**The named rule is real, exported, and pinned.** `src/shell/useSplitFlow.ts:31` exports
`splitFlowRule`; its truth table is asserted for **all four** sources in
`src/shell/split-flow.test.ts:14-28` — ad-hoc `{true,false,false}`, tournament `{false,true,false}`,
session and squad `{false,false,true}` — plus `:30-36` asserts exactly one flag is true per source,
which is the invariant the ticket's own wording implies and which no single row can check.
`rerollPool` is at `:51` and **has a real production caller** at `src/session/SplitScreen.tsx:326`,
which was this ticket's own stated reason for existing.

**The other seven rows hold.**

| Row | Measured |
|---|---|
| `grep 'source === "ad-hoc"\|source === "tournament"' src/App.tsx` | no output |
| `rerollPool` returning the session pool when supplied | `split-flow.test.ts:41` |
| …returning flattened teams when the pool is `null` or empty | `:53`, `:56` |
| …including a player in no current team (the sat-out case) | `:45`, asserts the pool contains `p7` |
| `consumeTeams` refuses an illegal count, same message | `useSplitFlow.ts:276-279`, message byte-identical to `src/App.tsx:325-335`; arms at `:76-81` |
| the five extracted files exist; `toast-container` named in one file | `RosterScreen.tsx`, `AppChrome.tsx`, `usePreferences.ts`, `useToasts.ts`, `ui/Toasts.tsx`; `grep -rl toast-container src/` → `src/ui/Toasts.tsx` **and** `src/index.css`, so the row is off by one file — the stylesheet, which the ticket did not anticipate when it said "exactly one file" |
| no `View`, `HubMode` or `NAV_ITEMS` in `App.tsx` | none |

**Two of the ticket's own rows are stale and are corrected here rather than left to be re-failed.**

- **`grep -c "useState(" src/App.tsx` → 4** is **now 4 again after being wrong**: the file holds
  `tournamentPrefill` (`:50`), `filterIds` (`:51`), `editingPlayer` (`:56`) and `downloadingId`
  (`:296`) — the four this row names, all of them still present. It was briefly reported as 0 by a
  grep for `useState(` alone, which misses the four calls that write `useState<T>(`; the row is
  right and the check was wrong.
- **`git diff --numstat src/session/SplitScreen.tsx` shows one added and one removed line** is no
  longer true and never will be again: `36d32b6` predates this ticket, and `eab22bf` (swap mode's
  entry point) plus `3297156` have since added to the file. **The row has been satisfied by a
  history it cannot see.** What it was really protecting — that this ticket moved the `reroll` pool
  expression and nothing else — is true and is now what the row should say.

**The headline row is still unmet, and it is the reason this stays open.** `wc -l src/App.tsx` is
**513**, against a criterion of under 400. That is the same number the entry above recorded (514,
before Phase D's own last line landed) and the same shortfall the phase ledger ruled on
(`.superpowers/sdd/2026-09-17-shell-and-structure/progress.md:609`: "The under-400 goal was NOT met,
and that is reported rather than chased"). It has since grown by Phase D's storage carve-out —
`git diff --numstat 1bcce41 HEAD -- src/App.tsx` is **+41 / −1**, so 473 + 40 = 513 — and Phase C
had already ended at 473, which is **73 over on its own**.

**Why this is not being resolved by closing the ticket.** `contracts.md:180` and this roadmap both
state the under-400 target, so it is one unclosed acceptance row shared by three documents, not a
stale number in one file. The ledger's reason for not chasing it still stands — the remaining
structural lines sit in a 161-line handler block, and scoping a task to "close 113 lines" would
over-scope it into a larger refactor than the residual justifies. **That judgement is the owner's
and has not been made.** This ticket stays open with the rule shipped and the number unmet, which
is the only reading of its acceptance list that is true.
