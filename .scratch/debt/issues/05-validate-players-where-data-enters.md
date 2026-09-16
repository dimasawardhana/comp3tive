# 05: Validate players where data enters; add an error boundary

**Status:** ready-for-agent

**What to build:** Every path that accepts player data runs the model rules that already exist and are already tested, and any render-time throw shows a message with a way to recover instead of a blank page.

**Evidence (absorbed from `.scratch/app-correctness/issues/03`, partially stale — corrected here).**

**What is now stale.** The original ticket claims "**No** production code path calls them" of `validatePlayer`/`validateCapability`. That is no longer true: `src/roster/PlayerEditModal.tsx:126` calls `validatePlayer(draft, disciplines)` and renders the returned issues inline via `setIssues(problems)`. **`PlayerEditModal` is not part of this ticket.** The ticket is corrected in place by `.scratch/debt/issues/12`.

**What remains true.** Two other entry points accept data that can violate the invariants:

- `parseBackup` (`src/data/transfer.ts:83-122`) checks *shape* only. `isPlayer` (`:52-57`) requires a string `id`, a string `name` and an array `capabilities`; `attributeRatings`, `eligibleRoles` and `preferredRole` are never inspected, and sessions/squads are only checked with `isRecord`.
- The JSON/CSV branches of `handlePlayerImport` (`src/App.tsx:522-567`, `:569-608`) copy `capabilities` verbatim (`:557`: `Array.isArray(p.capabilities) ? p.capabilities : []`).

`validatePlayer`/`validateCapability` (`src/domain/validation.ts:13`, `:36`) encode exactly the `CONTEXT.md` invariants and have 10 passing tests: at most one capability per discipline, ratings inside each attribute's `min..max`, eligibility inside the discipline's roles, `preferredRole ∈ eligibleRoles`.

**Why it matters.** `computeStrength` throws by design when a capability omits a rating for one of its discipline's attributes (`src/domain/strength.ts:26-31`), and `grep -rn "ErrorBoundary\|componentDidCatch\|getDerivedStateFromError" src/` returns **no matches** — `src/main.tsx` renders `<App />` bare. A persisted bad record therefore reaches a throw with nothing to catch it.

**Route correction (verified during design).** The original ticket says the throw is reachable during render "from `strengthsFor` (`src/App.tsx:123-129`)". `grep -rn "strengthsFor"` returns the declaration and **no call sites**, so that route is dead today. The live render route is the other one the ticket names: `SplitScreen` (`src/session/SplitScreen.tsx:223`) calls `describeFlags` (`src/session/flow.ts:24-38`), which resolves covering players through `strengthOf` → `computeStrength`. The E2E below exercises that live route; the boundary is required either way, because the app has no protection anywhere and any future consumer of a persisted bad record lands in the same hole.

**Acceptance criteria:**
- [ ] `parseBackup(text, disciplines?)` gains an optional second parameter; when supplied, every player is validated and the first problem throws in the module's existing voice, naming the record: `Backup player "Player 3" is invalid: Missing rating for attribute "Technical".`
- [ ] The signature stays backward compatible — all eleven existing `src/data/transfer.test.ts` cases (`:43-166`) pass unchanged
- [ ] `handleImport` (`src/App.tsx:426`) passes `disciplines` at `:429`
- [ ] The JSON players-only branch (`src/App.tsx:542-566`) validates each candidate before saving; invalid rows are skipped and reported by name and reason through `notify(…, "error")`, e.g. `Skipped 2 players. First: "Player 3" — Missing rating for attribute "Technical".` Valid players import exactly as before, so `sample-data/*.json` and `src/data/samplePlayers.ts` still import cleanly
- [ ] A capability with a rating outside `min..max`, an unknown role, or an empty eligibility list is rejected at these entry points; a capability duplicate for one discipline is rejected too
- [ ] New `src/ErrorBoundary.tsx` has exactly the class shape frozen in the contracts file — `React.Component<{ children: React.ReactNode }, { error: Error | null }>` with `getDerivedStateFromError` — and renders a message plus a Reload action inside the existing vocabulary (`.screen`, `.load-error` at `src/index.css:81`, `.bar`, `.btn.btn-primary`)
- [ ] `src/main.tsx` wraps `<App />` inside `<StrictMode>`; the wrapper is additive and sits **outside** `<App />` so Phase D02 can register the service worker beside it without touching it
- [ ] `computeStrength` still throws — this ticket prevents reaching it and does not weaken it
- [ ] `src/data/transfer.test.ts` gains a `parseBackup: player validation` block covering a missing rating, a rating out of `min..max`, an unknown role, an empty eligibility list, and a valid file still parsing
- [ ] New `e2e/tests/shell/error-boundary.spec.ts` (seeded, 1 test): seed a role-uncovered session whose covering player's capability is missing one attribute rating, open it from History, and assert `[data-testid="error-boundary"]` shows the message and a Reload action rather than a blank screen

**Blocked by:** 01 — the E2E uses the shared seeded helper (`.scratch/debt/issues/01`)

**Notes:** This is the highest-value of the import fixes — the others are annoyances, this one loses the screen. No schema library is needed; the validation function exists. `src/data/transfer.test.ts` is also edited by ticket 06, which is blocked by this one for exactly that reason.
