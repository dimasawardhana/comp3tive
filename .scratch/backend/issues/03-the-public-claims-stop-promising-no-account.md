# 03: The public claims stop promising there is no account

**Status:** ready-for-agent

**What to build:** Every public and product statement that asserts comp3tive has no account and no
server is corrected to say what is true once an Account is optional, and the one prohibition that
forbids this feature is amended.

**Evidence.** Four user-facing strings promise the opposite of this feature, and one of them is a
grep gate that would fail the build:

| Location | Current text |
|---|---|
| `index.html:9` (meta description) | "comp3tive splits your group into balanced teams with the smallest possible strength gap, then runs the tournament. Works offline, **no account**." |
| `index.html:183` (trust list) | "Your data stays on your device. **No account, no server.**" |
| `index.html:194` (CTA note) | "Free, **no account**. Runs in your browser." |
| `public/404.html:124` | "Your data is untouched — it lives in this browser, **not on a server.**" |

And two documents state it as an invariant:

```
DESIGN.md:198-199
- IndexedDB-only persistence
- JSON export/import (data portability is the migration path)

PRODUCT.md:4
... Stores everything in IndexedDB; no backend, no auth, no network.
PRODUCT.md:24
## What's NOT in scope (v1)
- Auth, multi-user, sync
PRODUCT.md:39
- Single-user, single-device (data lives in browser IndexedDB)
```

Plus two spec out-of-scope lines — `docs/spec/0001-team-builder-v1.md:90` and its duplicate
`.scratch/team-builder/spec.md:93`, both reading "Backend, multi-user, auth — deferred by ADR-0001" —
and the ticket that *forbids* the feature outright:

```
.scratch/debt/issues/34-durability-story.md:51
- [ ] No sync, no cloud backup and no file-system integration is introduced; the export/import pair
      is the whole mechanism, per ADR-0001.
```

`.scratch/app-health/issues/12:46-47` states the escalation rule that applies: "changing that is an
ADR, not a ticket." ADR-0007 is that ADR, and it is written.

**What to build, exactly.**

1. **The prohibition in ticket 34 is amended, not deleted.** Replace acceptance criterion 51 with a
   statement of the split: the export/import pair remains the whole mechanism **for a Guest**, and an
   Account is a separate copy introduced by `.scratch/backend/`, which does not replace ticket 34's
   work and does not ship before it. Ticket 34 keeps its value and lands first.
2. **The four page strings lose the account claim.** The rule for the replacement wording: a page may
   say the data **stays on the device by default** and may say an account is **optional**, but it
   must not assert the absence of a server, because after ticket 06 there is one.
   - `index.html:9` — drop "no account" from the description sentence. The offline half is
     **preserved**, because it is true today and stays true.
   - `index.html:183` — this is the trust row, and its final wording is owned jointly with ticket 14
     (which rewrites this list to exactly three rows and has not landed) and ticket 33 (which restores
     an offline row when the service worker ships, and may not push the list past three). This ticket
     specifies the constraint only: **no row may claim the absence of an account or a server.** If
     ticket 14 has landed, its "Your data stays on your device. No account, no server." row is
     rewritten in place; if it has not, this ticket corrects the row that is on the page now.
   - `index.html:194` — "Free, no account. Runs in your browser." becomes a statement that does not
     promise the absence of an account.
   - `public/404.html:124` — "not on a server" is removed from the sentence.
3. **`PRODUCT.md` is reconciled.** `:4` (the "no backend, no auth, no network" sentence) becomes a
   statement that the app is local-first with an optional Account; `:24`'s "Auth, multi-user, sync"
   line is replaced, keeping **multi-user and sync genuinely out of scope** (ADR-0007: one Account
   owns its data, nothing is shared); `:39`'s "Single-user, single-device" constraint becomes a
   statement of the guest default plus the Account's cross-device reach. The brief must not claim a
   capability the app lacks, in either direction.
4. **The landing spec asserts the string, so it is part of this ticket.** `e2e/tests/landing/landing.spec.ts:63`
   reads `await expect(page.locator(".landing-action-note")).toContainText("no account");` — the only
   automated assertion of the claim anywhere. Correcting the copy without correcting this line leaves
   the suite red, and this is a copy change, so the "no spec edited" discipline that guards Phase C's
   refactors does not apply (the same exemption Phase B's honest-claims work recorded for `B14`). The
   spec's assertion is rewritten to whatever the corrected CTA note says.
5. **`DESIGN.md`'s "Things that don't change" list is corrected.** "IndexedDB-only persistence" and
   "JSON export/import (data portability is the migration path)" are both still true for a Guest and
   become half-true overall. The two bullets are reworded to name the local-first default rather than
   the exclusion of a server. Nothing else in the list changes.
6. **The two spec out-of-scope lines are corrected.** `docs/spec/0001-team-builder-v1.md:90` and
   `.scratch/team-builder/spec.md:93` are near-duplicates and have already drifted once
   (`docs/spec/0002` is the precedent). Both get the same corrected line, and the correction names
   ADR-0007 rather than ADR-0001.
7. **`docs/FLOW.md:174-175` is left alone, deliberately.** "No URL routing, no browser back/forward: a
   local-first single-user tool" stays true: one Account is still one Organizer, there is still no
   collaboration, and the navigation contract is unchanged by ADR-0007. Recorded here so the next
   reader does not "fix" it.

**Acceptance criteria:**
- [ ] `grep -rniE 'no account|no server|no sign.?up|not on a server' index.html app/index.html public/`
      returns nothing
- [ ] `grep -niE 'no account|no server' README.md` returns nothing, or only lines that explicitly deny
      the claim — ticket 30's own gate, kept satisfiable. If ticket 30 has landed, its README text is
      corrected in the same pass so the gate still passes
- [ ] `index.html`'s trust list has at most three rows and none asserts the absence of an account or a
      server
- [ ] `PRODUCT.md` no longer contains the strings "no backend, no auth, no network",
      "Auth, multi-user, sync" in its not-in-scope list, or "Single-user, single-device"; it still
      lists multi-user and sync as out of scope
- [ ] `DESIGN.md`'s "Things that don't change" list names no invariant this feature breaks, and its
      remaining bullets are unchanged
- [ ] `.scratch/debt/issues/34-durability-story.md:51` no longer forbids sync unconditionally, and the
      amendment names ADR-0007 and `.scratch/backend/`
- [ ] `docs/spec/0001-team-builder-v1.md:90` and `.scratch/team-builder/spec.md:93` carry the same
      corrected line
- [ ] `e2e/tests/landing/landing.spec.ts:63` no longer asserts `"no account"` on
      `.landing-action-note`, and the landing spec passes against the corrected copy
- [ ] `npm run build` exits 0 and `npm run e2e` is green — the landing spec asserts page content, so a
      copy change must survive it

**Blocked by:** 01 and 02 only in the sense of ordering hygiene; nothing technical. It is sequenced
before 04 because a repository that says "no account" while offering one is worse than either state
alone.

**Notes:** This ticket changes copy and policy, never behavior. Do not touch the Landing Page's
structure, the Ledger composition, or `assets.not_found_handling`. The trust list's exact final
wording is shared with tickets 14 and 33; this ticket asserts the constraint and corrects what is on
the page today, and must not be the ticket that lands a four-row list.

One more document this falsifies, verified before writing. The Phase B honest-claims spec tabulates
each trust string and its verdict, and records the account claim as **true**
(`docs/superpowers/specs/2026-09-17-honest-claims-design.md:307-309`), with its plan repeating the
text at `docs/superpowers/plans/2026-09-17-honest-claims.md:1410-1411`, `:1431`. Those are records of
a completed phase rather than live claims, so they are **left in place**: that phase's verdict was
correct for its HEAD, and rewriting it is how a decision record stops being one. The documents that
must not go stale are `DESIGN.md` and `PRODUCT.md` (items 3 and 5), which are read as current.
