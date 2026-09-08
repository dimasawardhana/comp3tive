# Origin-aware view stack instead of hard-coded back targets

Navigation was a flat `View` union where each screen's Back target was hard-coded at its call
site. This produced screens whose back button contradicted their breadcrumb (the tournament
breadcrumb said "Games" but went to Roster), a split screen whose destination was decided by
hidden boolean flags, and a hazard where deleting the current tournament left a blank screen.

We decided to keep the flat `View` union but add two small pieces of state to the app root:

1. **`viewStack`** — a stack of `View`s pushed on every navigation. Back pops it, so the user
   always returns to the screen they came from (contract P2). Hubs push a fresh stack root.
2. **Split flow source** — the `match`/`split` views carry an explicit `source`
   (`ad-hoc | tournament | session | squad`) instead of being inferred from
   `setup.tournamentId` / `splitFromSquad` booleans. The source drives the header label, the
   breadcrumb, the spec lock, and the forward action (contract P5).

Considered and rejected: **a URL router** (react-router). It would make navigation shareable
and wire browser back/forward, but this is a local-first single-user tool with no deep links
and no shareable state; the dependency and URL scheme are not justified. Revisit only if the
app gains a shareable URL surface.

Consequences: every back control in every screen now reads from the stack (no screen hard-codes
a destination); the two dead view modes and five dead handlers were removed in the same pass;
deleting the current tournament redirects to the Tournaments hub; `docs/FLOW.md` is the
contract and the edge table there must stay in sync with the code.
