# 14: The landing page claims only what ships

**Status:** ready-for-agent

**What to build:** Every claim on the Landing Page at `/` is either true of the build today, is
removed, or is marked as restored by a later ticket. The page stops promising a proven minimum
for tournanent-sized pools, stops promising an offline mode that does not exist, and stops
advertising a discipline that is not shipped.

**Evidence.** The audit's landing table, verified against the source:

| Claim | Reality |
|---|---|
| "the smallest strength gap that exists for that pool — **exact, not estimated**" (`index.html:72-73`) | true for 2 teams; best-found for 4+ (measured: 20 players / 4 teams → `optimal: false`, 4,000,001 nodes) |
| "The gap is the **proven minimum** for your pool, not a heuristic." (`index.html:181`) | not proven in the common case |
| "**Works with no signal.** The court has no wifi." (`index.html:182`) | `grep -rn "serviceWorker\|manifest.json\|workbox" src/ index.html app/index.html` → no matches; `public/` holds only `404.html`, `_headers`, `comp3tive.svg`; fonts load from `fonts.googleapis.com` (`index.html:25-29`) |
| `<meta name="description">` "Works offline, no account." (`index.html:9`) | no service worker, no manifest |
| "Futsal, MLBB, **badminton**" (`index.html:73`) | `SEED_DISCIPLINES = [FUTSAL_DISCIPLINE, MLBB_DISCIPLINE]` (`src/domain/seed.ts:52`) |
| Badminton card, roles `Singles`/`Doubles`, `1v1 or 2v2` (`src/landing.tsx:110-116`) | not a shipped discipline |
| "Disciplines **3+**" (`index.html:157`) | two shipped seeds |
| "Your data stays on your device. No account, no server." (`index.html:183`) | **true** (IndexedDB, ADR-0001) |
| "Free, no account. Runs in your browser." (`index.html:194`) | **true** |
| "Then run the tournament … **3** formats" (`index.html:133-134`) | **true** (series / single-elim / swiss) |

One claim **does** verify and must be preserved: the hero renders live solver output over a real
roster, and its advertised `GAP 0.10` is genuinely optimal. Verified by hand and by probe:
strengths `4.25×1, 4.0×4, 3.25×5` (sum 36.5), no 5-subset sums to 18.25, so the best achievable
split is 18.0/18.5 → gap 0.1. The probe returns `optimal: true`, `nodesExplored: 51`,
`gap: 0.10000000000000009` → `toFixed(2)` = `0.10`.

**What to build, exactly.**

1. **Trust list** (`index.html:180-184`) becomes exactly three rows, in this order:

```html
<li>The gap is the proven minimum for a two-team split.</li>
<li>Your data stays on your device. No account, no server.</li>
<li>Free, no account. Runs in your browser.</li>
```

The offline sentence is **deleted, not softened**. It is restored by Phase D02 when the manifest
and service worker ship, at which point row 3 becomes `Works with no signal. The court has no
wifi.` again. This sequencing is frozen in `contracts.md`.

2. **Lede** (`index.html:71-74`) becomes:

```html
comp3tive splits your roster into teams with the smallest strength gap it can prove, honoring
every role along the way. Futsal, MLBB, badminton, then the tournament on those teams.
```

3. **`<meta name="description">`** (`index.html:9`) drops its offline half:

```html
content="comp3tive splits your group into balanced teams with the smallest possible strength gap, then runs the tournament. No account, no sign-up."
```

4. **Two more overclaims on the same page:**
   - `index.html:123` — "you watch the number that proves it" → "you watch the number that shows it".
   - `index.html:145` — "the solver just proved fair" → "the solver just balanced".

5. **Badminton and the discipline count** are B19's decision. B14 carries the edit, driven by
   B19's outcome:
   - If B19 ships badminton: keep the card, replace its content with B19's corrected `desc`,
     `roles`, `attributes`, and `teamSize` strings, and set the Roster rail's `Disciplines` fact
     (`index.html:157`) to `3`.
   - If B19 removes it: delete the card from `DISCIPLINES` (`src/landing.tsx:110-116`), drop
     "badminton" from the lede, and set the rail fact to `2`.

   B19 ships badminton, so the resolved values are: keep the card with
   `roles: ["Front court", "Rear court"]`, `teamSize: "2 v 2"`, and the rail fact `3`.

6. **Every claim, mapped.** This table is the acceptance surface:

| Claim (file:line) | Verdict | Action |
|---|---|---|
| `GAP 0.10`, live solver output (`src/landing.tsx:210-217`) | **true today** (`optimal: true`, 51 nodes) | keep |
| "smallest strength gap" (`index.html:72`) | true as a phrase | keep |
| "exact, not estimated" (`index.html:73`) | overclaim | reword to "it can prove" |
| "the number that proves it" (`index.html:123`) | overclaim | reword |
| "the solver just proved fair" (`index.html:145`) | overclaim on 3+ teams | reword |
| "Re-rolls ∞", "re-roll until it says what you want" (`index.html:111`, `:123`) | falsified today (re-roll is a no-op) | **restored by A03**; copy unchanged |
| "3 formats" (`index.html:133-134`) | **true today** | keep |
| "Disciplines 3+" (`index.html:157`) | false (2 seeds) | `3` after B19 |
| Badminton card (`src/landing.tsx:110-116`) | false as written | corrected by B19's strings |
| "proven minimum for your pool" (`index.html:181`) | overclaim | scoped to "a two-team split" |
| "Works with no signal" (`index.html:182`) | false | **removed by B14, restored by D02** |
| "stays on your device" (`index.html:183`) | **true** | keep verbatim |
| "Free, no account. Runs in your browser." (`index.html:194`) | **true** | keep; promoted to the trust list |
| "Works offline" in meta (`index.html:9`) | false | removed |
| "fair teams for futsal nights, MLBB sessions" (`index.html:200`) | **true** | keep |

7. **Preserved, do not touch:** the rail labels `["Split","Edit","Play","Roster","Open"]`
   (`index.html:80,105,127,152,171`); the wordmark SVG and its `<title>` (`index.html:54-63`); the
   footer (`index.html:200`); the CTA (`index.html:185-193`) and its note (`:194`); the hero's
   live `data-landing-gap` fill (`src/landing.tsx:210-217`); the deal animation; the bracket
   preview; the theme tokens.

8. **The e2e spec edit is required, not optional.** This is the one place the repo currently
   *enforces* the false claims. `e2e/tests/landing/landing.spec.ts:57-63`:

```ts
const trust = page.locator(".landing-trust li");
await expect(trust).toHaveCount(3);
await expect(trust).toContainText([
  "proven minimum",
  "no signal",
  "stays on your device",
]);
```

becomes:

```ts
const trust = page.locator(".landing-trust li");
await expect(trust).toHaveCount(3);
await expect(trust).toContainText([
  "proven minimum for a two-team split",
  "stays on your device",
  "no account",
]);
```

   Notes for the executor:
   - **Phase C's "no spec edited" rule does not apply to B14.** That rule guards
     behaviour-preserving refactors. B14 changes user-visible copy, so editing this spec is
     correct. Do not preserve the old assertions to keep the file byte-stable.
   - `"stays on your device"` stays — that claim is true and its assertion is not weakened.
   - **D02 edits these assertions again** when the service worker lands (row 3 becomes the
     offline sentence once more). Leave that handoff note in this ticket's `## Comments` when
     the work lands.
   - Everything else in `landing.spec.ts` survives untouched: the rail-label assertion (`:49-55`),
     the lede assertion `"smallest strength gap"` (`:47`), the wordmark accessible name (`:46`),
     the CTA assertions (`:72-73`, `:86-87`), the hero mount assertions (`:95-113`), the deal
     suite, the theme assertions, and all five redirect specs.

9. **Add one spec** pinning the corrected copy, so the offline promise cannot creep back: assert
   the trust list's text contains no `no signal`, and that the lede contains `it can prove`. It
   lives in `e2e/tests/landing/landing.spec.ts` and follows A01's seeded conventions.

**Acceptance criteria:**
- [ ] The landing page's trust list has exactly three items and contains no substring `no signal`
- [ ] The lede contains `it can prove` and still contains `smallest strength gap`
- [ ] The `<meta name="description">` contains neither `Works offline` nor `badminton`
- [ ] The Roster rail's `Disciplines` fact reads `3`, matching `SEED_DISCIPLINES.length` after B19
- [ ] The badminton card's roles read `Front court` and `Rear court`, and its size reads `2 v 2`
- [ ] The hero still renders live solver output, and the rail's Gap reads `0.10` for the shipped roster
- [ ] `e2e/tests/landing/landing.spec.ts`'s trust-list assertion matches the corrected strings and the file passes
- [ ] The new copy-pinning spec exists and passes
- [ ] The rail labels, wordmark, footer, CTA, and deal suite are unchanged and their specs pass
- [ ] `npm run e2e` passes overall

**Blocked by:** 19 (the badminton card's final content and the discipline count depend on B19's
outcome). The trust-list, lede, meta, and `:123`/`:145` edits are independent and can land first.

## Comments

Handoff to Phase D02: when the manifest and service worker ship, restore the offline claim.
`index.html` trust list row 3 becomes `Works with no signal. The court has no wifi.`, the meta
description regains `Works offline, `, and `e2e/tests/landing/landing.spec.ts`'s third trust
assertion changes from `"no account"` back to `"no signal"`.
