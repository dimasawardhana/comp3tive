# 15: One noun: Community, everywhere

**Status:** ready-for-agent

**What to build:** The group a roster belongs to is called a **Community** in every string a user
reads. "Squad" survives only where it names the curated, named split (`Saved Squad`), which keeps
its name. An organizer can now tell which thing they are naming.

**Evidence.** `CONTEXT.md` is authoritative and already bans the collision. Under **Community**:
`_Avoid_: group, club, team, profile`. Under **Team**: `_Avoid_: squad, side, lineup`. Under
**Saved Squad**: "The word 'squad' is reserved for this artifact: never a single Team, never the
Community roster."

Today the UI asks for a "new community" while other strings call the group and a tournament's
team set a squad:

| File:line | String | What it means |
|---|---|---|
| `src/App.tsx:1061` | `No players in this squad` | the community's roster |
| `src/App.tsx:1123` | `Ready to play? Split the squad and check the balance.` | the community's roster |
| `src/session/MatchScreen.tsx:48` | `Pick the game first, then the squad.` | the community's roster |
| `src/session/SplitScreen.tsx:304` | `Tournament squad` badge | a team set handed to a tournament |
| `src/session/SplitScreen.tsx:400` | `Save tournament squad →` | a team set handed to a tournament |

Already correct and **not** to be changed: the switcher's visible kicker "Community"
(`src/App.tsx:821`), the menu heading "Community" (`:838`), the switcher `aria-label="Active
community"` (`:829`), the add-community button's `aria-label`/`title` "New community"
(`:883-884`), and the add form's label "New community" (`:931`).

The audit's "SQUAD ▾" label refers to the switcher's rendered name plus caret. Verified:
`git grep -n "SQUAD" $(git rev-list --all)` finds no literal `SQUAD` string in any revision of
`src/App.tsx`, so no change is needed for the switcher itself.

`docs/BUSINESS_FLOW_REVIEW.md:166` records an earlier rename in the opposite direction
("Renamed `+ New Community` → `+ New Squad` to match the topbar label"); that record is history
and is not edited by this ticket (B16 sweeps stale doc claims).

**What to build, exactly.** Five string replacements:

| File:line | Current | After |
|---|---|---|
| `src/App.tsx:1061` | `No players in this squad` | `No players in this community` |
| `src/App.tsx:1123` | `Split the squad` | `Split the roster` |
| `src/session/MatchScreen.tsx:48` | `then the squad` | `then the roster` |
| `src/session/SplitScreen.tsx:304` | `Tournament squad` | `Tournament teams` |
| `src/session/SplitScreen.tsx:400` | `Save tournament squad →` | `Save teams to tournament →` |

"The roster" in `:1123`/`MatchScreen:48` is deliberate, not "Community": both sentences are about
the players being split, and `CONTEXT.md` defines Player as "a person on the roster" while
Community is the container. "Teams" in `SplitScreen:304`/`:400` is deliberate: `CONTEXT.md`
defines Team as "a group of players assigned to play together in a session" and bans squad for it.

**Leave alone — Saved Squad keeps its name.** `SquadsScreen.tsx:60` (`kicker="Saved squad"`),
`:115-116` (`kicker="Squad bank"`, `title="Saved squads"`), `:125-126`, `:174`;
`DashboardScreen.tsx:119` ("Saved squads"), `:264` ("Browse saved squads");
`SplitScreen.tsx:164` (`Save squad` modal title), `:179`, `:191` (`Save squad`),
`:383-385` (`Save squad`, `data-testid="save-squad-button"`);
`TournamentScreen.tsx:310` ("Or use a saved squad"); `App.tsx:450`, `:625`, `:643`
("saved squad" in import and delete summaries). `App.tsx:67`'s nav label `"Squads"` also stays:
it names the Saved Squads hub, matches that screen's h1, and matches A11's `hubButton`
accessible name.

**No spec assertion changes.** The five renamed strings appear in no e2e assertion (verified by
grep across `e2e/`), and `getByTitle("New community")` — used by 13 spec files
(`panel/no-overlap.spec.ts:10`, `history/history.spec.ts:8`, `tournament/inspect.spec.ts:8`,
`inspect2.spec.ts:9`, `inspect3.spec.ts:9`, `journey.spec.ts:8`, `create.spec.ts:8`,
`draft.spec.ts:8`, `split-tourney.spec.ts:17`, `match-setup/setup.spec.ts:8`,
`split-flow/split.spec.ts:12`, `community/cancel-dropdown.spec.ts:8`,
`community/community.spec.ts:9`) — does not change. `e2e/tests/tournament/split-tourney.spec.ts:2`
mentions "Tournament squad" in a comment only; the comment may be reworded, no assertion moves.
`e2e/tests/squads/saved-squad.spec.ts:59`, `:62` target Saved Squad and are unaffected.

**One new spec** is warranted, because the rename is user-visible behaviour: assert the Roster
empty state reads `No players in this community` and the split CTA reads `Split the roster`.
Follow A01's seeded conventions.

**Sequencing.** Per `contracts.md`, run this after Phase A is green and before Phase C's
decomposition reads it ("C must not rename independently — it reads B15's outcome"). These five
strings *are* that outcome.

**Acceptance criteria:**
- [ ] `grep -rn "No players in this squad\|Split the squad\|then the squad\|Tournament squad\|Save tournament squad" src/` returns nothing
- [ ] The five replacement strings are present at the five locations above
- [ ] Every "Saved squad" occurrence listed under "Leave alone" is unchanged
- [ ] The nav label `"Squads"` (`src/App.tsx:67`), the add-community `title="New community"` (`:884`), and the form label (`:931`) are unchanged
- [ ] A new e2e spec asserts the Roster empty state and the split CTA use the corrected strings
- [ ] `npm run e2e` passes, with no existing assertion edited

**Blocked by:** — (runs after Phase A is green; sequencing only)
