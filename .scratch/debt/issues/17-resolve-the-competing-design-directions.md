# 17: Resolve the competing design directions

**Status:** ready-for-agent

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
