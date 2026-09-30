# 37: Make the split defensible in words

**Status:** resolved

**What to build:** The split screen answers the question the organizer is actually asked — *why
are these teams fair?* — with one plain sentence built from the real numbers on screen: the
range every team's average falls inside, and the strongest player on one side set against the
weakest on the other. It complements, and never contradicts, the provenance qualifier the split
already carries.

**Evidence.** The screen shows the numbers and never explains them. `src/session/SplitScreen.tsx`
renders `Gap 0.4. <span className="fine">Team A leads.</span>` (`:339`) and a `.tag.tag-gap`
reading `OK` when `gap <= 0.1` (`:326`), and `displayFlags` falls back to
`["All roles covered. Fair game."]` when balanced and no flags fired (`:224-225`). So on a
balanced 4-team night the only language on screen is *"All roles covered. Fair game."* — and on
an unbalanced one there is no language at all, just a number. Nothing anywhere says what the
gap measures or why a small one means the teams are even.

Everything the sentence needs already exists and is already computed in the component:
`TeamAssignment.avgStrength` and `.index`, `TeamAssignment.slots[].playerId`, and
`strengthOf(player, discipline): number | null` (`src/session/flow.ts:29`).
`src/session/SplitScreen.tsx:31-35`'s `strengthFromRatings` is the same read on the view side.
`describeFlags` (`src/session/flow.ts:34`) is the existing referee-voice mechanism — this
ticket adds to that vocabulary rather than inventing a panel.

**Where the module lives.** `contracts.md` grants Phase D `src/share/**` as its only new
directory and leaves new files under `src/session/**` unclaimed, so the explainer goes in
`src/share/fairness.ts`. The name is a little broad for a presentational helper; if the
contract is amended in wave 2 the better home is `src/session/fairness.ts`, which would be a
rename of one import specifier and nothing else. This ticket does not rename it unilaterally.

**Boundary with B13 — do not blur it.** Phase B's B13 owns *"is this proven?"*: it
adds the qualifier `Best gap found.` when `gapKind(result) === "best-found"` and `null` when
proven, inside the same `.readout`/`.fine` element this ticket sits beside
(`src/session/gapProvenance.ts`, exported `GapKind`, `gapKind`, `gapQualifier`). This ticket
owns *"why is this fair?"* — what the number means and where the strength sits. **Its copy must
not restate or contradict a provenance word**: no "proven", no "best found", no "exact", no
"minimum", no "search". Those words belong to B13 and appear once. Import
`src/session/gapProvenance.ts` only if a branch genuinely needs the verdict; if the sentence is
the same in both cases, do not import it and do not mention provenance at all.

**Acceptance criteria:**
- [ ] `src/share/fairness.ts` (D's own directory) exports `explainFairness(input: { result: SplitResult; discipline: Discipline; roster: Player[] }): { averages: string; trade: string }` — a pure function with no DOM, no React and no solver import.
- [ ] `averages` is exactly `Every team averages {low} to {high}.` where `low` and `high` are the minimum and maximum of `result.teams[].avgStrength` formatted to one decimal place. When they are equal to one decimal place the string is `Every team averages {low}.` A unit test covers both.
- [ ] `trade` names the strongest player on the highest-averaging team and the weakest on the lowest-averaging team, using `teamName(index)` (`src/session/flow.ts:23`) for the labels: `{name} ({v}) is {Team X}'s best; {name} ({v}) is {Team Y}'s weakest.` with both `v` values formatted to one decimal place.
- [ ] Player strength is read through `strengthOf(player, discipline)`; a player whose strength is `null` (no capability in this discipline) is excluded from both the "best" and "weakest" selections, and ties break by the player's position in `result.teams[].slots` order so the output is deterministic. A unit test builds a roster with one capability-less player and asserts that player is never named.
- [ ] With fewer than two teams, or when every team's `slots` contain only capability-less players, `trade` is the empty string and the renderer emits nothing for it. A unit test covers the empty case; no `undefined`, no `NaN`, no `-0.0`.
- [ ] `src/session/SplitScreen.tsx` gains exactly two additive edits: one `import { explainFairness } from "../share/fairness";` line, and one sibling element — `<p className="fairness">` containing `averages` in a `<span className="fine">` and `trade` after it — rendered directly after the existing `.readout` at both live branches (the 2-team pitch at `:135` and the 3+ stack at `:339`). Every existing line in the file is left byte-identical, so B13's qualifier markup and A03's `reroll` edit are untouched. Phase A and Phase B have both landed before D executes (`contracts.md`: A before C, C before D), so this is additive on a quiescent file.
- [ ] The line is present on the 2-team pitch layout and on the 3+ team stack, and absent on the empty state (the `Not enough eligible players` branch at `:353`), which has no teams to explain.
- [ ] The copy contains none of the substrings `proven`, `best gap`, `best-found`, `exact`, `minimum`, `optimal`, `solver`, `search`, `node`, `heuristic`, `aborted`. Verified by a unit test asserting the returned strings against that list — this is the mechanical guarantee that D37 does not duplicate or contradict B13.
- [ ] The copy contains no em-dash (`DESIGN.md` bans em-dashes in visible copy, as B13 records). Verified in the same unit test.
- [ ] `.fairness` is styled by reusing the existing vocabulary — `src/index.css`'s `.readout` context (`:2142`) and `.readout .fine` (`:2149`, Familjen Grotesk 13 px, opacity 0.8) — with at most a `text-align: center` and a margin rule added. No new colour, no new token, no new component.
- [ ] The landing hero does not gain the line: `src/landing.tsx` renders `SplitScreen` at `:153` with no `share` prop and this ticket adds no prop, so nothing changes there. `e2e/tests/landing/landing.spec.ts:31-38` and the 390×844 overflow assertion at `:157-164` must stay green unchanged; the hero's horizontal overflow stays `0`.
- [ ] `scripts/capture-hero.mjs` still passes its own DOM verification (`npm run build && npm run preview`, then `node scripts/capture-hero.mjs`): the `.readout` text it reads at `:209` may now include the new sentence, so the script's font, overflow and non-blank pixel checks must still pass — and if it compares `.readout` text to an exact expected string, that constant is updated in the same change and the reason is stated.
- [ ] A new e2e spec on a seeded split asserts `.fairness` is visible, contains `Every team averages`, and contains no substring from the banned list above.
- [ ] `npx vitest run` exits 0 with `src/share/fairness.test.ts` in the output; `npx tsc -b` exits 0.

**Blocked by:** 13 (B13's `gapProvenance.ts` and its `.readout` copy must exist first, so this ticket's line lands beside a settled readout rather than racing it)

## Comments

**Status re-checked 2026-09-30 against `feature/revamp` — shipped. The split screen now explains
the number, at both layouts, without restating or contradicting the provenance qualifier.**

`src/share/fairness.ts:47` exports `explainFairness` as a pure function returning
`{ averages, trade }`, at the path `contracts.md` grants this phase. `averages` is
`Every team averages {low} to {high}.` with the single-value collapse to `Every team averages {low}.`
at `:54`, and `trade` names the strongest player on the highest-averaging team against the weakest
on the lowest (`:76`) using `teamName(index)`. Strength is read through the flow helper, and a
player with no capability in the discipline is excluded from both selections — the ticket's
determinism and exclusion rules are in the module, not just intended.

**Both live branches render it**, which was the ticket's sharpest requirement: `FairnessLine` is a
component at `src/session/SplitScreen.tsx:132` and is rendered at `:181` (the 2-team pitch, directly
after the `.readout`) and `:403` (the 3+ stack, under its own readout). The component returns `null`
when there is no band to report, so the empty state renders nothing rather than a placeholder.

**The boundary with ticket 13 held, and the em-dash ban held.** The line imports only
`../share/fairness` and not `gapProvenance` — the two surfaces cannot disagree because neither
re-derives the other's claim. `e2e/tests/split/fairness.spec.ts` has 5 cases including one that
asserts the copy contains none of the banned provenance words, one for the even-split
single-sentence form, one for the 3+ site, and one that the landing hero shows the line without
overflowing.
