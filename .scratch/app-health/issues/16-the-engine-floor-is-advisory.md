# 16 — The engine floor is advisory, and nothing says so

> **Superseded.** This ticket's work shipped inside
> [`debt/30`](../../debt/issues/30-project-hygiene.md) — the engine floor is one of its three
> subjects. This file is history; see [`.scratch/app-health/README.md`](../README.md) for the
> pairing of all sixteen.

**What to build:** A decision about whether the Node floor in `package.json` should be enforced, made
explicitly rather than left to the default — plus whatever enforcement that decision implies.

**Evidence.** `package.json` declares `"engines": { "node": "^22.20 || ^24.12 || >=25" }` and
`.nvmrc` pins `24.16.0`. The floor is the intersection of the `engines.node` ranges every package in
`package-lock.json` declares; the binding constraint is `@napi-rs/lzma-linux-x64-gnu@1.5.1`, an
optional native binding that `rollup@4.62.4` pulls in on linux-x64, whose own range is
`^22.20 || ^24.12 || >=25`. Nothing else in the tree is narrower — the next tightest are
`vite`/`vitest`/`vite-node` at `^18.0.0 || ^20.0.0 || >=22.0.0` and `@playwright/test` at `>=20`.

The floor is not enforced, and the repo does not say so anywhere. `engine-strict` is unset
(`npm config get engine-strict` → `false`, and there is no `engine-strict` key in `package.json`
and no `.npmrc`), so `npm ci` on an unsupported Node prints `EBADENGINE` and installs anyway. The
README now states this, but the decision behind it was never made.

**Blocked by:** None. It is a decision, not a dependency — the floor exists and ships either way.

**Status:** resolved

- [ ] The decision is recorded: enforce with `engine-strict`, or keep the floor advisory and say
      why
- [ ] If enforced, the enforcement mechanism is stated and the install path it breaks is named —
      `engine-strict` turns an install into a hard failure for anyone on a Node a *transitive
      optional* dependency merely dislikes, which is a product decision and not a tooling detail
- [ ] If it stays advisory, whatever the README says survives someone deleting this ticket
- [ ] The `engines` value is re-derived from `package-lock.json` when the toolchain moves, and CI's
      Node stays inside the floor

**Design reference:** none — build configuration.

**Notes (fact only, not a recommendation):** the floor's only real binding is one optional,
platform-specific native package. Excluding Node 23 and 24.0–24.11 costs nothing anyone is likely
to run; excluding them does not protect the build either, because the package is optional and npm
skips it. The case for `engine-strict` is that a silent install is a confusing failure later; the
case against it is that the failure would be an `npm ci` refusal on a Node that mostly works.

Deliberately *not* done in the change that added the floor: setting `engine-strict` would have
converted a warning into a hard install failure for a constraint only one optional transitive
package declares, and that call is not this task's to make silently.

## Comments

**Re-checked 2026-10-01 against `d98b95c`, against the code rather than against debt 30's
status — this ticket's own decision shipped. Resolved. debt 30 stays open for something else.**

- Row 1 holds: the decision is made and recorded. `README.md:64-69` — *"**The floor is advisory —
  nothing enforces it.** This repo sets no `engine-strict`, so `npm ci` and `npm install` on an
  unsupported Node print an `EBADENGINE` warning and install anyway."* The reasoning follows at
  `:71-77`: the floor's only binding constraint is `@napi-rs/lzma-linux-x64-gnu`, an **optional**
  linux-x64 native binding that macOS and Windows never fetch, which is precisely the case the
  Notes weighed.
- Row 2 is correctly inapplicable — the advisory branch was taken, so there is no enforcement
  mechanism to state and no install path to name.
- Row 3 holds, and this is the row the ticket cared about most. The README states the fact **in
  prose**, not by pointing at this file: deleting
  `.scratch/app-health/issues/16-the-engine-floor-is-advisory.md` would leave `README.md:64-77`
  intact and true. The link at `README.md:68-69` is an extra, not the load-bearing part.
- Row 4 holds. The derivation rule is written down where a newcomer will meet it
  (`README.md:71`: the intersection of every `engines.node` in `package-lock.json`), and CI is
  inside the floor — `.github/workflows/ci.yml:9` uses `node-version: 22`, which resolves to the
  latest 22.x and so satisfies `^22.20`. There is no script that re-derives the value; it is a
  documented procedure, not an automated one, and this ticket does not claim otherwise.

**What is still open is not this ticket.** debt 30 carries the engine floor and two other
subjects, and it is `ready-for-agent` because of the third: `README.md:143-147` still says there
is no service worker, no manifest and no CDN fonts, which is false of this tree. That is a
README defect, recorded on debt 30; it is not this ticket's ask, and ticket 13's resolution
surfaced it without owning it.
