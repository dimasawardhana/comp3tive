# 07 — The split and tournament flow moves out of the shell

> **Superseded.** The live copy of this ticket is
> [`debt/26`](../../debt/issues/26-the-flow-moves-out-of-the-shell.md). This file is history; see
> [`.scratch/app-health/README.md`](../README.md) for the pairing of all sixteen.

**What to build:** The rule that decides whether an edit is saved — *whether a mutation persists
depends on where the split was entered from* — is testable on its own instead of being implied by
which callbacks a screen happened to be handed. `App.tsx` lands under 400 lines.

**Evidence.** The same `SplitScreen` serves four entry points (`ad-hoc`, `tournament`, `session`,
`squad`), and whether a mutation persists depends on the source:

- `ad-hoc` writes each edit to the Session log
- `tournament` submits into the bracket
- `session` and `squad` persist nothing — they are synthetic

That is documented in `docs/FLOW.md` §2 rules 3–4 and in ADR-0004, and the flow's handlers
(`split`, `consumeTeams`, `recordResult`, `commit`/`onPersistResult`, `reSplitSquad`,
`saveSquadFromSplit`, `useSquadInTournament`) all live inline in `src/App.tsx`, alongside fifteen
state hooks and nine inline view modes. It is called the single most subtle rule in the codebase by
the analysis, and nothing tests it.

**Blocked by:** 05. Same file as 06 — run them in sequence, not in parallel.

**Status:** ready-for-agent

- [ ] A `useSplitFlow` hook (or equivalent) owns `split`, `consumeTeams`, result persistence, and the
      squad save/re-split path
- [ ] The persistence rule has tests at the hook level for **all four** sources — including the two
      that persist nothing, which are the ones a regression would silently break
- [ ] `consumeTeams`'s bracket-count guard (Swiss even ≥2; single-elim 2/4/8; series 2) still refuses
      an illegal team count with the same message
- [ ] `src/App.tsx` is under 400 lines and renders screens from a switch
- [ ] The whole Playwright suite passes with no spec edited — `saved-squad.spec.ts` is the spec that
      exercises this flow end to end and is the real acceptance test

**Design reference:** `docs/FLOW.md` §2 rules 3–4 and `docs/adr/0004-origin-aware-navigation.md`.
Both state the rule normatively; the code must keep matching them.

**Notes:** This is the last and largest extraction, and the one where behaviour is most tempting to
tidy. Don't: the four persistence paths are contractual. If a path looks wrong, that is a ticket.

`.scratch/app-correctness/01` and `02` both edit code inside this flow (Re-roll's pool rebuild, and
the deleted-row handlers). Land them **before** this ticket, or the extraction will move the very
lines they are patching.

## Comments

**Re-checked 2026-10-01 against `d98b95c`, against this ticket's own acceptance rows rather than
against debt 26's status — PARTIAL. Status left `ready-for-agent`, and this is the one ticket in
this directory where a `resolved` stamp would be actively harmful.**

This ticket's own evidence sentence names the shortfall twice: *"`App.tsx` lands under 400
lines"*, and row 4, *"`src/App.tsx` is under 400 lines and renders screens from a switch."* The
second half of row 4 shipped. The first half did not.

**Shipped, verified:**

- `src/shell/useSplitFlow.ts` (420 lines) owns the flow. `split` at `:233`, `consumeTeams` at
  `:266`, `recordResult` at `:305`, `undoLastResult` at `:314`, `reSplitSquad` at `:377`, and
  `saveSquadFromSplit` / `useSquadInTournament` alongside them — `src/App.tsx:193-198` only
  destructures them back out and `:503-508` hands them to the switch.
- The persistence rule is one named, exported, pure function: `splitFlowRule` at
  `src/shell/useSplitFlow.ts:31`, and `grep 'source === "ad-hoc"\|source === "tournament"'
  src/App.tsx` returns nothing — every source branch goes through it.
- Row 2's tests exist for **all four** sources, including the two that persist nothing:
  `src/shell/split-flow.test.ts:16-33` pins the whole truth table, and a fifth case asserts each
  source has exactly one true flag.
- Row 3 holds. The bracket-count guard is `bracketSupports` (`src/shell/useSplitFlow.ts:76`,
  called at `:276`) and it refuses an unsupported count with a message rather than letting
  `buildBracket` fail — single-elim 2/4/8, series 2, Swiss even, round robin 3-8, the last arm
  added with the format.
- Row 4's second clause holds: `src/shell/ScreenSwitch.tsx` renders the screens from a switch,
  and every prop across that boundary is required (`ScreenSwitch.tsx:29-40`).

**Not shipped, verified: the headline row.** `wc -l src/App.tsx` is **514**, against an
acceptance row of *under 400*. It was 1,280 when this ticket was written, so this is 766 lines of
real progress that stopped short of the line this ticket drew.

**Why it is not being closed.** debt 26 reached the same verdict on 2026-09-30 and left itself
`ready-for-agent` for the same reason, so this copy inherits that rather than inventing a second
opinion: the residual sits in a ~160-line handler block, and scoping a task to "close 114 lines"
is a different and larger piece of work than the shortfall looks. That is a decision for whoever
owns it, and `docs/ROADMAP.md` is the place it belongs — not a status line written by a ticket
hygiene pass.

**Not verified here, and not claimed:** row 5, "the whole Playwright suite passes with no spec
edited". `e2e/tests/squads/saved-squad.spec.ts` is the spec this ticket names as its real
acceptance test, and it was not run.
