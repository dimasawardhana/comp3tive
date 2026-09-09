# 06 — Dashboard teaser helpers: recent players + active tournaments

**What to build:** Pure, unit-tested helpers that answer "which three, in what order" for the Dashboard's two teaser sections. Given a community-scoped players list, return the three most recently added players (last in the roster's insertion order — a Player carries no creation timestamp). Given a community-scoped tournaments list, return the three most recently created active tournaments (status `active`, ranked by createdAt descending — a tournament carries no last-played timestamp). Both handle fewer-than-three and empty lists without error.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] A helper returns the last three players of a roster list, in roster order.
- [ ] A helper returns the three most recent active-status tournaments (by createdAt descending), excluding drafts and complete tournaments.
- [ ] Both helpers return fewer than three items when the list has fewer, and an empty list when the input is empty.
- [ ] Unit tests cover order, fewer-than-three, empty, and equal-createdAt ties.
