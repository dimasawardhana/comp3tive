# 25: Community scoping expressed once

**Status:** resolved

**What to build:** "No screen ever shows another community's records" is a rule with one home
and its own tests, so a fifth list cannot quietly leak by omission — and the derived data stops
being rebuilt on every render.

**Evidence.** Scoping happens in the shell, not the data layer: every hook returns *all*
records (`src/roster/useRoster.ts:58`, `src/session/useSessions.ts:49`,
`src/tournament/useTournaments.ts:50`, `src/session/useSavedSquads.ts:50`) and `App` filters at
render time. The same rule is restated four times at `src/App.tsx:202`, `:208`, `:211`, `:214`:

```ts
const communityPlayers = activeCommunity
  ? roster.players.filter((p) => p.communityId === activeCommunity.id)
  : [];
```

and `:199` builds a new `Map` on every render
(`const disciplinesById = new Map(disciplines.map((d) => [d.id, d]))`), as does
`viewTournament`'s `find` at `:220-221`. **`grep -c useMemo src/App.tsx` → 0**, in a 1,280-line
component. This is not hypothetical: ADR-0005 records that History and Games had been passed
unfiltered lists, leaking records across communities, and these four filters were the fix. The
invariant currently has no tests.

**What moves.** New `src/shell/useCommunityScope.ts`: the frozen hook plus the pure selector
it memoises, so the invariant is testable without rendering (`vite.config.ts` sets
`test.include: ["src/**/*.test.ts"]` and `environment: "node"` — `.tsx` is excluded, so the
extraction must be `.ts` to be unit-testable):

```ts
export interface CommunityScopeInput {
  communities: Community[];
  activeCommunityId: Id | null;
  players: Player[];
  sessions: Session[];
  tournaments: Tournament[];
  squads: SavedSquad[];
  /** Not in the frozen input; required to build the returned map. Defaults to []. */
  disciplines?: Discipline[];
}
export function scopeCommunities(input: CommunityScopeInput): CommunityScopeResult;
export function useCommunityScope(input: CommunityScopeInput): CommunityScopeResult;
```

`useCommunityScope`'s body is one `useMemo(() => scopeCommunities(input), [ …seven inputs ])`.
`scopeCommunities` is the single place the rule lives: `activeCommunity` is a `find` by id, and
each of the four lists is `records.filter((r) => r.communityId === activeCommunity.id)` when
there is an active community and `[]` when there is not — exactly today's behaviour at `:202`,
`:208`, `:211`, `:214`. `disciplinesById` is built once, in the same call, from the optional
`disciplines` input.

**The contract gap, handled openly.** The frozen `useCommunityScope` output includes
`disciplinesById` but its frozen input has no `disciplines` field, so the map cannot be built
from the declared inputs. The hook takes one extra **optional** field (default `[]`); the six
documented fields still compile. Phase D has been told.

**What stays in `src/App.tsx`.** `visiblePlayers` (`:217-219`) depends on `filterIds`, which is
screen state rather than community scope, so it stays. `viewTournament` stays but is memoised
against the same source list it reads today:

```ts
const viewTournament = useMemo(
  () => (view.mode === "tournament" ? tournaments.tournaments.find((t) => t.id === view.id) ?? null : null),
  [view, tournaments.tournaments],
);
```

The unscoped source is deliberate: `find` by id is already unique and narrowing it is a
behaviour change no ticket asks for. The point is that it runs once per change rather than once
per render.

Do not push filtering into the store: `src/storage/types.ts` is ADR-0001's backend-replacement
seam, and that would be a much larger change than this ticket promises.

**Acceptance criteria:**
- [ ] `grep -rn "communityId ===" src/App.tsx` returns nothing, and the rule appears in exactly one file, `src/shell/useCommunityScope.ts`
- [ ] `grep -c "new Map" src/App.tsx` → 0; `grep -c "useMemo" src/shell/useCommunityScope.ts` → at least 1; `grep -c "useMemo" src/App.tsx` → at least 1
- [ ] `src/shell/community-scope.test.ts` passes and covers: with two communities each holding players, sessions, tournaments and squads, every scoped list contains only the active community's records and nothing from the other; with `activeCommunityId: null`, `activeCommunity` is `null` and all four lists are `[]`; `disciplinesById` resolves a known id and returns `undefined` for an unknown one; `disciplines` omitted does not throw
- [ ] The memoisation is verified structurally, not by a test that cannot work: the hook body is a single `useMemo` over the seven inputs, and the harness has no DOM or React renderer (`environment: "node"`, no jsdom installed), so `react-dom/server` could not prove reference stability. The ticket's Answer records this limit.
- [ ] The browser suite passes with no spec edited — in particular `e2e/tests/dashboard/dashboard.spec.ts`, which asserts community scoping with 84 assertions and is the strongest spec in the suite
- [ ] Switching communities changes every list, and no screen shows a record from the previous community without a reload
- [ ] `wc -l src/App.tsx` is below 1,220

**Blocked by:** 24 — same file, and the first extraction should land clean.

## Comments

**Status re-checked 2026-09-30 against `feature/revamp` — shipped. The rule has one home and its
own tests, which is what this ticket was for.**

`src/shell/useCommunityScope.ts` exports `scopeCommunities` (`:37`) and `useCommunityScope` (`:71`),
with the frozen input including the optional `disciplines` field this ticket added to close the
contract gap. `grep -c "new Map" src/App.tsx` is **0** and `grep -c "useMemo" src/App.tsx` is
**2**, with `useMemo` present in the hook — so the derived maps are no longer rebuilt every render,
and `src/App.tsx` is 514 lines, inside this ticket's 1,220 ceiling.

`src/shell/community-scope.test.ts` covers every case the ticket listed and one more: two
communities each holding players, sessions, tournaments and squads, with every scoped list
containing only the active community's records; the flip between them leaking nothing;
`activeCommunityId: null` yielding a null community and four empty lists; a blank-`communityId`
record kept out of scope; `disciplinesById` resolving a known id and returning `undefined` for an
unknown one; and the hook not throwing when `disciplines` is omitted.

**One thing this ticket's acceptance row reads differently now, for a reason worth recording.**
The row asks that `grep -rn "communityId ===" src/App.tsx` return nothing. It returns **four**
hits, all inside `communityDeleteWarning` (`src/App.tsx:328-331`) — the function that counts what
deleting a community would take with it, so the confirm dialog can name it. That is not the scoping
rule: it filters by an explicitly-passed `communityId` to describe a deletion, rather than narrowing
every list to the active community. The rule itself is in the one file the ticket named, and no
screen derives a list any other way. The grep is over-broad rather than the code being wrong.
