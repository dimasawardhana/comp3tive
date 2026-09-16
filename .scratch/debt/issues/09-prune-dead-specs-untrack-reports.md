# 09: Prune the specs that assert nothing; untrack the reports

**Status:** ready-for-agent

**What to build:** Remove the committed debugging leftovers from the browser suite so a green run means something, and stop tracking build output in git.

**Evidence (absorbed from `.scratch/app-correctness/issues/05`).**

| Spec | Lines | `expect(` count | What it does |
|---|---|---|---|
| `e2e/tests/tournament/inspect.spec.ts` | 41 | 2 (both `.app` visible / setup) | `console.log`s the page HTML and the button list |
| `e2e/tests/tournament/inspect2.spec.ts` | 39 | 2 | Same |
| `e2e/tests/tournament/inspect3.spec.ts` | 67 | 3 | Same, and it mutates IndexedDB by hand to fabricate state |
| `e2e/tests/tournament/review.spec.ts` | 13 | 1 | `test.skip`, comment: "verified by the build and by manual testing" |
| `e2e/tests/tournament/journey.spec.ts` | 41 | 4 | Creates four players with **no capabilities**, screenshots to `/tmp`, asserts a modal opened and closed |

`e2e/pages/base.page.ts` and `e2e/pages/split.page.ts` have **zero consumers**: `grep -rn "base.page\|split.page\|BasePage\|SplitPage" e2e/tests/` finds nothing, and `SplitPage` is imported only by itself.

`playwright-report/index.html` (**517,543 bytes**) and `test-results/.last-run.json` are **tracked in git** (`git ls-files` lists both). `.gitignore` contains only `node_modules/`, `dist/`, `*.tsbuildinfo`, `.DS_Store`.

One more trivially-passing assertion, same family: `e2e/tests/landing/landing.spec.ts:34` asserts `page.locator(".tabbar")` has count 0. `.tabbar` exists nowhere — a scan of every `locator("…")` class in `e2e/**` against `src/**/*.tsx` + both HTML documents leaves exactly two classes with no counterpart in markup, `tabbar` and `tournament-header` — so the line passes no matter what, and the `#root` and `.app` count-0 assertions on the two lines above it already prove the point.

**Acceptance criteria:**
- [ ] `inspect.spec.ts`, `inspect2.spec.ts`, `inspect3.spec.ts` are deleted
- [ ] `review.spec.ts` is **deleted, not implemented** — decided: a skipped placeholder claiming coverage is worse than a documented gap, and the panel's observable seam is covered indirectly by `saved-squad.spec.ts:97`, which asserts that consuming a saved squad builds a bracket (`ReviewPanel` renders when `tournament.teams.length > 0 && tournament.matches.every(m => m.games.length === 0)`, `src/tournament/TournamentScreen.tsx:246`). `ReviewPanel` itself stays in the product
- [ ] `journey.spec.ts` is deleted — `saved-squad.spec.ts` already covers create → split → submit → bracket with real capabilities, and nothing else in the suite runs the journey this file was named for
- [ ] `e2e/pages/` is deleted (both files have no consumers)
- [ ] `e2e/tests/landing/landing.spec.ts:34`'s `.tabbar` assertion is deleted; the neighbouring `#root` and `.app` assertions stay
- [ ] `git rm --cached playwright-report/index.html test-results/.last-run.json` runs; both files stay on disk and are untracked afterwards, verified with `git ls-files | grep -E 'playwright-report|test-results'` returning nothing
- [ ] `.gitignore` gains `playwright-report/` and `test-results/` with a one-line comment explaining they are regenerated locally
- [ ] `npx playwright test --config=e2e/playwright.config.ts` is green with 5 fewer spec files and **no** remaining spec that passes without asserting a behaviour — each remaining spec asserts something a real defect could break

**Blocked by:** 01 and 02 — deleting files before the re-anchor would leave the suite red with no way to tell whether the deletion or the anchor caused it

**Notes:** Deliberately separate from the docs reconciliation (Phase B16) and from the Landing Page work. The `dashboard.spec.ts` seeding pattern is the model worth keeping, and it is generalised by ticket 11 rather than removed here.
