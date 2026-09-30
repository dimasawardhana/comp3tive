# 02 — Let the compiler catch dead code

> **Superseded.** The live copy of this ticket is
> [`debt/22`](../../debt/issues/22-let-the-compiler-catch-dead-code.md). This file is history; see
> [`.scratch/app-health/README.md`](../README.md) for the pairing of all sixteen.

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

**Status:** resolved

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

## Comments

**Re-checked 2026-10-01 against `d98b95c`, against the code rather than against debt 22's
status — shipped. Resolved.**

- `tsconfig.app.json:18` reads `"noUnusedLocals": true`, and `:19` adds
  `"noUnusedParameters": true` alongside it.
- `npx tsc -b` exits 0, so the flag is doing its work rather than describing an intention.
- Row 3's prohibition holds. `grep -rn "@ts-ignore\|@ts-expect-error\|@ts-nocheck" src/` returns
  nothing, and there is no bare `void <identifier>;` statement anywhere in `src/` — every `void`
  in the tree sits in expression position on a call (`src/App.tsx:143`,
  `src/domain/useDisciplines.ts:40`, and so on), which is where a floating promise belongs and
  which `noUnusedLocals` never needed to be silenced for. No symbol was renamed with an
  underscore prefix.
- Row 3's other half — that each finding was resolved by removal or by a named resurrection — is
  not separately checkable from the tree, since it is a record of what happened rather than a
  state. debt 22's `## Comments` records it finding-by-finding and agrees with what the tree
  shows; this ticket does not treat that as proof of its own, and resolves on the flag plus a
  clean `tsc -b`.

**Not verified here, and not claimed:** row 5, "the e2e suite passes with no spec edited". The
e2e suite was not run for this re-check. Every structural claim above is a compile or a search;
the browser-suite claim is debt 22's to stand behind.
