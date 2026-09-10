# 02 — Dashboard screen

**What to build:** A new home hub that shows the active community's state at a glance. It opens with a header naming the active community and the h1 "Dashboard", then three stat cards — players on the roster, saved squads, and tournaments (drafts and in-progress) — all scoped to the active community. When the active community has no players yet (a fresh profile), the dashboard shows a guided empty state ("Run your first split" / "Add players") instead of the stat cards, so the first-run moment teaches the next step rather than showing zeros.

**Blocked by:** 01 — Community scoping for History and Games (the tournament count must be community-accurate).

**Status:** ready-for-agent

- [ ] Opening the dashboard shows a header naming the active community and the h1 "Dashboard".
- [ ] Three stat cards show the active community's player count, saved-squad count, and tournament count (drafts + in-progress), and each matches what its hub shows.
- [ ] Switching the active community updates the counts and the header name.
- [ ] A fresh community with no players shows the guided empty state in place of the stat cards.
