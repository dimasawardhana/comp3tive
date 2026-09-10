# 04 — Dashboard actions

**What to build:** The Dashboard's actions actually go somewhere. The primary action "Split match" starts an ad-hoc split (the same flow the Roster's Split match starts). The secondary links reach the other main flows: "+ New tournament" opens the Games hub's create flow, "Browse saved squads" opens the Saved Squads hub, and "+ Add player" opens the roster's add-player modal. Each action drops the organizer onto the correct screen with the intended flow ready to go.

**Blocked by:** 02 — Dashboard screen (the actions live on the dashboard).

**Status:** ready-for-agent

- [ ] Clicking "Split match" starts an ad-hoc split and lands on the match setup screen.
- [ ] Clicking "+ New tournament" opens the Games hub's new-tournament create modal.
- [ ] Clicking "Browse saved squads" opens the Saved Squads hub.
- [ ] Clicking "+ Add player" opens the roster's add-player modal.
- [ ] On a fresh community, the guided empty state's primary action is wired to the same first step (add players / split) and works.
