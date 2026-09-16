# 24: Navigation moves out of the shell

**Status:** ready-for-agent

**What to build:** Going back from a screen, and returning to a hub, are tested behaviour
rather than three closures buried in a component that also renders nine screens.

**Evidence.** `src/App.tsx` is 1,280 lines (`wc -l`). Navigation lives at `:140-156`:

```ts
const [viewStack, setViewStack] = useState<View[]>([{ mode: "dashboard" }]);   // :140
const view = viewStack[viewStack.length - 1];                                   // :141
const pushView = (v: View) => setViewStack((s) => [...s, v]);                   // :150
const goBack = () => setViewStack((s) => (s.length > 1 ? s.slice(0, -1) : s));  // :151
const gotoHub = (hub: HubMode) => { setViewStack([{ mode: hub }]); setSetup(null); }; // :152-155
const goDisciplines = () => pushView({ mode: "disciplines" });                  // :156
```

The `View` union has nine modes (`:70-79`); `NAV_ITEMS` (`:62-68`) carries the five hub
`mode`/`label`/`icon` triples and is rendered twice, in the rail (`:780-812`) and the bottom
nav (`:1264-1279`), both keyed off `viewStack[0].mode`. Two replace-style pushes write the
stack wholesale: `setViewStack([{ mode: "games" }, { mode: "tournament", id }])` at `:352`
(after `buildBracket`) and at `:733` (after create). Every feature so far has added here.

**What moves.** New `src/shell/useNavigation.ts`, frozen by `contracts.md`:

```ts
export type View =
  | { mode: "roster" } | { mode: "dashboard" } | { mode: "games" }
  | { mode: "history" } | { mode: "disciplines" } | { mode: "squads" }
  | { mode: "tournament"; id: Id } | { mode: "match"; source: SplitSource }
  | { mode: "split"; source: SplitSource };

export type HubMode = "dashboard" | "roster" | "games" | "history" | "squads";

export function useNavigation(initial: View): {
  view: View; viewStack: View[];
  pushView: (v: View) => void; goBack: () => void;
  gotoHub: (mode: HubMode) => void; resetTo: (v: View) => void;
};
```

plus the pure transitions, which are what make this testable at all — `vite.config.ts` sets
`test.include: ["src/**/*.test.ts"]` and `environment: "node"`, so `.tsx` is excluded from the
unit harness and a hook cannot be rendered in a test:

```ts
export function pushStack(stack: View[], v: View): View[];  // [...stack, v]
export function popStack(stack: View[]): View[];            // stack.length > 1 ? slice(0,-1) : stack
export function hubStack(mode: HubMode): View[];            // [{ mode }]
export function currentView(stack: View[]): View;           // stack[stack.length - 1]
```

They reproduce `:150-156` exactly, including the root-back no-op (`popStack` must never
return an empty array) and `gotoHub`'s stack **replacement**. `src/shell/nav-items.ts`
receives `NAV_ITEMS` unchanged in value — its labels are accessible names the e2e suite
matches on.

**Two consequences to handle, both stated rather than discovered.**

1. `gotoHub` also calls `setSetup(null)` (`:154`), and the frozen hook owns only the stack.
   `src/App.tsx` keeps a two-line wrapper — `resetTo({ mode })` **is** `hubStack(mode)`
   applied, so it is behaviour-identical:
   ```ts
   const { view, viewStack, pushView, goBack, resetTo } = useNavigation({ mode: "dashboard" });
   const gotoHub = (mode: HubMode) => { resetTo({ mode }); setSetup(null); };
   ```
   The two replace-pushes become `resetTo({ mode: "games" }); pushView({ mode: "tournament", id })`
   — the same two-element stack, so Back and the Games breadcrumb still return to Games
   (FLOW P2, ADR-0004).

2. The frozen `View` drops the live `{ mode: "split"; session: Session; source: SplitSource }`
   payload — and also the dead `{ mode: "squads"; openId?: Id }`, which nothing ever pushes
   (`SquadsScreen` owns its own `openId`, `src/session/SquadsScreen.tsx:48`). The split
   session is live, so it moves to `activeSplit` state in `src/App.tsx`, set by the two
   places that push a split view (History reopen at `:1207`, `reSplitSquad` at `:381-393`).
   Ticket 26 moves that state into `useSplitFlow`.

**Guarded by Phase A's e2e suite.** These primitives are what the spec files click through;
the acceptance rule is the whole suite green with **no spec edited**, which is only meaningful
because A01 re-anchored the suite to the shipped rail layout and A11 made it seed
deterministically. Before A the suite was 16 failed / 25 passed, and a red suite cannot gate a
refactor. Pure extraction: do not "fix" anything on the way past — a refactor with a behaviour
change inside it has no test that can tell you which one broke.

**Acceptance criteria:**
- [ ] `src/shell/useNavigation.ts` exports `View`, `HubMode`, `useNavigation` with the frozen shapes, plus the four pure transitions
- [ ] `grep -rn "useState<View\[\]>\|const pushView\|const goBack" src/App.tsx` returns nothing
- [ ] `src/App.tsx` renders screens from its switch and reads `view` from the hook; `wc -l src/App.tsx` is below 1,240 (an interim ceiling, so a stalled extraction is visible)
- [ ] `src/shell/navigation.test.ts` passes and covers: push/pop round trip; `popStack` at the root returns the same stack (never empty, never `undefined` from `currentView`); `hubStack` collapses a depth-3 stack to one; `resetTo` + `pushView` leaves `currentView` equal to the pushed view; the create-tournament sequence yields `[games, tournament]`
- [ ] `gotoHub` still clears the match setup, and `goBack` at the root still does nothing
- [ ] The browser suite passes with `git diff --stat e2e/tests` empty
- [ ] ADR-0004 holds: no screen hard-codes its own back target; the split flow's `source` still travels on the view

**Blocked by:** 22 — ticket 22 already edits `src/App.tsx` heavily and must land first.
