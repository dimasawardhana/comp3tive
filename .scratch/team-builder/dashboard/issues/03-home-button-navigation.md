# 03 — Home button in the bottom navigation

**What to build:** The app lands on the Dashboard on every load, and a centered, visually emphasized Home button in the bottom navigation returns there from any hub. The bottom nav becomes five slots in the order Roster · Games · Home · History · Squads, with Home in the middle (house glyph, label "Home", distinct emphasis so it reads as the home affordance). The nav layout tightens so all five slots fit on mobile and desktop widths. Opening Home resets navigation to the dashboard hub, and the nav highlight tracks which hub is active.

**Blocked by:** 02 — Dashboard screen (the Home tab opens the dashboard).

**Status:** ready-for-agent

- [ ] A fresh app load lands on the Dashboard.
- [ ] The bottom nav shows five slots — Roster, Games, Home, History, Squads — with Home centered and visually distinct, and all five fit on a narrow (mobile) and wide (desktop) viewport.
- [ ] Clicking Home from any hub returns to the Dashboard.
- [ ] The active hub is highlighted correctly on each tab, including when a leaf screen is open under a hub.
- [ ] Existing navigation behaviours (hub tabs still open their hubs; leaf back still returns to its origin) are unchanged.
