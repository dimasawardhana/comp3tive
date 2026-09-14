# 05: Prune the e2e specs that assert nothing

**What to build:** Remove the committed debugging leftovers from the e2e suite so a green run means something, and so the suite is faster and honest about its own coverage.

- `e2e/tests/tournament/inspect.spec.ts`, `inspect2.spec.ts`, `inspect3.spec.ts` — 147 lines that `console.log` page HTML and button lists. **They contain no assertions at all**, so they cannot fail. `inspect3` also mutates IndexedDB by hand to fabricate a state.
- `e2e/tests/tournament/review.spec.ts` — `test.skip`, with a comment stating the review panel is "verified by the build and by manual testing". Either write the test or delete the file; a skipped placeholder claiming coverage is worse than a documented gap.
- `e2e/tests/tournament/journey.spec.ts` — creates four players with **no capabilities**, notes in a comment that the split will show "no eligible", screenshots to `/tmp`, and asserts only that a modal opened and closed. It does not test the journey it is named for.
- `e2e/pages/base.page.ts` and `e2e/pages/split.page.ts` — no spec imports either; `SplitPage` is imported only by itself. Two page objects, zero consumers.
- `test-results/` and `playwright-report/` are **tracked in git** (28 files, including a 507 KB HTML report). Untrack them and extend `.gitignore`.

**Blocked by:** —

**Status:** open

- [ ] The three `inspect*.spec.ts` files are deleted
- [ ] `review.spec.ts` is either implemented (a real review-panel assertion) or deleted — not left skipped
- [ ] `journey.spec.ts` either exercises create → split → submit with eligible players, or is deleted in favour of the coverage `saved-squad.spec.ts` already provides
- [ ] `e2e/pages/` is deleted if still unused after the above
- [ ] `playwright-report/` and `test-results/` are untracked and added to `.gitignore`
- [ ] `npx playwright test` is faster and still green, with the same **real** coverage
- [ ] No remaining spec passes without asserting anything

**Design reference:** none.

**Notes:** Deliberately separate from the docs reconciliation (ticket 06) and from the Landing Page tickets. The `dashboard.spec.ts` seeding pattern is the model worth keeping — it is the only spec that controls its world instead of clicking its way to one.
