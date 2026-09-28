# 16 — The engine floor is advisory, and nothing says so

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

**Status:** ready-for-agent

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
