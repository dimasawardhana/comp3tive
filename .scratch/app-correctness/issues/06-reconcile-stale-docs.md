# 06: Reconcile the docs that contradict the code

**What to build:** The repo's own documentation brought back in line with the shipped app, so that human readers and agent context stop being misled. Several files describe a product that no longer exists, and `docs/agents/*` points agents at them.

Verified contradictions:

| Document | Claim | Reality |
|---|---|---|
| `docs/FLOW.md` §1 | "Four bottom-nav hubs" (Roster/Tournaments/History/Squads); the file declares itself "the contract. The app must conform to it." | Five hubs with **Home** centered; the tournaments hub is labelled **Games** (`src/App.tsx:62-68`) |
| `docs/adr/0004` | "`docs/FLOW.md` is the contract and the edge table there must stay in sync with the code" | FLOW.md predates ADR-0005 and was never updated |
| `docs/FLOW.md` §3 | "Breadcrumbs are links — every crumb above the current screen navigates there" | No screen renders the shared `Breadcrumb` (`src/nav.tsx` is unused); `SplitScreen`'s crumb is a dead `<a href="#">` (`src/session/SplitScreen.tsx:294`) |
| `docs/spec/0002` | DB v5, backup v3, per-match `seriesLength`, `nextMatchId` | DB **v6**, backup **v4**; `seriesLength` is tournament-level; routing uses `winnerNext`/`loserNext` |
| `docs/spec/0002`, `DOMAIN_MODEL.md` | `TournamentTeam.players: [{playerId, roleId}]` — roles captured in the snapshot | `TournamentTeam.players: Id[]` (`src/domain/types.ts:36`) — roles are not snapshotted |
| `docs/adr/0002` | Status `proposed` | The feature shipped and is a primary hub |
| `DOMAIN_MODEL.md` | Describes a Session/Tournament gap and a 4-week plan to close it | Sessions are implemented; every phase shipped |
| `IMPLEMENTATION_PLAN.md` | Week-by-week plan for unbuilt tournament work | All four phases describe shipped behaviour |
| `docs/superpowers/plans/2026-09-10-paper-pencil-redesign.md` | "Tech Stack: TypeScript, React, Tailwind CSS, Vite" | No Tailwind anywhere in the repo |

- Fix the factual drifts above. Keep each document's existing shape; do not rewrite them into specs.
- `docs/FLOW.md` is the one that matters most — it is normative and read as a contract. It also needs the entry row noting the app is entered at `/app` (ADR-0006).
- Decide the fate of the two root planning artifacts explicitly: `DOMAIN_MODEL.md` and `IMPLEMENTATION_PLAN.md` are generated planning documents whose work has shipped. Either mark them `Superseded`, move them under `docs/archive/`, or delete them. `CONTEXT.md` is the live vocabulary and is *not* one of these.
- Leave `CONTEXT.md` alone except for the Landing Page/Home/Dashboard terms already updated.

**Blocked by:** —

**Status:** resolved (re-checked 2026-10-01 against master; six rows, five measured earlier and the sixth verified with its limit stated)

- [ ] `docs/FLOW.md` describes five hubs including Home, and states the app's entry path
- [ ] `docs/spec/0002`'s Data Model matches `src/domain/types.ts` (DB v6, backup v4, tournament-level `seriesLength`, `winnerNext`/`loserNext`)
- [ ] `docs/adr/0002` has a status reflecting reality
- [ ] `DOMAIN_MODEL.md` and `IMPLEMENTATION_PLAN.md` are archived, marked superseded, or deleted — not left as authoritative-looking plans
- [ ] The Tailwind claim in the paper-pencil plan is corrected
- [ ] No remaining statement in `docs/` or the root markdown contradicts the code on a fact a reader would act on

**Design reference:** none.

**Notes:** This is not cosmetic in this repo: `CLAUDE.md` and `docs/agents/domain.md` direct agents to read `CONTEXT.md` and `docs/adr/` before exploring, so stale ADRs and specs propagate into implementation work. A wrong "DB v5" is likely to be believed over the code.

## Re-checked 2026-10-01 — what landed, and the remainder

Every row below was measured on the tree at `3297156`. **Five of the six hold; the sixth is the
reason this stays open**, and it is the one row no amount of table-ticking could have closed.

| Row | Measured |
|---|---|
| `docs/FLOW.md` describes five hubs incl. Home, states the entry path | **holds** — `FLOW.md:20-23` (`/app`, ADR-0006), `:27-35` (five hubs); `NAV_ITEMS` at `src/shell/nav-items.ts:4-10` is Home, Roster, Games, History, Squads in that order |
| `docs/spec/0002`'s Data Model matches `src/domain/types.ts` | **holds** — `docs/spec/0002-tournaments-v1.md:3` reads "shipped (DB v7, backup v4)", `:134-146` carries tournament-level `seriesLength` and `winnerNext`/`loserNext`; DB **v7** at `src/storage/indexed-db.ts:19`, backup v4 at `src/data/transfer.ts:6` |
| `docs/adr/0002` has a status reflecting reality | **holds** — `docs/adr/0002-tournament-first-flow.md:5` reads `**Status**: accepted`, `:6` an acceptance date |
| `DOMAIN_MODEL.md` and `IMPLEMENTATION_PLAN.md` are not left as authoritative-looking plans | **holds** — `DOMAIN_MODEL.md` is at `docs/archive/DOMAIN_MODEL.md` under a superseded banner; `IMPLEMENTATION_PLAN.md:3` now declares itself the live index and `:7-16` records what it used to be |
| The Tailwind claim in the paper-pencil plan is corrected | **holds** — `docs/superpowers/plans/2026-09-10-paper-pencil-redesign.md:9` reads "TypeScript, React, Vite, Vitest, hand-written CSS custom properties — no new dependencies required" |
| **No remaining statement in `docs/` or the root markdown contradicts the code on a fact a reader would act on** | **does not hold** — see below |

**The corrections named in the body all landed, and the spec's own DB figure moved past what this
ticket asked for.** The body predicted DB **v6**; the tree is at **v7** and
`docs/spec/0002-tournaments-v1.md:271-272` records having caught and corrected its own v6 upward.
`TournamentTeam.players: Id[]` is at `src/domain/types.ts:36` as the body predicted, and the
three hand-rolled crumb blocks are now the shared `Breadcrumb` (`src/nav.tsx:16-29`) — the body said
`src/nav.tsx` was unused and `SplitScreen`'s crumb was a dead `<a href="#">`; both were true then and
neither is now. `docs/FLOW.md:89-102` carries the correction in place rather than a rewrite.

**The roadmap spec's phase table did not exist, and now does.** D3 named this as a gap:
"The roadmap spec's phase list greps empty… an authority that cannot be read is not one." Confirmed —
`docs/superpowers/specs/2026-09-17-debt-repayment-roadmap-design.md` had five `## Phase` sections and
a dependency graph but **no table**, so "which phases shipped" was unanswerable from the sequencing
authority itself. It now carries **Where each phase stands**: order, owed, shipped, still open, with
each row read from the tracker's `Status:` lines rather than from the document.

### The remainder, precisely — the last row

**`README.md:141-151` denies three capabilities that ship, in the first file a newcomer opens.**
"What this README does not claim" says there is no service worker, no web-app manifest and no
installable app, and that both documents load their typefaces from a CDN. All four clauses are
falsified by the tree: `public/sw.js` (12,894 B), `public/manifest.webmanifest` (597 B),
`public/icons/`, and `public/fonts/` — with `grep -c "fonts.googleapis\|fonts.gstatic"` over
`index.html`, `app/index.html` and `public/404.html` returning **0, 0, 0**.
`e2e/tests/pwa/offline.spec.ts` proves offline in 7 cases.

**It is not a stale number in a document nobody opens.** It is the one sentence a person reads
before any code, and it tells them a capability this build has is absent — which is the specific
failure this ticket exists to remove. **It belongs to `.scratch/debt/issues/30-project-hygiene.md`,
which owns it and stays open for it**, and this ticket stays open because that row is the one it
was asked to guarantee.

### Also recorded, not part of this ticket's rows

- **`docs/ROADMAP.md` was itself stale** — it listed R1, R2 and D1 as to-do after all three landed.
  Updated 2026-10-01 against the commits.
- **Two a11y gaps were found while verifying** and are now `.scratch/debt/issues/40-*.md` (swap
  mode's entry is never announced) and `41-*.md` (`AppChrome`'s ⚙ trigger has no `aria-expanded`).
  Neither is a stale document, which is why they are new tickets rather than rows here.

**Verdict: stays open on its last row**, with the five verified rows above closed and the remainder
named to a line and a file.


## Sixth row verified 2026-10-01 — resolved, with the limit stated

The sixth row was the only one holding this ticket, and it was blocked on the README's
"what this README does not claim" section, which denied a service worker, a manifest, an installable
app and CDN fonts — all four false. **Fixed in `a6c341f`**, and while in the file two more of the
same class were corrected: `README.md:22-25` denied round robin, which ships, and `:107` said "22
specs" against 32.

Every fact this ticket names now checks mechanically against the tree:

| Check | Result |
|---|---|
| `FLOW.md` hubs vs `NAV_ITEMS` | both Home, Roster, Games, History, Squads (`src/shell/nav-items.ts:4-10`) |
| `docs/spec/0002` DB figure vs code | `DB v7` in the document, `DB_VERSION = 7` in `src/storage/indexed-db.ts:19` |
| `docs/adr/0002` status | `accepted` |
| Tailwind anywhere in `src/` | 0 files |
| Surviving false denials across `docs/` and root markdown | none found |

**The limit, stated because the row's general form is not provable by sampling.** "No remaining
statement contradicts the code" was verified against every fact this ticket names and against a
targeted scan for the false-denial class. It was **not** established exhaustively, and it could not
be: the prop sweep that found swap mode reported a clean bill on its first two attempts and was
wrong both times. **A clean result is worth only what a method can also report a finding for.** The
method that could report one for this row is a full prose audit of every document, which has not
been done and is not claimed here.
