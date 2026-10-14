# Account and Durability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The evening survives the device. A Guest is unchanged; an Organizer who signs in gets their roster on a second device, and gets it back after losing the first — with the Guest path byte-identical at the end.

**Architecture:** Phase E is the fifth and last phase. A (green suite), B (honest claims), C (decomposed shell) and D (product completion) have all landed; `src/App.tsx` is 391 lines and holds no flow rules, so the sign-in surface belongs in `src/shell/`. Authority moves to a server while the **read path stays IndexedDB**: the six stores (`src/storage/types.ts`) become a write-through cache behind their existing interfaces, and their shape does not change — every `list*()` keeps taking no arguments. The wire format is the backup format, one document per `(account, community)`, so there is no second schema, no merge algorithm and no duplicated validation. The first three tasks are pure, local and independently shippable; the feature is usable end to end only after Task 6.

**Tech Stack:** React 19, TypeScript 5.8, Vite 6 (`appType: "mpa"`, two documents), Vitest 3 (node environment, `src/**/*.test.ts` only), Playwright 1.62 (chromium, `workers: 1`), IndexedDB via `fake-indexeddb`, Cloudflare Workers (static assets + a Worker script for `/api/*`), no runtime dependencies beyond `react` and `react-dom`.

**Spec:** `.scratch/backend/spec.md` · **Decisions:** `docs/adr/0007-optional-backend.md`, `docs/adr/0008-account-identity.md` · **Authority for ownership:** `contracts.md` §3 Phase E, §4 "Created by E"

## Global Constraints

Copied from the spec and `contracts.md`. Every task's requirements implicitly include this section.

- **The Guest path is the regression surface.** The existing 119-test e2e suite runs with no account and must stay **green and unedited**. Any spec that needs editing to accommodate the Account is evidence the Guest experience moved — treat it as a defect in the change, not in the spec.
- **The storage seam does not change shape.** Every `list*()` keeps taking no arguments; Community scoping stays a filter in the React layer; the server learns which Account is asking from the token, never from the payload. A `replaceAllDisciplines` is **not** added to save a loop — the interface grows a method only when something needs it.
- **Authority is the server's; the read path is IndexedDB.** Nothing in `src/` starts awaiting a `fetch` for a read. A signed-in Organizer on a court with no signal sees their roster.
- **Unit tests only collect `.ts`.** `vite.config.ts` sets `test.include: ["src/**/*.test.ts"]`. Anything that must be unit-tested is a `.ts` module, not `.tsx` — this is why the sync decision function is a pure function and not a hook.
- **Test environment is `node`.** No jsdom, no `happy-dom`, no `@testing-library/*`, and this plan adds none. Anything needing a real layout or a real click is proven by a Playwright spec — including the editor's refusal, which `src/roster/PlayerEditModal.test.ts` cannot reach (`renderToStaticMarkup` runs no handlers).
- **E2E paths are relative to `e2e/`.** `e2e/playwright.config.ts` sets `testDir: "./tests"`, so an e2e command is `npx playwright test --config=e2e/playwright.config.ts tests/<group>/<file>.spec.ts`. A bare `e2e/tests/...` argument finds NO tests.
- **Always rebuild before trusting an e2e run.** The config sets `reuseExistingServer: true` and `webServer.command: "npm run preview"`, which serves `dist/`. Run `npm run build` first.
- **No native dialogs in new UI.** The app's vocabulary is inline UI and `notify` (`DESIGN.md:200`, "no em-dash in on-screen UI copy"; Phase D's constraint that no `alert`/`window.confirm` is added). Ticket 05's adoption gate is the **one** documented exception: it follows the existing import-merge confirm rather than inventing a modal pattern. Say so in the code when you write it.
- **Every claim in a document names the tree it was checked against** (`docs/agents/document-claims.md`). Task 3 edits prose; read it against the tree rather than grepping for it.
- **`docs/BUSINESS_FLOW_REVIEW.md:13` is out of scope**, deliberately: dated analysis, not a live claim.

## File Map

| Action | File | Responsibility |
|---|---|---|
| Create | `docs/superpowers/plans/2026-09-28-account-and-durability.md` | This file |
| Create | `server/index.ts` | The Worker script: `/api/*` routing, sessions, storage; the repo's first Worker |
| Create | `server/storage.ts` | D1: the three-column schema, and the conditional `UPDATE … WHERE version = ?` that *is* the compare-and-swap |
| Create | `server/webauthn.ts` | Passkey registration/authentication via `@simplewebauthn/server` (v13), never hand-rolled |
| Create | `server/google.ts` | Google identity: `iss` + `sub`, audience/issuer/expiry checked, signature against rotating keys |
| Create | `server/sync.ts` | One JSON document per `(account, community)` plus a version integer; compare-and-swap |
| Create | `server/*.test.ts` | The routing, the token rules and the compare-and-swap, over an in-memory store |
| Create | `src/account/session.ts` | **The one module** holding the current session, the token, and sign in / sign out / refresh |
| Create | `src/account/session.test.ts` | The guard: signed out makes no request; a stale token clears nothing |
| Create | `src/account/sync-decision.ts` | **Pure** `decideSync(local, lastKnownVersion, serverVersion)` → push / push-and-adopt / reject-stale / no-op |
| Create | `src/account/sync-decision.test.ts` | All four outcomes, including the identical-payload no-op |
| Create | `src/account/useAccount.ts` | The React half: current session state, adopt on sign-in, clear on sign-out |
| Create | `src/account/useSync.ts` | Debounced whole-Community push, the rejection message, the version keys |
| Create | `src/account/AccountPanel.tsx` | Sign-in/sign-out surface, "On this device" / "In your Account", the cache-is-a-cache notice |
| Create | `.env.example` | The API-base convention, discoverable rather than folklore |
| Create | `e2e/tests/account/lifecycle.spec.ts` | Sign in with data present → adopt prompt → roster survives → sign out → stores empty |
| Create | `e2e/tests/account/stale-push.spec.ts` | Two devices, two pushes, the second rejected and the first's data intact |
| Modify | `src/data/transfer.ts` | `BackupData` v5 with `disciplines[]`; `serializeBackup` gains the parameter (Task 1) |
| Modify | `src/data/transfer.test.ts` | The v5 round trip, the v4 migration, the built-ins-win rule |
| Modify | `src/domain/types.ts` | `Player.createdAt`; the `Account` and `Credential` types (Tasks 2, 4) |
| Modify | `src/dashboardTeasers.ts` | `recentPlayers` ranks by `createdAt` descending, ties by id |
| Modify | `src/roster/PlayerEditModal.tsx` | `createdAt` stamped on create, preserved on edit (Task 2) |
| Modify | `src/data/player-import.ts` | CSV players stamped in parse order (Task 2) |
| Modify | `src/shell/usePlayerImport.ts` | The JSON import preserves a finite `createdAt`, else stamps; writes the catalog through `saveDiscipline` (Tasks 1, 2) |
| Modify | `src/shell/useAppCommands.ts` | `handleExport` passes the catalog to `serializeBackup` (Task 1) |
| Modify | `wrangler.jsonc` | `main`, `assets.run_worker_first: ["/api/*"]`; the "no Worker script" comment corrected |
| Modify | `.github/workflows/ci.yml` | The deploy step (`wrangler deploy`), gated on a secret being present |
| Modify | `index.html`, `public/404.html` | Task 3's copy only |
| Modify | `e2e/support/seed.ts` | `SeedWorld` players carry `createdAt` (Task 2) |
| Modify | `CONTEXT.md` | Already carries Account/Credential/Guest/"On this device"; no task edits it again |

---

### Task 1: The backup carries the discipline catalog

**Files:**
- Modify: `src/data/transfer.ts`
- Test: `src/data/transfer.test.ts`
- Modify: `src/shell/useAppCommands.ts`, `src/shell/usePlayerImport.ts`

**Interfaces:**
- Consumes: `SEED_DISCIPLINES` from `src/domain/seed.ts`; `disciplineStore.saveDiscipline` (upsert, already exists).
- Produces: `BackupData` with `version: 5` and `disciplines: Discipline[]`; `serializeBackup(players, sessions, communities, tournaments, savedSquads, disciplines)`; `parseBackup(text, disciplines?)` unchanged in signature. Task 5 and Task 6 both consume the v5 payload as their wire format.

**Why this is first.** The catalog is the one aggregate the backup omits, and the omission is silent data loss: export on one device, import on another, and every custom Discipline is gone while capabilities in it survive as orphans. It is also a hard prerequisite — a per-account catalog cannot sync while the catalog is absent from the payload.

**Built-ins are constants and the code is authoritative for them.** Every field is `disabled={isBuiltIn}` (`src/domain/DisciplineEditModal.tsx`), delete returns early for a built-in, and `builtIn: true` exists precisely so they cannot be edited. So the merge rule is: for any id that is a built-in in code, take the code's definition and ignore the file's — **as a merge by id against `SEED_DISCIPLINES`, not as a filter that drops file entries.**

- [ ] **Step 1: Write the failing tests**

Append to `src/data/transfer.test.ts`, inside the existing top-level `describe`:

```ts
it("carries a custom discipline through a round trip, byte for byte", () => {
  const custom: Discipline = {
    id: "volleyball", name: "Volleyball", shortName: "VB",
    roles: [{ id: "setter", name: "Setter" }, { id: "spiker", name: "Spiker" }],
    attributes: [{ id: "serve", name: "Serve", min: 1, max: 5 }],
    strengthModel: { kind: "mean" },
    team: { minTeamSize: 6, maxTeamSize: 6, rolesRequired: true },
  };
  const text = serializeBackup([], [], [community("c1", "Crew")], [], [], [custom]);
  const back = parseBackup(text, [custom]);
  expect(back.version).toBe(5);
  expect(back.disciplines).toEqual([custom]);
});

it("migrates a v4 file with no disciplines to the built-in catalog", () => {
  const v4 = JSON.stringify({
    version: 4, exportedAt: "", communities: [community("c1", "Crew")],
    players: [], sessions: [], tournaments: [], savedSquads: [],
  });
  const back = parseBackup(v4, SEED_DISCIPLINES);
  expect(back.version).toBe(5);
  // No `disciplines` key in the file: the code's catalog is what a v4 device gets.
  expect(back.disciplines.map((d) => d.id)).toEqual(SEED_DISCIPLINES.map((d) => d.id));
});

it("takes the code's definition of a built-in, never the file's", () => {
  const tampered = { ...SEED_DISCIPLINES[0], roles: [{ id: "hacked", name: "Hacked" }] };
  const text = JSON.stringify({
    version: 5, exportedAt: "", communities: [community("c1", "Crew")],
    players: [], sessions: [], tournaments: [], savedSquads: [], disciplines: [tampered],
  });
  const back = parseBackup(text, SEED_DISCIPLINES);
  const futsal = back.disciplines.find((d) => d.id === SEED_DISCIPLINES[0].id);
  // The seed's roles, not the file's: a newer build or a hand-edited file must
  // not be able to redefine a built-in's roles or attributes.
  expect(futsal?.roles).toEqual(SEED_DISCIPLINES[0].roles);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/data/transfer.test.ts`
Expected: FAIL — `Expected 4 arguments, but got 6` on `serializeBackup`, and `back.disciplines` undefined.

- [ ] **Step 3: Change the format**

In `src/data/transfer.ts`: `BackupData.version` becomes `5`, the interface gains `disciplines: Discipline[]`, and the version-history comment above it gains the v5 line. `serializeBackup` gains `disciplines` as its **last** parameter (its existing order already differs from the shape's, so append rather than reorder) and writes `version: 5, disciplines` into the literal in shape order.

- [ ] **Step 4: Accept v5 on the way in**

`parseBackup` accepts `5` in the version gate and defaults `disciplines` to `[]` when the key is absent — the way `tournaments` and `savedSquads` already default — so v1–v4 files need no explicit branch. Then apply the built-ins-win merge by id against `SEED_DISCIPLINES`, and return `version: 5`.

- [ ] **Step 5: Prove the migration tests still pass**

Run: `npx vitest run src/data/transfer.test.ts`
Expected: PASS, including the existing `adopts v1 players`, `migrates a v3 backup` and `adopts records whose communityId references a missing community` cases **unedited**.

- [ ] **Step 6: Give the two call sites the catalog**

`src/shell/useAppCommands.ts`'s `handleExport` calls `serializeBackup(...)`; add the catalog as the sixth argument and thread it through `AppCommandsDeps` from `App.tsx`'s `catalog.disciplines`. Then the import merge in `src/shell/usePlayerImport.ts`'s `confirmMerge` writes the catalog through `saveDiscipline` **before** the players whose capabilities reference it, mirroring the existing rule that communities are written and refreshed first. The merge stays additive: an id already present on the device is left alone, with the built-in rule above as the one exception (a definition refresh, not a record overwrite).

- [ ] **Step 7: Verify and commit**

```bash
npx tsc -b && npx vitest run && npm run build && npm run e2e
grep -n 'version: 4' src/   # returns nothing
git add src/data/transfer.ts src/data/transfer.test.ts src/shell/useAppCommands.ts src/shell/usePlayerImport.ts src/App.tsx
git commit -m "feat(backup): version 5 carries the discipline catalog, and built-ins come from the code"
```

---

### Task 2: A Player carries a creation timestamp

**Files:**
- Modify: `src/domain/types.ts`, `src/dashboardTeasers.ts`, `src/roster/PlayerEditModal.tsx`, `src/data/player-import.ts`, `src/shell/usePlayerImport.ts`
- Test: `src/dashboardTeasers.test.ts` (exists), plus a focused test for the stamp rule
- Modify: `e2e/support/seed.ts` and every spec that writes a player record

**Interfaces:**
- Consumes: nothing new.
- Produces: `Player.createdAt: number` (epoch ms). Task 5's adoption and Task 6's pull both preserve it, and `e2e/tests/dashboard/dashboard.spec.ts` is the observable assertion that the teasers are unchanged.

**The defect being fixed.** "Recently added" is not expressed anywhere; it is inherited from a storage engine's iteration order. `list()` is a bare `getAll()`, no object store declares an index, and `useRoster` applies no sort — so the order is insertion order within a session and **id-ascending after a reload**. `recentPlayers` takes `players.slice(-3)`. Today's suite passes only because the seeded ids sort the same as their insertion order. A server answering without an `ORDER BY` changes a visible Dashboard row, which is why the meaning has to be written down rather than inherited.

- [ ] **Step 1: Write the failing test**

The file's `player` helper (`src/dashboardTeasers.test.ts:6-11`) gains a `createdAt` parameter, and
**three of the five existing `recentPlayers` cases necessarily change** — they assert `slice(-3)`
semantics ("returns the last three players of the roster, in roster order"), which is the behaviour
being replaced. Removing them is not a narrowing: the two properties they were reaching for are
re-asserted below with an input that can actually distinguish order, and the "fewer than three" and
"empty roster" cases are unaffected. Rewrite the describe block to:

```ts
describe("recentPlayers", () => {
  it("ranks by createdAt descending, deterministically from a shuffled input", () => {
    const roster = [player("a", 100), player("b", 300), player("c", 200)];
    // Shuffled on purpose: `slice(-3)` had no order property at all, and this is
    // the input that exposes it. The input order is not the answer.
    const shuffled = [roster[1], roster[2], roster[0]];
    expect(recentPlayers(shuffled).map((p) => p.id)).toEqual(["b", "c", "a"]);
  });

  it("breaks equal timestamps by id ascending, so the result cannot depend on input order", () => {
    const tied = [player("z", 100), player("a", 100), player("m", 100)];
    expect(recentPlayers(tied).map((p) => p.id)).toEqual(["a", "m", "z"]);
    expect(recentPlayers([...tied].reverse()).map((p) => p.id)).toEqual(["a", "m", "z"]);
  });

  it("returns the whole roster when it has fewer than three players", () => {
    const roster = [player("a", 100), player("b", 200)];
    expect(recentPlayers(roster).map((p) => p.id)).toEqual(["b", "a"]);
  });

  it("returns a single player unchanged", () => {
    expect(recentPlayers([player("a", 100)]).map((p) => p.id)).toEqual(["a"]);
  });

  it("returns an empty list for an empty roster", () => {
    expect(recentPlayers([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/dashboardTeasers.test.ts`
Expected: FAIL — `["b","c","a"]` is not `["a","c","b"]` (`slice(-3)` on the shuffled input), and the
`createdAt` argument is a type error until Step 3.

- [ ] **Step 3: Add the field and make the compiler find every site**

`Player` gains `createdAt: number` with the same comment style the other four timestamps use. Then `npx tsc -b` is the completeness check — **no site may cast around it**. The four construction sites and their rules:

- `src/roster/PlayerEditModal.tsx` — `player?.createdAt ?? Date.now()`, following the same rule as the adjacent `player?.id ?? crypto.randomUUID()`. This is the one site that must distinguish create from edit: an edit must never move a player to the top of "Recently added".
- `src/data/player-import.ts`'s `csvRowsToPlayers` — stamp `Date.now()` per row, **in parse order so ties are not created wholesale**.
- `src/shell/usePlayerImport.ts`'s JSON import — preserve the file's value when it is a finite number, else stamp. Same shape as the existing id rule on that line.
- `e2e/support/seed.ts` — `SeedWorld` players carry it; the seeded values are **monotonic** so "newest last" keeps the meaning that interface's comment already documents.

- [ ] **Step 4: Change what "recently added" means, and nothing else**

`recentPlayers` sorts by `createdAt` descending with ties broken by id ascending — exactly the tie-break `recentActiveTournaments` already uses in the same file — then slices the head. **The roster screen's own order is unchanged**: `useRoster` still applies no sort and the Roster list keeps its current display order. Changing both at once would move two visible surfaces for one decision. The stale doc comment at the top of `dashboardTeasers.ts` ("A Player carries no creation timestamp") is replaced with the new rule.

- [ ] **Step 5: Verify the suite did not move**

Run: `npx tsc -b && npx vitest run && npm run build && npm run e2e`
Expected: green, with `e2e/tests/dashboard/dashboard.spec.ts` **unedited** — the seeded ids and insertion order agree, so the reordering must not alter what that spec observes.

- [ ] **Step 6: Commit**

```bash
git add src/domain/types.ts src/dashboardTeasers.ts src/dashboardTeasers.test.ts src/roster/PlayerEditModal.tsx src/data/player-import.ts src/shell/usePlayerImport.ts e2e/support/seed.ts
git commit -m "feat(roster): a Player carries createdAt, and Recently added means it"
```

---

### Task 3: The public claims stop promising there is no account

**Files:**
- Modify: `index.html`, `public/404.html`, `PRODUCT.md`, `DESIGN.md`, `e2e/tests/landing/landing.spec.ts`
- Modify: `docs/spec/0001-team-builder-v1.md`, `.scratch/team-builder/spec.md`, `.scratch/debt/issues/34-durability-story.md`

**Interfaces:** none — this task changes prose and one assertion.

**The rule for every replacement:** a page may say the data **stays on the device by default** and may say an account is **optional**, but it must not assert the absence of a server, because after Task 6 there is one. Four strings currently do: `index.html:9` (meta description), `:183` (trust list), `:194` (CTA note), `public/404.html:124`. Ticket 34 is **resolved**, so its prohibition is amended in place rather than waited on.

- [ ] **Step 1: Correct the four page strings**

- `index.html:9` — drop "no account" from the description sentence. **Keep the offline half**, which is true today and stays true.
- `index.html:183` — the trust row. Its final wording is owned jointly with the now-landed B14 (three rows) and D33 (the restored offline row); **no row may claim the absence of an account or a server.**
- `index.html:194` — "Free, no account. Runs in your browser." becomes a statement that does not promise the absence of an account.
- `public/404.html:124` — remove "not on a server" from the sentence.

- [ ] **Step 2: Correct the assertion that pins the string**

`e2e/tests/landing/landing.spec.ts` asserts the CTA note contains "no account" — the only automated assertion of the claim anywhere. Rewrite it to whatever the corrected note says. **This is a copy change, so the "no spec edited" discipline that guards refactors does not apply here** (the same exemption Phase B's honest-claims work recorded).

- [ ] **Step 3: Reconcile the two documents read as current**

`PRODUCT.md:4`, `:24`, `:39` — the brief becomes local-first-with-an-optional-Account, and it **keeps multi-user and sync genuinely out of scope** (one Account owns its data; nothing is shared). `DESIGN.md`'s "Things that don't change" list — "IndexedDB-only persistence" and "JSON export/import" stay true for a Guest and become half-true overall; name the local-first default rather than the exclusion of a server. Both spec out-of-scope lines get the same corrected line and name **ADR-0007**, not ADR-0001. `docs/FLOW.md` is left alone deliberately: one Account is still one Organizer, so "a local-first single-user tool" stays true.

- [ ] **Step 4: Read the claims rather than grep them**

Run the grep from the ticket, then read every hit against the tree per `docs/agents/document-claims.md`. A denial contains no promise, so a scan for over-claiming cannot see a false one — this step is a reading, and the ticket says so.

Run: `grep -rniE 'no account|no server|no sign.?up|not on a server' index.html app/index.html public/ PRODUCT.md DESIGN.md`
Expected: nothing that asserts the absence of an account or a server.

- [ ] **Step 5: Verify and commit**

```bash
npm run build && npm run e2e    # the landing spec's copy assertion is the check
git add index.html public/404.html PRODUCT.md DESIGN.md e2e/tests/landing/landing.spec.ts docs/spec/0001-team-builder-v1.md .scratch/team-builder/spec.md .scratch/debt/issues/34-durability-story.md
git commit -m "docs(claims): the public copy stops promising there is no account"
```

---

### Task 4: An Account exists

**Files:**
- Create: `server/index.ts`, `server/webauthn.ts`, `server/google.ts`, `server/storage.ts`, `server/*.test.ts`
- Create: `src/account/session.ts`, `src/account/session.test.ts`, `src/account/AccountPanel.tsx`
- Create: `.env.example`
- Modify: `wrangler.jsonc`, `src/domain/types.ts`, `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: `src/domain/types.ts` for shared domain shapes (imported, never copied).
- Produces: the session module other tasks build on — `getSession(): { accountId: string } | null`, `signIn(...)`, `signOut()`, `refresh()`, and the one guard that answers "may this write reach the network". `Account` and `Credential` types live in `src/domain/types.ts`.

**This ticket introduces three firsts:** the repo's first Worker script, its first runtime secret, and its first environment read in client code. It builds **no sync** — identity and data movement fail in different ways, and a session that is wrong makes every later bug look like a sync bug.

- [ ] **Step 1: Correct the config's false comment, and bind D1**

`wrangler.jsonc` currently states there is "no Worker script and no `main`" — that becomes false here and is corrected in the same change, not left as a stale invariant. Add `main` pointing at `server/index.ts`, `assets.run_worker_first: ["/api/*"]`, and the **D1 binding** (`d1_databases`) that `server/storage.ts` reads the documents from. **The `run_worker_first` is not optional:** `compatibility_date` is `2026-09-14`, past the 2025-04-01 threshold where a navigation request does not invoke the Worker script even when the path matches — so without it, `fetch("/api/session")` reaches the Worker while a browser navigating to that path is served the assets fallback. `assets.directory: "./dist"` and `not_found_handling: "404-page"` stay exactly as they are.

**The store is D1, and this is the decision that makes Step 3's versioned push possible at all.** One table, one row per `(account, community)`: the pair as the key, a version integer, and the v5 payload as a JSON column. A conditional `UPDATE … WHERE version = ?` against the primary is the atomic compare-and-swap the push needs; **KV and R2 cannot do it and are not alternatives** — KV is eventually consistent and resolves concurrent writes to the same key as last-write-wins, which is precisely the silent overwrite Task 6 exists to prevent (`docs/adr/0007`). Durable Objects would also be correct, at the cost of namespaces and migrations for one write path.

**The canonical origin is a custom domain, and the decision is timed rather than blocking.** A `*.workers.dev` host is on the Public Suffix List's private section and can never share a passkey with a custom domain, so the domain has to be settled **before real organizers can register** — the moment a credential stops being test data. It does **not** block this task: build and test against `localhost` and `workers.dev`, where passkeys are disposable. **Do not stop waiting for the domain**, but record in `wrangler.jsonc` that the `workers.dev` host is the development origin and not the canonical one, so the next reader does not mistake an unsettled decision for a settled one (`docs/adr/0008`).

- [ ] **Step 2: Write the failing session test**

`src/account/session.test.ts`, over a stubbed `fetch`:

```ts
it("makes no request while signed out", async () => {
  const calls: string[] = [];
  stubFetch((url) => { calls.push(url); return json({}); });
  signOut();
  await pushCommunity("c1");
  expect(calls).toEqual([]);
});

it("a 401 leaves the local data readable and the guard closed", async () => {
  stubFetch(() => new Response("", { status: 401 }));
  setSession({ accountId: "a1", token: "stale" });
  await refresh();
  // The session survives for reading; nothing was cleared.
  expect(getSession()).not.toBeNull();
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run src/account/session.test.ts`
Expected: FAIL — `Failed to resolve import "./session"`.

- [ ] **Step 4: Build the server**

`server/index.ts` routes `/api/*` and answers everything else by falling through to the assets. Registration and sign-in follow ADR-0008: **the Account is its own opaque key**, a passkey contributes a credential record, Google contributes an `iss` + `sub` pair, and a verified email is an attribute used to find an Account and to notify its owner — **never the value two identities are joined on**. Attaching a second way in is an explicit act by an already-signed-in Organizer; there is no path where presenting a Google token merges into an existing Account because an address matched. The server stores credentials, never a password, and **uses `@simplewebauthn/server` (v13) rather than hand-rolling the verification** — Google's own guidance says so and the specification is still subject to change, so the library is named here rather than left as "a library": it is the piece ADR-0008 says is part of the decision. It has a matching browser half (`@simplewebauthn/browser`), which is the only client-side dependency this task adds. Store `signCount` and the backup-eligibility/backup-state flags per credential; **never hard-fail on a non-increasing `signCount`** (the spec calls it "a signal, but not proof", and failing closed locks out a synced passkey used from a second device). The user handle is 64 random bytes with no PII.

- [ ] **Step 5: Build the client session module**

One module holds the current session, the token, and the three operations. Every other caller asks it. **It owns the guard** — the single answer to "may this write reach the network" — because a question with one answer must not be answered per call site.

- [ ] **Step 6: The panel, and the environment read**

`AccountPanel` shows who is signed in and offers sign-in/sign-out, reachable without navigating away from where the Organizer already is. It is placed in `src/shell/`, **not** in `App.tsx`. The client reads **one** new variable for the API base through `import.meta.env` — the repo's first such read — with a documented default that works in development. Add `.env.example`; `.gitignore` already covers the real files. Server secrets go through `wrangler` and are never committed.

- [ ] **Step 7: Prove it end to end, then verify the Guest path**

Run: `npx tsc -b && npx vitest run && npm run build && npm run e2e`
Then, against a deployed preview, by hand: create an Account by passkey and by Google; sign in from a second device with a **synced** passkey and count credential rows (must not insert a second); attempt a cross-origin sign-in and expect failure. Navigate a browser **directly** to an API path — not via `fetch` — and see the API answer rather than the assets fallback.

Expected: `npm run e2e` green **with no spec edited**. The Guest path is the regression surface.

- [ ] **Step 8: Commit**

```bash
git add server src/account src/domain/types.ts wrangler.jsonc .env.example .github/workflows/ci.yml
git commit -m "feat(account): an optional Account exists, and the app knows who is signed in"
```

---

### Task 5: Signing in moves the data

**Files:**
- Create: `src/account/useAccount.ts`
- Test: `src/account/useAccount.test.ts` or a focused pure-function test
- Create: `e2e/tests/account/lifecycle.spec.ts`
- Modify: `src/shell/useLegacyAdoption.ts` (the guard's shape), `src/account/AccountPanel.tsx`

**Interfaces:**
- Consumes: Task 1's v5 payload (`serializeBackup`/`parseBackup`), Task 2's `createdAt`, Task 4's session module.
- Produces: adopt-on-sign-in and clear-on-sign-out. Task 6's push needs an adoption boundary to be correct at the moment it starts.

**Three hazards live in code that runs on load, and all three are already in the tree:**

1. **The orphan-repair effect writes immediately.** `src/shell/useLegacyAdoption.ts` re-homes records whose `communityId` is falsy or unknown, calling `savePlayer` and `sessionStore.saveSession` in a `useEffect`. After a sign-out empties the stores it runs again against an empty world, and the first-run path recreates `community-default` (`src/domain/useCommunities.ts`) and re-seeds the catalog (`src/domain/useDisciplines.ts`). **Nothing may reach the network while signed out, and this is the effect that would try.** The clean answer is that these effects must not fire a sync at all during a clear — which is why the guard lives beside the data it protects rather than in the effect.
2. **The ad-hoc split swallows persistence failures.** `src/shell/useSplitFlow.ts` catches a failed `saveSession` and notifies ("Non-fatal: still show the split if persistence failed"). A sync failure must land in the same place: a degraded sync, never a broken screen.
3. **There is no ordering key to adopt by** — which is exactly what Task 2 supplied.

- [ ] **Step 1: Write the failing test for the destructive-case rule**

```ts
it("asks before replacing, and the question names the counts", () => {
  const local = { players: 7, squads: 2 };
  expect(needsAdoptConfirm({ localPlayers: 7, localSquads: 2, accountHasData: true }))
    .toEqual({ ask: true, counts: local });
});

it("never asks when the local roster is empty, because that is noise", () => {
  expect(needsAdoptConfirm({ localPlayers: 0, localSquads: 0, accountHasData: true }).ask).toBe(false);
});

it("never asks when the Account has no data, because adopting destroys nothing", () => {
  expect(needsAdoptConfirm({ localPlayers: 7, localSquads: 2, accountHasData: false }).ask).toBe(false);
});
```

- [ ] **Step 2: Run it to verify it fails**, then implement the three rules the test names.

- [ ] **Step 3: Adopt, pull, and clear**

On a successful sign-in with an Account that has never synced, the device's Communities, Players, Sessions, Tournaments, Saved Squads and custom Disciplines become the Account's initial state, uploaded as the v5 payload. **A sign-in never overwrites an Account that has already synced** — adoption is guarded by the *account's* state, not the device's: existing server state is fetched and rendered, and the device's records are only ever offered as a deliberate choice. That guard is the single most important rule in this task; under the old model a bad overwrite damaged only the local copy, and now it is the one path that can destroy the authoritative copy. Signing in on an empty device pulls the Account's payload through the stores and refreshes the hooks so the render source is the fetched data — the write-then-refresh order the import path already uses.

Explicit sign-out empties every domain store (using `replaceAll*`, or `delete*` in a loop for the catalog, which has no `replaceAll*`) and clears the `tb-` account-scoped keys. **`tb-theme`, `tb-layout` and `tb-rail` are kept**, because a theme choice belongs to the device rather than the Account. **A 401 never clears anything**: only an explicit sign-out is destructive, so a signed-in Organizer on a court with no signal still has a working app.

**A pending offline write blocks sign-out, or is discarded behind an explicit confirm** — the stores are about to be emptied and a queued write has nowhere to go once they are gone.

- [ ] **Step 4: Label the state honestly**

The UI states which state the data is in, using CONTEXT.md's vocabulary: **"On this device"** and **"In your Account"**. It appears where sign-out lives, and it says what changes without implying a lesser tool. The adoption gate is the repo's one documented `window.confirm`, following the existing import merge rather than inventing a modal — **say so in a comment** so the next reader does not read it as a violation of Phase D's rule.

- [ ] **Step 5: Write the lifecycle e2e spec**

`e2e/tests/account/lifecycle.spec.ts`, against a test server: sign in with data present → the adopt prompt appears → the roster survives → sign out → the stores are empty and the app is usable as a Guest again. Also assert **zero requests** after a sign-out plus a mutation.

- [ ] **Step 6: Verify and commit**

```bash
npx tsc -b && npx vitest run && npm run build && npm run e2e
git add src/account e2e/tests/account src/shell/useLegacyAdoption.ts
git commit -m "feat(account): signing in adopts this device, signing out clears it"
```

---

### Task 6: The Account stays authoritative

**Files:**
- Create: `src/account/sync-decision.ts`, `src/account/sync-decision.test.ts`, `src/account/useSync.ts`
- Create: `server/sync.ts`, `server/sync.test.ts`
- Create: `e2e/tests/account/stale-push.spec.ts`
- Modify: `src/account/AccountPanel.tsx`

**Interfaces:**
- Consumes: Task 5's adoption boundary, Task 4's session guard.
- Produces: `decideSync(local, lastKnownVersion, serverVersion)` → `"push" | "push-and-adopt" | "reject-stale" | "no-op"`.

**The failure this task exists to prevent is invisible today.** Every save is a whole-document upsert, and nothing carries `updatedAt`/`deletedAt`/`revision`, so writes are last-write-wins with no compare-and-swap anywhere. Two devices editing one Community produce a silent overwrite in which the loser's evening is gone and nothing reports it.

- [ ] **Step 1: Write the failing test — all four outcomes**

```ts
it("rejects a push based on a version the server has moved past", () => {
  // The silent-loss case: another device wrote first.
  expect(decideSync(local(1), { lastKnown: 3, server: 4 })).toBe("reject-stale");
});

it("pushes when the version is unchanged", () => {
  expect(decideSync(local(2), { lastKnown: 4, server: 4 })).toBe("push");
});

it("is a no-op when the payload is already what the server holds", () => {
  expect(decideSync(local(2), { lastKnown: 4, server: 4, identical: true })).toBe("no-op");
});

it("adopts when the server is ahead and nothing local is pending", () => {
  expect(decideSync(null, { lastKnown: 3, server: 4 })).toBe("push-and-adopt");
});
```

- [ ] **Step 2: Run it to verify it fails**, then implement the pure function. **It lives outside React and is tested directly**, because its failure mode is data loss and pinning that only through a browser test would be luck.

- [ ] **Step 3: The debounced, versioned, whole-Community push**

After a mutation while signed in, upload the active Community's collections as one document. Bursts are coalesced so a roster edit session produces **one** upload rather than one per keystroke, and the delay is short enough that a closed tab has almost certainly flushed. The push reads the payload the export already builds — there is no second serialization path. The server stores one JSON document per `(account, community)`: the v5 payload plus a version integer, with **no normalized tables and no foreign keys**. Player deletion legitimately leaves dangling ids in `poolPlayerIds`, `result.teams[].slots[].playerId` and `matches[].teamId` — tolerated at read time by one filter (`src/session/SplitScreen.tsx`) — and a relational schema would reject what the app deliberately does. **The Account is identified by the token, never by the payload.**

- [ ] **Step 4: A rejected push says so**

The Organizer is told the Account changed on another device and offered the reload. Silently clobbering is the bug; **silently refusing is the second bug**, because a refused write that says nothing looks like a save that worked. The message names the Community and offers the choice: take the server's version, or push this device's over it deliberately. A failed push is non-fatal — it degrades sync and never blocks the screen, matching `useSplitFlow.ts`'s existing treatment of a failed persistence call.

- [ ] **Step 5: Persist the version keys, and prove the silent-loss case**

The last-known version and the adoption marker persist per Account under new `tb-` keys following the existing try/catch convention in `src/shell/usePreferences.ts`; a blocked `localStorage` degrades to re-checking with the server rather than throwing. Then write `e2e/tests/account/stale-push.spec.ts`: two clients on the same version, the first accepted, the second rejected, and the first client's data intact on the server.

- [ ] **Step 6: Verify and commit**

```bash
npx tsc -b && npx vitest run && npm run build && npm run e2e
git add src/account server/sync.ts server/sync.test.ts e2e/tests/account
git commit -m "feat(sync): the Account stays authoritative, and a stale device is refused"
```

---

## Self-Review

**Spec coverage.** Every exit criterion in `.scratch/backend/spec.md` and the roadmap spec's Phase E section maps to a task:

| Spec criterion | Task |
|---|---|
| A custom Discipline survives export, import, and a move between devices | 1 Steps 3–6 |
| `Player.createdAt`; the Dashboard teasers are identical before and after a sign-in | 2, re-asserted in 5 Step 5 |
| No public statement promises the absence of an account or a server | 3 Steps 1–4 |
| An Account can be created and signed into; Google and passkey both offered | 4 Steps 4–7 |
| The Account is its own opaque key; email is an attribute, never the join | 4 Step 4 |
| A synced passkey reuses its credential record; a non-increasing `signCount` does not fail auth | 4 Step 4, asserted at Step 7 |
| Passkeys do not cross origins | 4 Step 1 (the domain decision), verified at Step 7 |
| Signing in adopts; signing out empties; a 401 clears nothing | 5 Steps 3–4 |
| A pending offline write blocks or confirms sign-out | 5 Step 3 |
| Edits reach the Account; a burst is one push | 6 Step 3 |
| Two clients on one version: the second is rejected and the first survives | 6 Step 5 |
| A rejected push names the conflict and does not silently replace local data | 6 Step 4 |
| A failed request degrades a write, never a screen | 6 Step 4 |
| The document round-trips through `parseBackup`, `disciplines[]` included | 1 Step 1, 6 Step 3 |
| **The guest suite is unchanged and green** | every task's final verify step |
| `npx tsc -b` / `npx vitest run` exit 0 | every task's final verify step |

**Placeholder scan, stated so it cannot be self-defeating.** The claim worth making is not "no such phrase appears" — a sentence naming the phrases in order to deny them makes that false of the file that contains it, and the product-completion plan recorded exactly this correction against itself. **The claim that holds and was checked by reading the steps: every step names either runnable code or a command with an expected result, and no step defers its work to a later one.** Three steps state a rule without a code block — Task 4 Steps 4, 5 and 6, which implement ADR-0008 rather than a shape this plan can dictate — and each names the ADR section that decides it, which is the authority a reader needs rather than a copied snippet.

**Type consistency.** `decideSync`'s four string outcomes are what `useSync` branches on and what `sync-decision.test.ts` asserts. The session module's four exports (`getSession`, `signIn`, `signOut`, `refresh`) are what Tasks 5 and 6 consume; no task redeclares them. `BackupData` v5 is one shape, consumed as the wire format by both 5 and 6. `Account` and `Credential` are declared once, in `src/domain/types.ts`, and imported by `server/` — never copied (the drift `docs/spec/0002` is the precedent for).

**Three places the tickets' line anchors are stale, and this plan cites what it read.** Every ticket was written before Phase C and D finished decomposing `src/App.tsx`, so each one's `App.tsx:NNN` now points into a file that no longer holds that code. The regions moved; the reasoning did not, and each is preserved:

1. **The export call site.** Ticket 01 says `src/App.tsx:416` holds the catalog and the sessions are re-read at `:414`. Measured now: `handleExport` is in **`src/shell/useAppCommands.ts`** (`serializeBackup(...)` at `:199`), which App calls; the catalog reaches it as a new dep rather than being read from hook state at the call site.
2. **The JSON import and the merge loop.** Ticket 01 cites `src/App.tsx:435-474` and ticket 02 cites `App.tsx:572`. Both are now **`src/shell/usePlayerImport.ts`** — `confirmMerge` writes communities-then-players at `:282-294`, and the JSON id rule is `:350`. Ticket 05's `App.tsx:308-313` (the swallowed persistence catch) is **`src/shell/useSplitFlow.ts:257`**, and its `App.tsx:225-237` orphan-repair effect is **`src/shell/useLegacyAdoption.ts`**.
3. **The preference keys.** Ticket 06 cites `App.tsx:93-108` for the `tb-` try/catch convention; that is now **`src/shell/usePreferences.ts`** (`useStoredPref`, plus `useThemeAndLayout` which this phase's predecessor added).

The line numbers in Task 1's and Task 2's *Files* lists were resolved by reading the symbols, not the tickets' numbers — `serializeBackup` at `src/data/transfer.ts:22`, `parseBackup` at `:106`, the version gate at `:115`, `recentPlayers` at `src/dashboardTeasers.ts:14-16`, `csvRowsToPlayers` at `src/data/player-import.ts:185`.

**Two decisions this plan makes that the spec left open, both stated rather than assumed.**

1. **The `window.confirm` in Task 5 is an exception to Phase D's "no native dialogs" constraint, and it is deliberate.** Ticket 05 requires a confirm naming what is at stake, and the app's existing precedent for exactly this gate is the import merge's `confirm`. Inventing a modal for it would add a second pattern for one prompt. The exception is written into the code, per `contracts.md`'s rule that a grant is recorded where it applies.
2. **Task 4 can stop.** If the custom domain is not available, no credential can be registered against a canonical origin, and registering against `workers.dev` first means registering every credential twice. The task says **stop and report** rather than proceed with a provisional origin.

**The one thing this plan cannot schedule.** Ticket 34's durability work is **resolved** and shipped, so the roadmap spec's "ticket 34 lands before E05" is satisfied by history rather than by an ordering constraint. Nothing in the plan waits on it.

**What is not tested, and why.** The auth provider's own correctness, TLS, and everything the platform guarantees. The suite tests this app's decisions, not Cloudflare's or Google's.
