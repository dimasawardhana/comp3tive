# Tournament Flow Revamp — 2026-09-04

## Problem Statement

The tournament journey works end-to-end (create → split → submit → bracket → record → complete), but the three entry/exit points feel dense and bury key information:

1. **Create tournament modal** packs all fields into one scrollable surface with no previews — users don't see what the chosen format implies until after they submit.
2. **Draft tournament page** shows meta as a single dense inline line ("Format Series BO1 Teams 0/2 Status Draft") that's hard to scan, and offers no preview of what the split will actually do.
3. **Post-split → submit** jumps straight to the bracket with no review moment — the organizer commits teams to the tournament without a last look at who landed where.

The flow is tournament-first per ADR-0002, and the data model is the contract (per spec 0002). This revamp is a polish pass on the UI at the three handoff points, not a data model change.

## Scope

Three screens redesigned:

- **Create tournament modal** (in `GamesScreen`) — sectioned layout, live previews, constraint explanations
- **Draft tournament page** (in `TournamentScreen`, no teams yet) — proper h1 title, meta as cards, pre-split preview with eligible player count
- **Post-split review** (in `TournamentScreen`, teams exist, no games yet) — review checklist before submitting to the tournament

Out of scope:
- Bracket / standings rendering (works, no complaints)
- Match recording modal
- Re-split / undo logic (spec rules unchanged)
- Champion card
- Storage / data model
- Match result editing
- Tournament deletion

## Design

### 1. Create tournament modal

**Current layout:** single scrollable form, all fields visible, no previews.

**New layout — sectioned with live previews:**

```
┌─────────────────────────────────────────┐
│ New tournament                     [×]   │
├─────────────────────────────────────────┤
│ ▸ NAME                                  │
│ [Sunday League                    ]     │
│                                         │
│ ▸ DISCIPLINE                            │
│ [Futsal] [MLBB] [Badminton]             │
│ ┌─────────────────────────────────────┐ │
│ │ Futsal · 5v5                         │ │
│ │ 4 roles · 3 attributes · 5–∞ per team │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ▸ FORMAT                                │
│ [Series] [Single elim] [Swiss]          │
│                                         │
│ ▸ SERIES LENGTH                         │
│ [BO1] [BO3] [BO5]                       │
│ Best of 3 = first to 2 wins              │
│                                         │
│ ▸ TEAMS                                 │
│ [2] [4] [6] [8]                         │
│ Single elimination: 2, 4, or 8 teams    │
│                                         │
│ ☐ 3rd-place match                       │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ Single elimination · 4 teams        │ │
│ │ 2 rounds · 3rd-place match           │ │
│ └─────────────────────────────────────┘ │
│                                         │
│              [Cancel] [Create]          │
└─────────────────────────────────────────┘
```

**Sectioned with kicker labels** (Chakra Petch 10px uppercase) per the existing design system. Each section has a label and a preview block where appropriate.

**Discipline detail card** — when a discipline is selected, show a preview block below the chips: role count, attribute count, team size range. This is the "what am I committing to" moment.

**Format preview line** — computed live from format + teamCount + thirdPlace:
- Series 2 teams: "Series · 2 teams · BO3 = first to 2 wins"
- Single elim 4 teams: "Single elimination · 4 teams · 2 rounds · 3rd-place match"
- Swiss 6 teams: "Swiss · 6 teams · 3 rounds · standings"

**Team count constraints** — chips disabled when not valid for the chosen format, with a one-liner explainer below the chips. Per spec 0002:
- Series: 2 only
- Single elimination: 2, 4, 8
- Swiss: 4, 6, 8

**Series length helper** — "BO1 = single game", "BO3 = first to 2 wins", "BO5 = first to 3 wins". One line below the chips.

**3rd-place toggle** stays for single elimination only; hidden for Series (no third place) and Swiss (no third place).

### 2. Draft tournament page (TournamentScreen, no teams)

**Current layout:** breadcrumb + dense meta line + "Awaiting split" empty state.

**New layout — title + meta cards + pre-split preview:**

```
┌─────────────────────────────────────────┐
│ Games / Sunday League                   │
│                                         │
│ # Sunday League                         │
│ 4v5 Futsal · Single elimination · BO3    │
│                                         │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│ │ FORMAT   │ │ SERIES   │ │ TEAMS    │    │
│ │ Single   │ │ BO3      │ │ 0/4      │    │
│ │ elimin.  │ │          │ │          │    │
│ └──────────┘ └──────────┘ └──────────┘    │
│ ┌──────────┐                              │
│ │ STATUS  │                              │
│ │ Draft   │                              │
│ └──────────┘                              │
│                                         │
│ ─────────────────────────────────────    │
│ Pre-split preview                        │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ You'll pick from 8 eligible players  │ │
│ │ and split into 4 teams of 5 each.    │ │
│ │                                     │ │
│ │ 8 of 12 players on the roster can   │ │
│ │ play this discipline.                │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │           Split your teams           │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

**Tournament name as h1** — gives the page a proper title. Breadcrumb stays above for navigation.

**Subtitle** — discipline + format + series on one line, slate color, Familjen Grotesk 14px.

**Meta as cards** — Format / Series / Teams / Status each in its own bordered card. Value in Chakra Petch 20-24px, label in Chakra Petch 10px uppercase kicker. 2-column grid on mobile, 4-column on desktop.

**Pre-split preview block** — bordered surface with:
- "You'll pick from X eligible players and split into Y teams of Z each."
- "X of Y players on the roster can play this discipline." (where Y is total community players)
- Updates live as the community grows

**"Split your teams" button** stays as the primary CTA, full-width on the preview block, with the existing flow that locks the team stepper to the tournament's count.

### 3. Post-split review (TournamentScreen, teams exist, no games)

**Current behavior:** after `submitTeams()`, the user lands on the bracket. No review moment.

**New behavior:** `submitTeams()` sets a `reviewing: true` flag on the local state. The TournamentScreen shows a "Review teams" checklist view before the bracket renders.

```
┌─────────────────────────────────────────┐
│ Games / Sunday League                   │
│                                         │
│ # Sunday League                         │
│ Review the teams before locking         │
│                                         │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│ │ FORMAT   │ │ SERIES   │ │ TEAMS    │    │
│ │ Single   │ │ BO3      │ │ 4/4      │    │
│ │ elimin.  │ │          │ │          │    │
│ └──────────┘ └──────────┘ └──────────┘    │
│                                         │
│ Balance: Gap 0.3 · Fair game            │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ TEAM A (Yellow)        Avg 4.2     │ │
│ │ • Player 1                         │ │
│ │ • Player 2                         │ │
│ │ • Player 3                         │ │
│ │ • Player 4                         │ │
│ │ • Player 5                         │ │
│ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │ TEAM B (Pink)          Avg 4.1     │ │
│ │ ...                                │ │
│ └─────────────────────────────────────┘ │
│                                         │
│              [← Re-split] [Confirm →]    │
└─────────────────────────────────────────┘
```

**Triggered when:** `tournament.teams.length > 0` AND `!hasAnyGames` AND local `reviewing` state is true.

**Show before bracket:** the bracket stays hidden until the user clicks "Confirm teams". This gives the organizer a moment to verify the split is right.

**Balance summary:** the existing gap meter (0.3 gap, "Fair game" if ≤ 0.1) at the top of the review.

**Per-team list:** team name with bib color, average strength, list of player names. Compact — no ratings on the review, just names. The full ratings view happens in the split result screen (`SplitScreen`).

**Actions:**
- **Confirm teams** (primary) — clears `reviewing`, shows the bracket
- **Re-split** (ghost) — calls existing `reroll()` flow
- **← Back to roster** (ghost) — same `onBack` prop the split screen uses

**After confirming:** the tournament becomes "active" (existing behavior — first match is frontier). The user can still re-split until the first result is recorded (per spec 0002 interaction rules).

## Data Flow

No data model changes. The flow uses existing state:

- `createTournament(spec)` — unchanged, called from the redesigned modal
- `startSplit()` — unchanged, called from the draft tournament page CTA
- `submitTeams(teams)` — **slight change**: sets local `reviewing: true` state instead of immediately going to bracket
- `confirmTeams()` (new) — clears `reviewing`, persists `tournament.status = "active"`
- `reroll()` — unchanged, called from review screen "Re-split" button
- `onBack` — existing prop, wires to roster view

The tournament `status` field already has "draft" and "active" values. The review screen is a UI-only state (`reviewing: true` in `TournamentScreen` local state) that delays the transition to the bracket view until the user confirms.

## Component-Level Design

### `GamesScreen` create modal
- Sections wrapped in `<div className="modal-section">` with kicker labels
- Discipline detail block: `<div className="modal-section-preview">`
- Format preview: `<div className="modal-section-preview">` at the bottom
- Team count chips disabled via `disabled` prop when not valid for the chosen format
- Helper text: `<p className="modal-section-hint">`

### `TournamentScreen` draft page
- h1 with tournament name
- Subtitle line with discipline + format + series
- Meta grid: `<div className="tournament-meta-grid">` containing `<div className="tournament-meta-card">` × 4
- Pre-split preview: `<div className="tournament-preview">` containing eligible count + per-team breakdown
- "Split your teams" button: full-width, primary CTA

### `TournamentScreen` review page
- New local state: `const [reviewing, setReviewing] = useState(false)`
- On `tournament.teams` change, if teams exist and no games, set `reviewing = true`
- Review view: teams list with balance summary
- "Confirm teams" sets `reviewing = false` (bracket renders)
- "Re-split" calls existing `reroll()` and keeps `reviewing = true` with new teams
- "← Back to roster" uses existing `onBack`

## File Plan

1. `src/index.css` — add styles for:
   - `.tournament-meta-grid` + `.tournament-meta-card`
   - `.tournament-preview` (pre-split block)
   - `.review-panel` (post-split review)
   - `.team-list-compact` (review team list)
   - `.balance-summary` (gap meter at top of review)
2. `src/tournament/GamesScreen.tsx` — redesign create modal with sections + previews
3. `src/tournament/TournamentScreen.tsx` — add h1, meta cards, pre-split preview, review mode
4. `src/App.tsx` — minor wiring for review state (if needed)
5. `e2e/tests/tournament/create.spec.ts` — test create modal with previews
6. `e2e/tests/tournament/draft.spec.ts` — test draft page with meta cards
7. `e2e/tests/tournament/review.spec.ts` — test post-split review

## Testing

- `create.spec.ts`: open Games tab → click New tournament → verify sectioned layout → pick discipline → verify detail card appears → pick format → verify format preview updates → verify team count chips disable correctly → submit
- `draft.spec.ts`: create a tournament → verify h1 with name → verify meta cards (Format/Series/Teams/Status) → verify pre-split preview shows eligible count
- `review.spec.ts`: complete a split → submit teams → verify review screen with team list + balance summary → click Confirm → verify bracket appears

E2E: 3 new tests, all should pass after implementation.

## Spec Self-Review

- **Placeholders:** none — every section specifies concrete CSS classes, file paths, and behavioral rules.
- **Internal consistency:** the review screen is a UI-only delay that doesn't change the data model; consistent with spec 0002's "Re-roll/re-split lock at the first recorded result" rule.
- **Scope check:** focused on three screens, no data model changes, no new storage. Single implementation plan.
- **Ambiguity check:** "Re-split" from review screen — clarified: it calls existing `reroll()` which is part of the split flow. "← Back to roster" — clarified: uses existing `onBack` prop wired to roster view.

No fixes needed.
