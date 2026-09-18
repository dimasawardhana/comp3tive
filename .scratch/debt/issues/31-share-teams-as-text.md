# 31: Share the result — copy the teams as text

**Status:** ready-for-agent

**What to build:** From the split screen, one control copies the finished teams into the
clipboard as plain text a group chat can read: a headline, a block per team with each
player and their strength, and a closing line that states whether the gap is the proven
minimum or the best gap found. The text is shown in the sheet before it is copied, so the
organizer knows exactly what they are sending, and it is selectable by hand when the
clipboard API is unavailable.

**Evidence.** There is no share surface of any kind today. Measured:

```
$ grep -rn "navigator.clipboard\|window.print\|navigator.share\|toDataURL\|canvas" src/
(0 matches)
```

`package.json` `dependencies` is `{"react": "^19.1.0", "react-dom": "^19.1.0"}` — nothing
else at runtime. The split screen's action bar at `src/session/SplitScreen.tsx:372`
(`<div className="bar split-bar">`) holds exactly four controls: Back (`:374`), Save squad
(`:383`), submit-tournament (`:398`, `data-testid="submit-tournament-squad"`), else Re-roll
(`:401`). The result that would be shared already exists in full: `TeamAssignment.slots`,
`.avgStrength` and `.index`, `SplitResult.gap`, and `SplitResult.solver` are all on screen
(`src/session/SplitScreen.tsx:42-107` `TeamCard`).

Provenance is not D's to define. Phase B ships `src/session/gapProvenance.ts` with
`type GapKind = "proven" | "best-found"`, `gapKind(result): GapKind` (`"proven"` iff
`result.solver.optimal === true`) and `gapQualifier(result): string | null` (the on-screen
suffix, `null` when proven). This ticket branches on **`gapKind`**, never on
`gapQualifier() !== null` — a chat message has no surrounding sentence and must state the
verdict in both cases. A re-roll is not automatically unproven: `varietySplit` sets
`optimal: false` at `src/solver/solver.ts:419` but falls back to `fairSplit` at
`src/solver/solver.ts:409`, which can genuinely return `optimal: true`. Read the field.

**Acceptance criteria:**
- [ ] `src/share/share-text.ts` exports `teamsAsText(input: { communityName: string; disciplineName: string; result: SplitResult; roster: Player[] }): string`, a pure function with no DOM and no React import.
- [ ] The text has this exact shape, verified by a unit test asserting the whole string:
      line 1 `Futsal · Thursday Crew — 3 teams`; a blank line; then per team
      `Team A · avg 3.8` followed by one `• Andi (4.2)` line per player, strongest first,
      players with no capability in the discipline listed last with no parenthesis; a blank
      line between team blocks; then the closing gap line.
- [ ] The closing gap line is `Gap 0.4 — the proven minimum for this pool.` when `gapKind(result) === "proven"` and `Gap 0.4 — the smallest gap found. The search ended before proving it minimal.` when it is `"best-found"` — both cases covered by a unit test that constructs a `SplitResult` with `solver.optimal` true and false.
- [ ] When `result.unassigned` is non-empty the text ends with `Not playing: Name, Name`, and when it is empty that line is absent.
- [ ] `src/session/SplitScreen.tsx`'s `.split-bar` (`:372`) renders a `Share` button (`data-testid="share-teams"`) only when a new optional prop `share?: { communityName: string }` is passed; `src/App.tsx` passes it, and `src/landing.tsx`'s mount at `:153` does not, so the landing hero gains no control — `e2e/tests/landing/landing.spec.ts:31-38` asserts the hero has no competing controls and must stay green unchanged.
- [ ] Clicking Share opens `src/share/ShareSheet.tsx`, which renders inside C23's shared `<Modal onClose={…}>` from `src/ui/Modal.tsx` — the `.modal-overlay` / `.modal-card` skeleton already used by the other five modals — and shows the exact text in a read-only `<textarea className="share-preview">` plus a `Copy text` button (`data-testid="share-copy-text"`). No hand-rolled overlay.
- [ ] Copy uses `navigator.clipboard.writeText` when `navigator.clipboard?.writeText` exists; on success the sheet shows `Copied.` in a `.share-status` line and the button label becomes `Copied`.
- [ ] When the clipboard API is absent, or `writeText` rejects (insecure context or denied permission), the sheet does not throw and does not lose the text: it shows `Copy failed. Select the text above and copy it.` in `.share-status` and leaves the textarea focused and selected.
- [ ] An e2e spec asserts the clipboard after the button click, using `browserContext.grantPermissions(["clipboard-read", "clipboard-write"])` and `page.evaluate(() => navigator.clipboard.readText())`, and asserts the read text starts with the headline and contains each team name from the seeded world.
- [ ] `npx vitest run` exits 0 with no failures and the new `src/share/share-text.test.ts` in the output; `npx tsc -b` exits 0.

**Blocked by:** —
