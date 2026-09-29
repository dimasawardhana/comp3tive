/**
 * The shared guard on this phase's durability copy, imported by the two screen
 * tests that render it (`DashboardScreen.nudge.test.ts` and
 * `RosterScreen.durability.test.ts`) and applied to every sentence both
 * surfaces can produce.
 *
 * It is a module rather than a constant in each test because a ban duplicated
 * across two files is two bans: the next person adds a fifth sentence, guards
 * it with the copy in front of them, and the other file is left unguarded. This
 * file is the one place the rule is written, and the vitest include glob (which
 * matches only `.test.ts` under `src`) means it is never collected as a test.

 * **Why this is a directory and not a file beside the tests — do not collapse
 * it.** The obvious tidier is to move the two exports into one of the two
 * `.test.ts` files and import them from the other. That does not work, and the
 * failure is silent and confusing rather than loud: importing a `.test.ts` from
 * another `.test.ts` executes the imported file's `describe` and `it` calls in
 * the importer's module graph, so vitest collects the donor file's cases a
 * second time under the wrong name and the suite doubles. The double
 * registration is the entire reason this file exists outside the test files.
 * It is invisible from the inside — the code reads like a module that happens
 * to have a folder around it — which is why the reason is written here rather
 * than left to be rediscovered by the next person who tidies.
 *
 * **Why `protect` is on the list even though the product is entitled to the
 * word.** The unknown line used to read "Storage protection unknown in this
 * browser" — a phrase that is true and harmless, and that this very ban
 * refused to pass. That is the reason to widen the ban deliberately instead of
 * quietly carving an exception: a safety ban which fails on a harmless word
 * gets deleted by the first person who needs a harmless word, and a deleted ban
 * protects nothing. The copy was changed to fit the rule rather than the rule
 * loosened to fit the copy, because the rule is the thing worth keeping.
 */

/** Words that would turn a measurement into a promise. */
export const SAFETY_BAN = /safe|protect|guarantee|secure|never lose/i;

/**
 * Predictions about loss. Only the refusal line is held to this: a line that
 * says the data "is not stored persistently" is true, and the same line saying
 * it "will be deleted" is a forecast nobody made and no test can keep honest.
 */
export const PREDICTS_LOSS = /\bwill\b|lose|lost|delete/i;
