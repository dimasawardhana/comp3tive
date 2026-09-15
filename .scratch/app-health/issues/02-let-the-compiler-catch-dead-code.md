# 02 — Let the compiler catch dead code

**What to build:** A half-finished refactor or a stale rename cannot sit in the tree unnoticed —
the build fails and names the line. This is the only mechanism in the repo that notices a handler
nobody calls.

**Evidence.** `tsconfig.app.json` sets `noUnusedLocals: false`. Turning it on reports **20
findings** on today's tree, none of which any current check would ever surface:

- Six dead handlers in `src/App.tsx`: `showHistory`, `showDisciplines`, `enterMatchFlow`,
  `finishSplit`, `recordTournamentResult`, `showTournamentView`
- Three dead helpers in `src/App.tsx`: `strengthsFor`, `badgeClass`, `effectiveTheme`
- Two unused imports in `src/App.tsx` (`DisciplineEditModal`, `validateTeamParticipation`) — the
  latter is deleted outright by ticket 01
- `ROLE_NAMES` in `src/data/sample-data.ts`; `isNew` in `DisciplineEditModal`; a destructured `d` in
  `PlayerEditModal`; a type-only `TeamSlot` in each of the two tournament validators; an unused
  `Id` import in `src/nav.tsx`

**Blocked by:** 01 — both edit `src/App.tsx` and the two tournament validator modules.

**Status:** ready-for-agent

- [ ] `noUnusedLocals` is `true` in `tsconfig.app.json`
- [ ] `npm run build` is green from a clean tree
- [ ] Every one of the 20 findings is resolved by **removing** the code, or by wiring it up where a
      real caller was clearly waiting for it — the ticket's Answer records which, per symbol
- [ ] No `void x;` statement, underscore-prefixed rename, or `// @ts-ignore` is used to silence a
      finding
- [ ] Behaviour is unchanged: the e2e suite passes with no spec edited

**Design reference:** none.

**Notes:** Deletion is the default, because a handler that duplicates an existing section is
dead weight rather than a plan. Wiring up is the exception and needs a name: if `strengthsFor` is
meant to be the roster's strength column, that is a feature and deserves its own ticket, not a
resurrection inside this one. If a symbol's purpose is genuinely unclear, delete it — git
remembers.
