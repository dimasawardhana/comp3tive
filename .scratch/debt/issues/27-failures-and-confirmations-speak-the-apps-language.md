# 27: Failures and confirmations speak the app's language

**Status:** ready-for-agent

**What to build:** No operation blocks the thread with a native browser dialog; a rejected
domain operation shows a message instead of vanishing into the console; and a write that fails
is never silent.

**Evidence.** Four self-contradicting error strategies. **10 `alert()` calls** and **7
`window.confirm()` calls**; the confirms are at `src/domain/DisciplineEditModal.tsx:156`,
`src/roster/PlayerEditModal.tsx:143`, `src/App.tsx:449` (import merge), `src/App.tsx:866` (delete
community), `src/session/SquadsScreen.tsx:100`, `:174` and `src/session/HistoryScreen.tsx:97`.
A toast system **already exists and these paths ignore it**: `notify` at `src/App.tsx:163-171`
and `.toast-container` with `aria-live="polite"` at `:1257`, styled at
`src/index.css:2808-2845` with `success`/`error`/`info` variants. Ticket 26 moves them to
`src/shell/useToasts.ts` and `src/ui/Toasts.tsx` unchanged, so `notify` arrives here as a hook
result with the same signature and lifetime. **Throws reach React uncaught**: `applyResult` and
`undoLastGame` throw by design (`src/tournament/bracket.ts:252-289`) and neither `recordResult`
(`:359-363`) nor `undoLastResult` (`:404-410`) wraps the call — the frontier guard is reachable
from two tabs on one tournament, so a rejected recording is an unhandled rejection. And
**failures are silent**: `split()`'s ad-hoc Session write is swallowed on purpose (`:310-314`,
"Non-fatal: still show the split if persistence failed") and the legacy adoption effect fires
`void roster.savePlayer(…)` / `void sessionStore.saveSession(…)` with no `.catch` (`:226-234`).
`SplitScreen`'s inline "This arrangement wasn't saved." is the one honest report — that is the
pattern to generalise.

**Confirmed live by the audit, not inferred:** clicking Delete opened a native
`confirm("Delete player \"Player 1\"?")` that **blocked browser automation** until an external
dialog handler accepted it. A real defect, not a style preference.

**1. The 10 `alert()` calls become `notify`, keeping every sentence verbatim.**

| Line | Text | Type |
|---|---|---|
| `:431`, `:610` | `` `Import failed: ${err instanceof Error ? err.message : String(err)}` `` | `error` |
| `:528` | "That file is not valid JSON." | `error` |
| `:532` | "That JSON file does not contain a recognizable roster." | `error` |
| `:544` | "Pick or create a community before importing a player file." | `error` |
| `:562` | `` `Imported ${n} player${n === 1 ? "" : "s"} into ${activeCommunity.name}.` `` | `success` |
| `:565` | "That JSON file is not a recognized roster or backup." | `error` |
| `:571` | "Pick or create a community before importing a CSV." | `error` |
| `:608` | `` `Imported ${n} player${n === 1 ? "" : "s"}.` `` | `success` |
| `:714` | `` `Validation failed: ${validation.map(v => v.message).join('\n')}` `` | `error` |

The two count-reporting calls are confirmations, not errors, hence `success`. **The copy delta is
exactly one joiner**: `:714`'s list is `join('\n')` and a toast is one inline paragraph, so it
becomes `join("; ")`. Nothing else changes a character.

**2. The 7 `window.confirm()` calls become an in-app two-step.** The precedent ships already:
`TournamentScreen`'s delete keeps a `deleteConfirm` boolean
(`src/tournament/TournamentScreen.tsx:245`) and swaps the row to `Cancel` +
`Delete tournament` (`:376-385`, `:405`), inside `.bar`, with no modal and no focus move. Seven
hand-rolled copies of that boolean would be worse than the dialogs, so it becomes one primitive,
`src/ui/ConfirmButton.tsx`, with props
`{ label, confirmLabel, message?, onConfirm, className? = "btn btn-ghost" }`. Idle it renders one
`<button>`; confirming it renders the optional `message` in a `<span className="status-msg">`,
then `Cancel` (`.btn-ghost`) and `confirmLabel` (`.btn-danger-ghost`). It returns a fragment, so
each site drops it into the `.bar` or row it already has. **No CSS changes** — both classes exist
(`src/index.css:2751`, `:1169`) — nothing traps focus, and nothing sets `aria-modal`.

Each site keeps its warning copy verbatim: the discipline's "Players with capabilities in it will
still have those ratings, but the discipline won't be available for splitting.", the squads'
"Tournaments that used it keep their teams.", the player's `` `Delete player "${name}"?` ``,
History's "Delete this session?", and the community's
`` `Delete "${activeCommunity.name}"?${warning}` `` (`communityDeleteWarning`, `:635-647`).
**One deliberate behaviour change, named:** that community delete closes the menu
(`setShowCommunityMenu(false)`, `:865`) *before* the native dialog today, because a native dialog
survives it; with an inline confirm the menu stays open while the user decides and closes on
confirm.

**3. The import path moves into `src/shell/usePlayerImport.ts`** — the merge confirm (`:449`) is
not destructive, its trigger is a file input, and the CSV/JSON branch (`:515-614`, 100 lines) is
the largest block left in `App.tsx`. The hook takes the store save functions, the scoped lists,
the active community id and `notify`, and returns
`{ pendingMerge: { counts; apply } | null, confirmMerge, cancelMerge, lastReport, importFile }`
where `lastReport` is
`{ imported: number; skipped: { line: number; reason: string }[] } | null` (null before the first
import). `src/App.tsx` passes `importFile` and those fields into
`src/shell/RosterScreen.tsx`, which renders the two-step and keeps the hidden
`<input type="file">`. The five-count sentence and the merge semantics (add only new ids, never
overwrite) are unchanged. Phase A's A08 may replace the parse internals
(`src/data/player-import.ts`); this hook consumes whatever A08 returns, and `lastReport` is the
field D36 renders.

**4. The throws and the swallowed writes.** `recordResult` and `undoLastResult` wrap their
`applyResult` / `undoLastGame` call and `notify(err.message, "error")` — the throw already
carries the user-readable message ("That match isn't ready to record: its teams aren't decided
yet."), so nothing is invented. The ad-hoc Session write keeps showing the split and adds
`notify("Your split wasn't saved to History.", "error")`. The legacy-adoption effect gets a
`.catch` on both writes that notifies once, guarded by a ref so a repeatedly-failing write cannot
emit a toast per render. `SplitScreen`'s inline banner stays.

Do **not** add a global error boundary here: Phase A's ticket 05 owns it. This ticket is about
the handlers around it.

**Acceptance criteria:**
- [ ] `grep -rn "alert(\|window.confirm(" src/` returns nothing
- [ ] Every former `alert()` is a `notify` call with its text preserved, except `:714`'s `join('\n')` → `join("; ")`, which is stated in the diff
- [ ] Every former `window.confirm()` is an in-app two-step: `src/ui/ConfirmButton.tsx` for the six call-site actions, `usePlayerImport`'s `pendingMerge` for the merge
- [ ] No confirmation blocks the thread: with browser automation, clicking Delete shows Cancel/Delete controls and the click never stalls waiting for a native dialog (this is the defect the audit reproduced)
- [ ] `recordResult` and `undoLastResult` surface the domain throw as a toast instead of an unhandled rejection
- [ ] The ad-hoc Session write failure and the legacy-adoption write failure each notify; the adoption effect notifies at most once per session
- [ ] `.toast-container` still carries `aria-live="polite"` and every toast still carries `role="status"`; focus is not stolen by a confirmation
- [ ] `git diff --stat src/index.css` is empty — the two-step reuses `.status-msg`, `.btn-ghost`, `.btn-danger-ghost`
- [ ] The browser suite passes with no spec edited

**Blocked by:** 26 — it moves the handlers and the roster markup this ticket edits. Phase A's
`.scratch/app-correctness/02` and `03` must also have landed: both edit the same handlers, and
`03` adds validation at the very entry points this ticket rewrites.
