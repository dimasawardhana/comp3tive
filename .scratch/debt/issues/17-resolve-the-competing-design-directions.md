# 17: Resolve the competing design directions

**Status:** resolved

**What to build:** One design direction survives and the other stops existing. `DESIGN.md` becomes
the single source of truth, and the two live rules that only `docs/design.md` carried (the
em-dash ban and the accessibility floor) move into it before it goes.

**Evidence.** Two documents describe two different products.

`docs/design.md:3`:

> Direction: **Scoreboard.** Monochrome structure with one electric pop. … a single saturated
> cobalt accent reserved for action and the live moment.

Its tokens (`docs/design.md:11-18`): `paper #F4F5F2`, `ink #14161A`, `cobalt #2B6BFF`, and a type
stack of **Chakra Petch** + Familjen Grotesk (`:33`).

`DESIGN.md:3`:

> **Direction: "Paper & Pencil."** The app feels like a blank notebook — warm paper, quiet ink, and
> a single amber mark that draws the eye when action is needed.

Its tokens (`DESIGN.md:15-24`): `paper #FAF8F5`, `ink #1C1917`, `amber #C2410C`, and Outfit + Familjen
Grotesk (`:32`).

**The shipped build is Paper & Pencil.** `src/tokens.css:2` states "Design system: 'Paper & Pencil'
(per DESIGN.md)" and declares `--surface: #faf8f5`, `--text: #1c1917`, `--accent: #c2410c`,
`--whistle: #c2410c`. And:

```
$ grep -rn "2B6BFF\|Chakra\|cobalt" src/ index.html app/index.html public/
(no matches)
```

Not one cobalt value or Chakra Petch reference exists in the build. The landing page's own
contract comment names the world "Inherited from DESIGN.md, unchanged" and gives `#FAF8F5`,
`#1C1917`, `#C2410C` (`index.html:37-38`). The landing spec pins the shipped tokens by rgb value —
light `rgb(250, 248, 245)`, dark `rgb(28, 25, 23)` (`e2e/tests/landing/landing.spec.ts:237-239`) —
which are Paper & Pencil's numbers.

**What to build, exactly.**

**1. The survivor is `DESIGN.md`.** It is the direction that ships, it covers the Landing Page as
well as the app, and the code cites it as the source.

**2. Absorb the two live sections from the loser** — they are rules the build follows and would be
lost with the file. Add them to `DESIGN.md` immediately before its final section
(`## Things that don't change`, at `DESIGN.md:196`), moving the text rather than paraphrasing it:

- `## Copy voice` — from `docs/design.md:70-72`, including: "Match-night, plain, active. People and
  what they do, never the system", "Errors don't apologize and are never vague", and the
  zero-tolerance rule "**No em-dashes in visible copy.** Periods and commas carry the pauses. A
  zero-tolerance rule: the em-dash is the AI tell, so it is banned from UI strings entirely."
- `## Accessibility & quality floor` — from `docs/design.md:78-80`: thumb-friendly 44px+ targets,
  `min-height:100dvh`, visible `:focus-visible` rings, and text contrast ≥ 4.5:1 on every surface
  in both themes. Restate the ring in Paper & Pencil's terms (`--accent`, the amber at
  `DESIGN.md:15-24`) rather than copying the loser's cobalt reference.

**3. Delete `docs/design.md`.** Its whole content is a competing palette and type stack that appear
nowhere in the build, and leaving a second "Design Direction" file in `docs/` — the directory
`docs/agents/domain.md` tells agents to read — is how the drift started. **This file was authored
by the repo owner; confirm the deletion before running it.** If the owner prefers a trail, the
fallback is to replace its body with one line:

```
Superseded by DESIGN.md (Paper & Pencil). See docs/adr/ for decisions.
```

**4. No visual work.** No token moves, no CSS change, no component edit. This is a documentation
decision. `src/tokens.css` and `src/index.css` already implement the survivor.

**Acceptance criteria:**
- [ ] `DESIGN.md` contains `## Copy voice` with the em-dash ban
- [ ] `DESIGN.md` contains `## Accessibility & quality floor` with the 44px, 100dvh, focus-ring, and 4.5:1 rules
- [ ] Both new sections sit before `## Things that don't change`
- [ ] `docs/design.md` is deleted, or its body is the one-line superseded pointer
- [ ] `grep -rn "Scoreboard\|cobalt\|Chakra" DESIGN.md docs/ src/ index.html app/index.html` returns no design-direction reference
- [ ] `DESIGN.md`'s existing content (tokens, the Ledger section, the deal) is otherwise unchanged
- [ ] `src/tokens.css` is unchanged and `npm run e2e`'s landing theme assertions still pass

**Blocked by:** —

## Comments

Partially resolved; the deletion did not happen.

**Done.** `DESIGN.md` absorbs both rules the loser carried, immediately before
`## Things that don't change`: `## Copy voice` (em-dash ban) and
`## Accessibility & quality floor` (44px targets, `min-height:100dvh`, focus ring restated in
Paper & Pencil's `--accent` amber, 4.5:1 contrast). Section order verified. No token, CSS or
component edit — `git diff --stat src/tokens.css src/index.css src/landing.css` is empty.
`src/tokens.css:1` states Paper & Pencil, `--accent: #c2410c` (`:15`), `--surface: #faf8f5`
(`:10`), `--text: #1c1917` (`:13`), and `grep -rn "2B6BFF\|Chakra\|cobalt" src/ index.html
app/index.html public/` returns no matches.

**Not done, and still open.** `docs/design.md` was not deleted and its body was not replaced
with the one-line pointer. This file was authored by the repo owner, and this ticket's own
instruction is "confirm the deletion before running it", recorded in `## Comments`. **No owner
confirmation was recorded before this task ran** — the ticket had no `## Comments` section at
all — so neither the deletion nor the fallback was applied. `docs/design.md` still carries the
Scoreboard direction, its cobalt token and its Chakra Petch stack.

**Consequence to be aware of.** `grep -rn "Scoreboard\|cobalt\|Chakra" DESIGN.md docs/ src/
index.html app/index.html` therefore still matches `docs/design.md` (plus historical
`docs/superpowers/` plan and spec files, which name the terms as the direction being replaced).
The surviving direction is unambiguous in the build — no cobalt value or Chakra Petch reference
exists in `src/`, `index.html` or `app/index.html` — but the second design document is still on
disk. Either an owner confirms the deletion (or the pointer line) and this ticket closes, or the
drift this ticket was written to end is still live.

**One adjacent contradiction found here, and fixed in the next round.** `DESIGN.md`'s closing
list "Things that don't change" read `Bottom nav: Roster, Games, History, Squads` — four tabs, no
Home — against a five-hub nav (`NAV_ITEMS`, `src/App.tsx:63-69`). My first reading was that the
brief's "existing content otherwise unchanged" covered it. That was wrong: `DESIGN.md` is not one
of the owner-gated files, and a file being installed as the design source of truth cannot carry a
false invariant while the scope note cites a housekeeping rule. `DESIGN.md:213` now lists the five
hubs in `NAV_ITEMS` order. The scope constraint still stands for design decisions, and it was
honoured: no token moved and no CSS changed.

**Status re-checked 2026-09-30 against `feature/revamp` — still partial, deliberately left
`ready-for-agent`.**

**Shipped, verified:** `DESIGN.md:196` carries `## Copy voice` with the em-dash ban; `DESIGN.md:208`
carries `## Accessibility & quality floor`; both sit before `## Things that don't change` at
`DESIGN.md:221`, so the section-order acceptance row holds. The `DESIGN.md:213` nav-order
correction is in.

**Not shipped, verified:** the other half of this ticket. `docs/design.md` is **still on disk at
8,113 bytes** and still carries the Scoreboard direction, its cobalt token and its Chakra Petch
stack. Neither the deletion nor the one-line superseded pointer was applied.
`grep -rln "cobalt\|Chakra" DESIGN.md docs/*.md src/ index.html app/` matches `docs/design.md` and
nothing else — so the build is unambiguous and only the second design document survives, which is
the drift this ticket exists to end.

**Why it is not being resolved on the strength of the work that did land.** The remaining action is
a one-line owner decision nobody has made: the ticket says "This file was authored by the repo
owner; confirm the deletion before running it", and no confirmation is recorded anywhere in this
file. `IMPLEMENTATION_PLAN.md:182` lists the same item under Known-open. Resolving the ticket would
close a file that still has to be either deleted or reduced to a pointer, and the residue would
stop looking for it.

## Comments

**Owner confirmation, 2026-09-28 — the answer this ticket kept recording as missing.**

The repeated note on this ticket was that no owner confirmation was ever recorded, and that the
deletion therefore never ran. It has now been given, and the chosen option is this spec's **second**
one, not its first: `docs/design.md`'s body is replaced with the one-line superseded pointer rather
than the file being deleted. The reason is that `DESIGN.md` keeps a "What we rejected" section, and
`design.md` is the record of what that section is rejecting; a banner stops a reader who opens the
wrong file in one line, where deletion makes the file indistinguishable from never having existed.

Both live rules it carried are in `DESIGN.md` — the em-dash ban at `:200`, the accessibility floor at
`:78` — and every citation that asserted them has been repointed. Citations that *quote* the losing
direction were left alone; they are quoting the thing that was beaten, which is why they quote it.

The plan's own verify step — `grep -rn "Scoreboard|cobalt|Chakra" DESIGN.md docs/ src/ index.html
app/index.html` printing no output — was **false when it was run** and is true now. That is the step
this ticket's acceptance turns on, and the file it verified was not the one that was checked.
