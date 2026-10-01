# 41: The settings popover's trigger does not say whether it is open

**Status:** ready-for-agent
**Found:** 2026-10-01, while removing `AppChrome`'s dead `showAddCommunity` prop.

## The defect

`src/shell/AppChrome.tsx:163-172` — the ⚙ trigger:

```tsx
<div className="settings-trigger">
  <button
    type="button"
    className="icon-btn"
    aria-label="Settings"
    title="Settings"
    onClick={() => setShowSettings((s) => !s)}
  >
```

**No `aria-expanded`.** The popover it opens is `role="dialog"` with `aria-label="Settings"`
(`:174`), rendered under `{showSettings && (`, and the state is the chrome's own: declared at
`:44`, written in exactly one place, read in exactly one place (`:173`). **The chrome owns this
open state completely** — the same sentence its own header comment already makes about the two
menus it owns (`:37-40`: "It owns the two menus that open and close inside the chrome itself —
the community menu and the settings popover — and nothing outside the chrome reads either").

A screen-reader user pressing ⚙ is told a dialog appeared and gets no state back on the button they
pressed, so they cannot tell an open popover from a closed one without hunting for it.

**The same file uses the attribute correctly, twice, for other controls:**

- `:81` — the rail toggle, `aria-expanded={railPref === "expanded"}`.
- `:105` — the community switcher, `aria-expanded={showCommunityMenu}`.

`:81` and `:105` are both booleans the chrome itself holds and toggles itself, which is precisely
this trigger's situation. The omission is not a policy of the file; it is a gap in it.

## Why this was found while doing something else, and why it was left alone then

`3297156` removed the dead `AppChrome.showAddCommunity` prop. Its removal **invited** a wrong
`aria-expanded` on the **✚** button at `:154-162`: that button's `aria-expanded` was tempting
because it opens a form — but the form's visibility is **App's**, not the chrome's
(`src/App.tsx`, the `<AddCommunityForm>` gate), and the chrome never learns the answer. Writing
`aria-expanded` there would be a false claim to a screen reader.

That is exactly what happened to it: the prop's own doc line said *"this is why the button carries
no `aria-expanded`"* (now at `:19-25`, attached to `onToggleAddCommunity`). The reasoning is right
and the note is right, and **neither has anything to say about ⚙.** ⚙ is the opposite case — the
chrome owns that state — so the two controls belong in different tickets, and a fix delivered under
the ✚ finding's name would have been fixed for the wrong reason and left the real gap behind.

**Do not add `aria-expanded` to the ✚ button.** If a future change moves the form's visibility into
the chrome, that is when it earns one, and it is a different ticket with a different proof.

## Evidence

- `src/shell/AppChrome.tsx:163-172` — the trigger, carrying `aria-label` and `title` and no
  `aria-expanded`.
- `src/shell/AppChrome.tsx:44` — `const [showSettings, setShowSettings] = useState(false)`, the
  chrome's own state.
- `src/shell/AppChrome.tsx:173-174` — the popover it gates, `role="dialog"`.
- `src/shell/AppChrome.tsx:81` and `:105` — the two correct uses in the same file.
- `src/shell/AppChrome.tsx:19-25` — the note explaining why ✚ has none. Read it so this fix does
  not get read as contradicting it.
- `e2e/tests/settings-panel/settings.spec.ts:19` — `page.getByTitle("Settings")`. The spec finds
  the trigger by title and opens the panel; **it never asks the button what state it is in**, which
  is why nothing fails today.

## Acceptance

- **`⚙` carries `aria-expanded`, reflecting the state the chrome already holds.** `true` when the
  popover is rendered, `false` when it is not, from `showSettings` itself — not from a second
  piece of state, and not inverted.
- **The ✚ button is unchanged.** It keeps no `aria-expanded`, and the note at `:19-25` stays. A
  fix here that touches ✚ is a fix for the wrong control.
- **A test asserts both states, not one.** The interesting half is `false`: a closed popover whose
  trigger still announces itself as open is the failure a one-sided test misses. The existing
  settings spec is the right home — it already opens the panel at `:19` — and the assertion belongs
  on the button it already holds a handle to.
- **The community switcher (`:105`) and the rail toggle (`:81`) are untouched.** Both are already
  correct and neither is part of this defect.
- **No visual or behavioural change.** The popover still opens on click, still renders the same
  `.settings-popover` markup, and `.icon-btn` is unchanged. This is an attribute and a test.

**Not verified here.** No browser run, per the assignment's constraints. The defect is read off the
markup: the attribute is absent at `:163-172` while the two sibling controls carry it, which is a
fact about the source rather than about a screen reader's behaviour.