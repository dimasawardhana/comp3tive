# 02: Resolve the remaining failing assertions

**Status:** ready-for-agent

**What to build:** The two e2e failures that are not caused by the rail each stop encoding markup that no longer exists — one by asserting the accessible name the app actually publishes, the other by asserting the behaviour that still matters instead of a CSS property that was removed.

**Evidence.** Both failures reproduce on their own (audit findings, 2026-09-17), after the layout root cause is set aside.

**Root cause 2 — an assertion about an attribute that was never added.** `e2e/tests/dashboard/dashboard.spec.ts:143`:

```
Error: expect(locator).toHaveAttribute(expected) failed
Locator:  locator('.bottom-nav .nav-link').first()
Expected: "Roster"
Received: ""
```

`src/App.tsx:1264-1276` renders nav buttons with a `nav-icon` span marked `aria-hidden="true"` and a visible label span; **no `aria-label` exists**. The spec's own comment says it asserts "the accessible slot labels (aria-labels) instead of rendered text", but nothing ever added them. The app is correct — the accessible name already comes from the visible text, which is the right accessible name — and the assertion is wrong.

**Root cause 3 — a layout that was deleted.** `e2e/tests/panel/no-overlap.spec.ts:35`:

```
Error: expect(received).toBeGreaterThanOrEqual(expected)
Expected: >= 64
Received:    0
```

The spec asserts `.app` has `padding-bottom >= 64px` to clear a **fixed** bottom nav. `grep -n "padding-bottom" src/index.css` returns only 10px/8px/12px values on inner elements — there is no `.app` rule at all. The bar became `position: sticky` (`src/index.css:687`), so the padding is unnecessary. The assertion encodes a layout that no longer exists.

**Acceptance criteria:**
- [ ] **Decided: do not add `aria-label` to the nav buttons.** The suite is not made green by shipping redundant markup; the spec is changed to assert the accessible name (see `hubButton`, `.scratch/debt/issues/01`)
- [ ] `dashboard.spec.ts:132-149` asserts each of the five hub names resolves and is visible via `hubButton`, and that `Home` carries `aria-current="page"` on a fresh load — no `toHaveAttribute("aria-label", …)` remains
- [ ] That spec's title drops the "centered Home tab" claim, which `1702342` reversed (Home is now first in `NAV_ITEMS`); the title states the five-tab layout
- [ ] **Decided: delete the `.app` `padding-bottom` assertion and replace it with the assertion that still matters** — after scrolling the last roster row into view, its bottom edge is at or above the sticky bottom bar's top edge
- [ ] `panel/no-overlap.spec.ts` pins 390×844 (the bar is its subject), asserts `.bottom-nav` computes to `position: sticky` (not `"fixed"`), keeps the sticky-topbar assertion, and updates its title and header comment from "fixed nav" to "sticky nav"
- [ ] `settings-panel/viewport.spec.ts` pins 390×844 and asserts the same sticky-position contract for the bar it measures
- [ ] `npx playwright test --config=e2e/playwright.config.ts` reports no remaining `toHaveAttribute("aria-label"…)` or `padding-bottom` failure, with no other assertion weakened

**Blocked by:** 01 — both fixed assertions use `hubButton`, and the two specs that pin 390×844 pin it through the same helper the re-anchor introduces (`.scratch/debt/issues/01`)
