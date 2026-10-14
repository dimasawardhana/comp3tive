# 40: Entering swap mode is never announced

**Status:** resolved (2026-10-01)

**Resolved 2026-10-01.** The entry is announced by a sibling that is mounted and empty from the
first render: `<div className="swap-entry-notice" role="status">`, inserted before the banner guard
and rendered unconditionally (`src/session/SplitScreen.tsx:406-410`), carrying one `useState<string>`
that `toggleSwapMode` fills on entry (`:361-365`) and `handlePick` clears (`:316-320`). The authority
is `contracts.md` §5, Day 3, (a) — written before the code, and recording the two places this
ticket's own shape was wrong: the banner could not become the region's parent without nesting two
live regions, and a region carrying the banner's sentence cannot be unhidden without printing it
twice.

**The three collisions, resolved as the ticket predicted.** `.swap-banner` still renders only while
the mode is on and no declaration at `src/split.css:636-651` moved, so
`e2e/tests/split/swap.spec.ts:326` is green **unedited**; the region is visually hidden by a new
`.swap-entry-notice` rule and out of flow, so it takes no part in `.screen`'s `gap` and no bar
measurement moved; and `src/session/SplitScreen.swap-entry.test.ts` carries the two cases the ticket
asked for, **written first and observed failing** — 2 red of 9 — before the region existed.

**The mutation test was not edited and still passes.** `e2e/tests/split/swap.spec.ts:336-383` is
green unchanged, including its `role="status"` assertion on `.swap-banner` itself. The new test
beside it tags the region **before** the tap and asserts the tagged node carries the entry sentence,
then asserts the same tagged node is **empty** after the first card tap — the half that stops this
fix from announcing every later transition twice. The full browser suite is **117 passed, 0 failed**.

**No copy was added**: the region announces the sentence already on screen, which is now defined
once as `SWAP_IDLE` and read by both the banner and the notice.
**Found:** 2026-10-01, while reconciling the records against the code for R2.

## The defect

`role="status"` on the swap banner announces **changes to a live region that is already in the
DOM**. It cannot announce a region being **inserted**. Entering swap mode inserts it.

`src/session/SplitScreen.tsx:392-401`:

```tsx
{swapMode && (
  <div className="swap-banner" role="status">
    ...
      {pick
        ? `Now tap a player on the other team to swap with ${nameOf(roster, pick.playerId)}`
        : "Tap one player on each team to swap them."}
```

`swapMode` flips `false → true` on the `Swap` button (`:513-522` → `toggleSwapMode` at
`:348-351`), so the element is **mounted with its first sentence already inside it**. The mode's
whole instruction — *"Tap one player on each team to swap them."* — is the one a screen-reader
user never hears, and it is the only sentence that tells them what the mode is for.

**Every later transition does work, and the difference is the finding.** Once `swapMode` is true
the element stays mounted and only its child's text mutates: picking a player (`:396-398`) and
completing a swap both rewrite that text inside an existing region. `pick` is state, `swapMode` is
state, and only one of them mounts the element. `role="status"` was added in `3297156` and is
correct exactly where the element survives.

This is the same distinction the bench advisory already had to be taught: its `role="status"` was
**removed** (`src/DashboardScreen.nudge.test.ts:88-100`) because that advisory is also inserted once
with its sentence and never changes afterwards — so there the attribute was inert and misleading.
Here the attribute earns its keep for three transitions and is silently useless for the fourth.

## Evidence

- `src/session/SplitScreen.tsx:392` — the guard that mounts the region.
- `src/session/SplitScreen.tsx:393` — `role="status"` on the mounted region.
- `src/session/SplitScreen.tsx:348-351` — `toggleSwapMode` is what flips the guard.
- `src/session/SplitScreen.tsx:513-522` — the `Swap` ghost, the transition that inserts.
- `e2e/tests/split/swap.spec.ts:336-383` — the passing test. **Its own comment names the
  limitation**: "it is inert when the region is inserted into the DOM with its text already inside
  it". It proves the *mutation* is announced by tagging the node and asserting the tagged node
  holds the new sentence (`:365`, `:372`). It cannot reach the insertion, because by the time it
  runs, the region already exists.

**No test asserts the entry announcement, and one test asserts the opposite DOM shape.**
`e2e/tests/split/swap.spec.ts:326`:

```ts
await expect(page.locator(".swap-banner")).toHaveCount(0);
```

That row is correct today and correct after a fix — but it is a count of `.swap-banner`, so it
constrains where the **styled** banner may live, not where the live region may be mounted. Read it
before choosing a shape: **moving the announcement out of `.swap-banner` is not blocked by it, and
moving the banner itself is.**

## What a fix has to collide with, named before it is attempted

1. **`e2e/tests/split/swap.spec.ts:326`** — count 0 when the mode is off. A permanently-mounted
   live region must not *be* `.swap-banner`, or this row goes red. It must be a sibling that is
   always present and usually empty.
2. **`src/split.css:636`** — `.swap-banner` is a styled hook: `display: flex`, `--whistle` fill,
   12px/16px padding, `--radius-md`, `--font-body`, 14px, weight 600. It is a **banner**, not a
   live region, and it is styled by class in a stylesheet that a caller may not own. A fix that
   keeps `.swap-banner` for the visible banner and adds a separate always-mounted region needs no
   declaration changed; a fix that merges them changes a rendered surface to solve an announcement
   problem.
3. **`contracts.md` §5** holds `src/session/SplitScreen.tsx` at **zero removed lines** (its one
   named exception is the trailing full stop at `:397`). A permanently-mounted region means the
   `{swapMode && (` guard at `:392` loses its wrapper — which is a removed line. **This ticket
   needs its own amendment before any code.**
4. **`src/session/SplitScreen.swap-entry.test.ts`** renders with `renderToStaticMarkup`, which
   renders the **initial** state. It can see whether a live region exists in the bar's markup at
   rest; it cannot drive the mode.

## The failing test is the specification — read it that way

**`src/session/SplitScreen.swap-entry.test.ts` is written to be broken on purpose by whoever fixes
this.** Add the case to that file and it will **fail until the fix lands**. That is the intent, not
a regression to be worked around:

- The file's whole reason to exist is the class of defect where **entering** a state is what is
  untested. Its header (`:11-36`) says so: "the interaction lives in
  `e2e/tests/split/swap.spec.ts`, which enters the mode", and the file pins only what a static
  render can see — "whether a control that turns the mode on is in the bar at all" (`:17-18`).
- A red test in this file after this fix is **the ticket landing**. Report it as the acceptance
  signal, not as a broken build.

Two assertions are wanted, and the second is the one that carries the fix:

1. A live region (`role="status"` / `aria-live="polite"`) exists in the markup **with the mode
   off** — asserted on `bar()`, which is a static render of the initial state. This is the shape a
   permanently-mounted region must have and it fails today.
2. `.swap-banner` is **absent** when the mode is off, so the announcement and the banner are
   separate elements. This pins `:326`'s constraint at the unit level, where the e2e also pins it,
   and it is what stops a fix that solves the announcement by making the banner permanent.

The **browser** half belongs in `e2e/tests/split/swap.spec.ts` beside the existing test at `:336`,
and it is the only place the announcement itself can be observed: tag the always-mounted region
before clicking `Swap`, then assert the tagged node carries the entry sentence. Mirror the method
at `:365`/`:372` — the tag is what proves the region was already there when the text arrived.

## Acceptance

- **A permanently-mounted live region announces the entry.** Asserted in a real browser, by the
  tag-the-node-then-mutate method the existing test already uses, extended to the transition that
  currently inserts.
- **`.swap-banner` is unchanged.** No declaration in `src/split.css` moves, `.swap-banner` still
  renders only while the mode is on, and `e2e/tests/split/swap.spec.ts:326` (count 0 when off)
  stays green without being edited. A banner that is always on screen is not this ticket's fix.
- **The two failing cases land in `src/session/SplitScreen.swap-entry.test.ts` and are left
  failing until the fix is in.** Whoever finishes this must be able to point at a red test that
  means "this ticket", and at the commit that turns it green.
- **The existing mutation assertions keep passing.** `:336-383` must still pass unchanged — the
  mode's *later* transitions were already announced and must not regress.
- **`contracts.md` is amended before the edit.** The guard at `:392` is inside the file's
  zero-removed-lines rule; say what the amendment grants and get it granted first.
- **No copy is added.** The region announces the sentence that is already there. If a fix needs new
  user-visible words to announce an existing state, that is a design change and belongs in its own
  ticket.
- **Nothing else moves.** `swapPlayers`, the two-step pick, `pick`'s clearing, the `!swapMode`
  guards on Back / Save squad / Share / the `Swap` ghost, and the primary's `swapMode ?` branch all
  behave exactly as they do today.

**Not verified here.** No browser run and no build, per the assignment's constraints. That the
announcement does not currently happen is a fact about DOM semantics and the guard at `:392`, not
an observation: nothing in this repo measures it, which is why the defect survived the commit that
added the attribute.