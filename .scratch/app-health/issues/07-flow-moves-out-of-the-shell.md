# 07 — The split and tournament flow moves out of the shell

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
