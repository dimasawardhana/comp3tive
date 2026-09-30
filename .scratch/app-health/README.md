# `.scratch/app-health/` — superseded

**This tracker is closed.** Every one of its sixteen tickets is the same work, filed a second
time under `.scratch/debt/issues/`. The debt tracker is the live one; this directory is history.

**The live copy of any ticket here is the debt ticket named in the table below.** Do not start
work from a file in this directory, and do not read a `**Status:**` line here as current — the
lines were corrected on 2026-10-01 against the code, but nothing in this directory is maintained
after that, and nothing in this directory is what `docs/ROADMAP.md` sequences against.

The pairing is recorded here so it is not re-derived. It was re-derived once already, by
`docs/ROADMAP.md`'s D1, which got twelve of the sixteen right and omitted `13 ↔ 33` entirely.

| This directory | Live ticket in `.scratch/debt/issues/` | Verdict, checked against the code 2026-10-01 |
|---|---|---|
| `01-delete-the-code-nothing-calls` | [21 — delete the code nothing calls](../debt/issues/21-delete-the-code-nothing-calls.md) | **shipped** |
| `02-let-the-compiler-catch-dead-code` | [22 — let the compiler catch dead code](../debt/issues/22-let-the-compiler-catch-dead-code.md) | **shipped** |
| `03-one-definition-per-constant` | [23 — one definition per shared constant](../debt/issues/23-one-definition-per-shared-constant.md) | **shipped** |
| `04-ci-runs-the-checks` | [10 — CI runs the checks](../debt/issues/10-ci-runs-the-checks.md) | **shipped**, two acceptance rows rescoped by the successor and never met — see the ticket |
| `05-navigation-moves-out-of-the-shell` | [24 — navigation moves out of the shell](../debt/issues/24-navigation-moves-out-of-the-shell.md) | **shipped** |
| `06-community-scoping-expressed-once` | [25 — community scoping expressed once](../debt/issues/25-community-scoping-expressed-once.md) | **shipped** |
| `07-flow-moves-out-of-the-shell` | [26 — the flow moves out of the shell](../debt/issues/26-the-flow-moves-out-of-the-shell.md) | **PARTIAL — left open.** `src/App.tsx` is 514 lines against a "< 400" acceptance row |
| `08-swiss-pairs-without-rematches` | [07 — Swiss pairs without rematches](../debt/issues/07-swiss-pairs-without-rematches.md) | **shipped** |
| `09-the-split-says-whether-its-gap-is-proven` | [13 — the split says whether its gap is proven](../debt/issues/13-the-split-says-whether-its-gap-is-proven.md) | **shipped** |
| `10-failures-speak-the-apps-language` | [27 — failures speak the app's language](../debt/issues/27-failures-and-confirmations-speak-the-apps-language.md) | **shipped** |
| `11-import-survives-a-bad-file` | [08 — import survives a bad file](../debt/issues/08-import-survives-a-bad-file.md) | **shipped** |
| `12-the-data-has-a-durability-story` | [34 — durability story](../debt/issues/34-durability-story.md) | **shipped** — its evidence was absorbed verbatim into 34 |
| `13-the-offline-promise-fonts` | [33 — a real PWA](../debt/issues/33-real-pwa.md) — fonts are one third of that ticket | **shipped** |
| `14-shared-breadcrumb-and-header-used` | [28 — the breadcrumb and page header are used](../debt/issues/28-the-breadcrumb-and-page-header-are-actually-used.md) | **shipped** |
| `15-e2e-specs-start-from-a-seeded-world` | [11 — e2e specs start from a seeded world](../debt/issues/11-e2e-specs-start-from-a-seeded-world.md) | **shipped**, with one acceptance row that took a third answer — see the ticket |
| `16-the-engine-floor-is-advisory` | [30 — project hygiene](../debt/issues/30-project-hygiene.md) — the engine floor is one of its three subjects | **shipped** as far as this ticket's own ask goes; the sibling README defect is 30's, and 30 is open |

## Why retire rather than reconcile

Reconciling would set sixteen status lines and leave two live status surfaces for one body of
work. The drift is the defect: a second copy of a status is a second thing to forget, and this
tracker stayed stale for exactly that reason — thirteen tickets read `ready-for-agent` after the
work shipped, not because anyone was wrong about the work but because nobody was looking here.
Correcting the lines and stopping leaves the same lie one refactor away.

Retiring removes the second surface. Status now has exactly one home, `.scratch/debt/issues/`,
which is also the directory `docs/ROADMAP.md` sequences against. The sixteen files stay, so
`README.md`'s two deep links into `13-` and `16-` keep resolving, and the evidence each ticket
recorded — the measured pools, the 20 compiler findings, the rematch fuzz counts — is still
readable by whoever revisits the reasoning.

Nothing in this directory is a second copy of a status to maintain. It is a record of what was
found, and the verdict each finding got.