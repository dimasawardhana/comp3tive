# 05 — Re-anchor existing e2e and cover the dashboard

**What to build:** The full e2e suite stays green and the dashboard's behaviour is locked down by tests. Existing specs that assumed the app opened on the Roster, or that used positional tab indices on the old four-tab nav, are updated for the new five-tab layout and dashboard-first landing. New coverage verifies the dashboard end to end: a fresh load lands on the Dashboard; the Home tab navigates there from each hub; the stat cards show community-scoped counts and follow the active community; a fresh community shows the guided empty state; and the dashboard actions land on their destinations. Cross-community isolation is asserted (two communities, each hub shows only its own records, dashboard counts match).

**Blocked by:** 03 — Home button in the bottom navigation (the tab layout and landing change), and 01 — Community scoping for History and Games (for count assertions). 04 — Dashboard actions must be wired before its action coverage runs.

**Status:** ready-for-agent

- [ ] The full e2e suite passes with the five-tab nav and dashboard-first landing.
- [ ] A spec asserts a fresh load lands on the Dashboard.
- [ ] A spec asserts the Home tab returns to the Dashboard from each hub.
- [ ] A spec asserts dashboard counts are community-scoped and update on community switch.
- [ ] A spec asserts a fresh community shows the guided empty state.
- [ ] A spec asserts each dashboard action lands on its destination.
- [ ] A spec asserts cross-community isolation: History and Games show only the active community's records.
