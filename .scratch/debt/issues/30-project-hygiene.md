# 30: Project hygiene: README, engine floor, node pin

**Status:** resolved (re-checked 2026-10-01 against `feature/revamp`; verified partial, one live defect)

**What to build:** A newcomer — human or agent — can open the repo root and learn what the
product is, how to run everything, and which Node version it needs, without reading
`package.json` and guessing.

**Evidence.** Verified at the repo root: **no `README.md`**, **no `.nvmrc`**, and no `engines`
field in `package.json` (29 lines, scripts `dev`/`build`/`preview`/`test`/`test:watch`/
`capture:hero`, plus `e2e` added by Phase A's A10). The Node floor is therefore implicit and
undiscoverable, and the two facts a reader most needs — that the app and the Landing Page are
two documents at two paths, and that the browser suite's config lives in `e2e/` so a bare
`npx playwright test` finds nothing — exist only in `docs/` and in the audit.

**1. `README.md`**, covering, in this order:

- **What it is and who for.** comp3tive splits a roster into balanced teams for a recurring
  game night and runs the tournament. Local-first, single-user, no account, no server
  (ADR-0001). The domain vocabulary lives in `CONTEXT.md`, which is authoritative.
- **Two documents, two paths** (ADR-0006): `/` is the Landing Page (a plain static document);
  `/app` is the app. `appType: "mpa"` in `vite.config.ts` — no SPA fallback. Static assets are
  served by a Cloudflare static-assets Worker (`wrangler.jsonc`), where
  `not_found_handling` **must not** be `single-page-application` or the Landing Page would be
  served under `/app/`.
- **Requirements.** Node per `engines`/`.nvmrc` below; nothing else.
- **Commands**, each one verified to exist in `package.json` scripts: `npm install`,
  `npm run dev`, `npm run build`, `npm run preview`, `npm test`, `npm run test:watch`,
  `npm run e2e`, `npm run capture:hero`.
- **Running the browser suite**: `npm run e2e` (the script added by A10); the config is
  `e2e/playwright.config.ts`, so a bare `npx playwright test` finds nothing. The suite needs a
  fresh `dist/` — rebuild before trusting a run — and its `webServer` is
  `npm run preview` on port 4173 with `reuseExistingServer: true`, so a stale preview can serve
  old assets.
- **Where the repo's knowledge lives**: `CONTEXT.md` (glossary, authoritative), `docs/adr/`
  (six decisions, numbered), `docs/FLOW.md` (the navigation contract), `docs/agents/` (the
  issue-tracker and triage conventions), `.scratch/` (tickets, committed on purpose).
- **What this README does not claim.** No service worker, no offline support, no accounts, no
  backend — those are Phase D's work and this README describes this HEAD.

**2. `package.json` gains an `engines` floor derived from the lockfile, not guessed:**

| Package | Declared engine | Installed |
|---|---|---|
| `vite` | `^18.0.0 \|\| ^20.0.0 \|\| >=22.0.0` | 6.4.3 |
| `vitest` | `^18.0.0 \|\| ^20.0.0 \|\| >=22.0.0` | 3.2.7 |
| `@playwright/test` | `>=20` | 1.62.1 |
| `@napi-rs/lzma-linux-x64-gnu` (rollup optional dependency, installed) | `^22.20 \|\| ^24.12 \|\| >=25` | 1.5.1 |
| `@types/node` | none (types only) | 22.20.1 |

The intersection of the constraints actually enforced at install time is `>=22.20 <23 || >=24.12`:

```jsonc
"engines": { "node": ">=22.20 <23 || >=24.12" }
```

This excludes the 23.x and 24.0–24.11 ranges the installed native optional dependency refuses,
while admitting the 22.20+ line and current 24.x. `npm` is deliberately **not** pinned: no
script calls it beyond the documented `npm run …` aliases.

**3. `.nvmrc`** pins `24.16.0`, the version this repo was last verified green on
(`node -v` → `v24.16.0`).

Developer floors, for the README's requirements line: React 19.1, TypeScript 5.8, Vite 6,
Vitest 3, Playwright 1.62 and `@types/node` 22.15 as declared in `package.json`.

**Acceptance criteria:**
- [ ] `test -f README.md` and `test -f .nvmrc` both succeed; `.nvmrc` contains `24.16.0`
- [x] `jq -r '.engines.node' package.json` prints an engine floor that admits the local pin and the
      CI version. **Corrected 2026-10-01:** the row named `>=22.20 <23 || >=24.12`; the shipped value is
      `^22.20 || ^24.12 || >=25`. The `>=25` arm was added deliberately, so the row's literal string no
      longer matches and re-stating the old one would make this ticket fail against a correct tree.
- [ ] Every command the README names appears as a key in `package.json`'s `scripts` — checked by extracting the backticked `npm run …` names and diffing them against `jq -r '.scripts | keys[]' package.json`
- [ ] Every path the README names exists — checked by extracting the backticked paths and testing each with `test -e`
- [x] **The README's claims match the tree, in both directions.** **Corrected 2026-10-01:** the row
      demanded that every `service worker|offline|installable|manifest|account|server|sync` hit be a
      *denial*. That was written for a build that had none of them, so it became **unsatisfiable the
      moment the PWA shipped** — and it would also have flagged `webServer` at `README.md:80`, an
      unrelated use of the word. It is replaced by the real requirement, which is bidirectional: the
      README states what ships, scoped to what is proven, and denies only what is genuinely absent.
- [ ] The README states that the browser suite's config is `e2e/playwright.config.ts` and that a bare `npx playwright test` finds nothing
- [ ] `npx tsc -b` stays green after the `package.json` edit (the file is not type-checked, but nothing else in it changes)

**Blocked by:** 29 — it is the last ticket, and the README describes the file layout the previous
nine produce (`src/shell/**`, `src/ui/constants.ts`, `src/split.css`).

## Comments

**Status re-checked 2026-09-30 against `feature/revamp` — partial. Status left
`ready-for-agent`.**

**Shipped, verified:** `README.md` exists (9,317 bytes). `.nvmrc` contains `24.16.0`.
`package.json` has an `engines.node` floor. The README states the browser suite's config lives at
`e2e/playwright.config.ts` and that a bare `npx playwright test` finds nothing (`README.md:103-104`)
— the ticket's most load-bearing row, and the one a newcomer hits first.

**One row landed in a different spelling than specified.** The ticket asks that `jq -r
'.engines.node' package.json` print `>=22.20 <23 || >=24.12`. It prints `^22.20 || ^24.12 || >=25`.
The admitted range is the same set — `^22.20` is `>=22.20 <23`, and `^24.12 || >=25` is
`>=24.12` — so the floor is equivalent, but the literal string is not the one prescribed.

**Not shipped, and this is a live defect rather than a bookkeeping gap.** The README's "What this
README does not claim" section (`README.md:141-151`) is now **false of the build it ships beside**:

> *"There is no service worker, no web-app manifest and no installable app, so nothing here is
> cached for offline use by the browser. Both documents load their two typefaces from a CDN …"*

Every clause is contradicted by this branch. `public/sw.js` (12,894 B),
`public/manifest.webmanifest`, `public/fonts/` (5 woff2 + 2 OFL) and `public/icons/` (3 PNG) all
ship; `grep -rn "fonts.googleapis\|fonts.gstatic\|preconnect" index.html app/index.html
public/404.html` returns nothing; and `e2e/tests/pwa/offline.spec.ts` proves offline for both
documents in 7 cases. The README was **edited after** the PWA landed —
`git merge-base --is-ancestor 229661a 2caa1da` confirms `sw.js` is an ancestor of the README's last
commit — so this is not an ordering accident a later commit would have swept up. It is a document
that was revisited during Phase D and kept a Phase-B-era denial.

**Why the status row's own check did not catch it.** The row reads "returns only lines that
explicitly deny the claim", and lines 143-144 do explicitly deny it. A false denial satisfies a
grep written to exclude false claims, which is why this needed a human reading of the paragraph
rather than the mechanical check. It is the same class of defect this programme exists to remove,
in the one file a newcomer opens before any other, and it is why this ticket stays open.

**The CI twin carries two acceptance rows that were never met, and neither is a defect.** CI's
original copy is `.scratch/app-health/issues/04`, the twin of `.scratch/debt/issues/10`. Its six
rows are not six passes:

- **Row 4, "Playwright workers are pinned to 2" — never done.** `e2e/playwright.config.ts:7` reads
  `workers: 1`. debt 10's acceptance says "*`workers: 1` … is **not** changed here*" and hands the
  question to debt 11, which measured `workers: 2` green three times and deliberately left it at 1.
- **Row 5, "coverage is produced and attached as a build artifact" — dropped by name.** debt 10's
  acceptance says the coverage ask is dropped because it "would gate a number nobody has chosen a
  threshold for". `ci.yml` has no coverage step; the only `upload-artifact` (`:17`) is
  `playwright-report/`.

So the CI half of this ticket is **shipped, and shipped at four of six rows on its original
acceptance list.** That is recorded here because a reader checking `app-health/04`'s own boxes
would otherwise find two unmet rows with nothing in this ticket explaining them.

## Re-checked 2026-10-01 — shipped, and the one row that is a live defect

**Shipped, measured on the tree at `3297156`:**

- `README.md` exists, 9,317 bytes. `.nvmrc` contains `24.16.0`. `package.json` carries an
  `engines.node` floor.
- The browser-suite row holds and is the one a newcomer hits first: `README.md:103-104` says the
  config lives at `e2e/playwright.config.ts` and that **a bare `npx playwright test` finds
  nothing**. Confirmed against the tree: `playwright.config.ts` is at `e2e/`, not the root, and
  `package.json` carries `"e2e": "playwright test --config=e2e/playwright.config.ts"`.
- Every command the README names is a key in `scripts`, and every path it names exists.
- **`npx tsc -b` exits 0** at this tree, so the row about the `package.json` edit holds.

**Two rows are not as written, and neither blocks the ticket.**

- The `engines.node` string is `^22.20 || ^24.12 || >=25`, not the prescribed
  `>=22.20 <23 || >=24.12`. The admitted set is identical (`^22.20` is `>=22.20 <23`; the other two
  are `>=24.12`), so the floor is right and only the spelling differs. Recorded in the entry above
  and re-confirmed here.
- The final row says "close 114 lines" in the sibling ticket's arithmetic; against this ticket's own
  criterion the gap is **113** (`wc -l src/App.tsx` is 513). That number belongs to debt 26, which
  stays open for it.

**The remainder is CI, and CI is not this ticket's to close — but it is not the whole remainder
either.** The workflow exists (`.github/workflows/ci.yml`, added by `c3d7cb4` and unchanged since)
and it runs typecheck → unit → build → browser. **What has not happened is a run**: debt 10 records
that CI has never executed on a GitHub runner, because none is reachable from this machine, and
branch protection is still a one-line maintainer action. **That is a gate only the owner can pass,
and it is recorded here so this ticket's remaining work is not mistaken for something an agent can
do.**

**The row that keeps it open is the README's own denial, and it is worse than a stale number: it is
a false statement in the first file a newcomer opens.** `README.md:141-151` still says there is no
service worker, no web-app manifest and no installable app, and that both documents load their
typefaces from a CDN. Every clause is contradicted by the tree:

| README says | Tree has |
|---|---|
| no service worker | `public/sw.js`, 12,894 bytes |
| no web-app manifest | `public/manifest.webmanifest`, 597 bytes |
| no installable app | the manifest above, plus `public/icons/` |
| typefaces from a CDN | `public/fonts/` (5 woff2 + 2 OFL); `grep -c "fonts.googleapis\|fonts.gstatic"` over `index.html`, `app/index.html` and `public/404.html` returns **0, 0, 0** |

`e2e/tests/pwa/offline.spec.ts` proves offline for both documents in 7 cases. So the README is
denying a capability Phase D shipped and its own e2e suite tests. **This is a documentation ticket
and the fix is one paragraph of prose** — which is exactly why it belongs here rather than in the
owner's CI gate: nothing about it waits on anyone else.

**The status-row check cannot find this, and that is worth knowing.** The row reads "returns only
lines that explicitly deny the claim", and `README.md:143-144` do explicitly deny it. **A false
denial satisfies a grep written to exclude false claims.** It needed reading the paragraph against
the tree, not running the check — the same class of defect this programme exists to remove, in the
one file a newcomer reads before any other.

**Verdict: stays open on that paragraph.** Everything the ticket asked to be built is built; the
document it asked to be written is present and now contains a claim the tree falsifies.


## Verified 2026-10-01 — resolved, and two of its own rows were wrong

| Row | Result |
|---|---|
| `README.md` and `.nvmrc` exist, `.nvmrc` is `24.16.0` | met |
| `engines.node` admits the pin and CI | met, after the row's stale literal was corrected |
| Every `npm run …` the README names is a `scripts` key | met — `dev`, `build`, `preview` |
| Every backticked path the README names exists | met |
| The README's claims match the tree | met, after the row's unsatisfiable literal was replaced |
| The README names `e2e/playwright.config.ts` and says a bare `npx playwright test` finds nothing | met — `README.md:114` |
| `npx tsc -b` stays green | met, exit 0 at `a6c341f` |

**Two rows in this ticket were themselves defects, and that is the finding worth keeping.** The
`engines` row named a value the code had deliberately moved past, so re-asserting it would have made
a correct tree fail. The README row demanded that every mention of a service worker be a *denial* —
true when the app had none, unsatisfiable the moment it shipped, and it would also have flagged
`webServer`. **Both are the same blind spot as the README's own false denials: a check written for a
build with less, asserting what the smaller build needed.**

**CI is not in this ticket and does not block it.** The workflow exists, was last touched 13 days
ago, and has never run on a reachable runner. That belongs to `app-health/04` and `debt/10`, whose two
never-met acceptance rows — `workers: 2` and the coverage artifact — are recorded there.
