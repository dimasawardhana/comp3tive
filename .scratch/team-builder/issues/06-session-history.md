# 06: Session history

**What to build:** Past Sessions are listed, re-openable, and deletable: the organizer sees prior team-building runs (Discipline, when it happened, pool size, resulting Teams), reopens one to rebuild from its pool with one click, and removes old Sessions to keep history tidy.

**Blocked by:** 04 (Session split flow)

**Status:** resolved

## Answer

Built Session history.

- `useSessions` hook (loads newest-first, deletes) and a History screen listing past Sessions: discipline, player count, team sizes ("5 v 5"), gap, and relative timing; a per-row Delete (with confirm); a friendly empty state ("No sessions yet. Split your first teams and they'll show up here.").
- Entry point: a "History" link in the topbar on the roster screen; the list refreshes when opened.
- Reopen: selecting a session restores the Match screen with the same discipline, the same 10-player pool selected, and the same team count - ready for a fresh run.

Verified in a real browser (8 checks): two seeded sessions listed with discipline/meta, reopen restores MLBB + the same 10-player pool + team count, delete removes a session, deleting all reaches the empty state. 42 unit tests green, tsc + build clean.

- [ ] Past Sessions are listed with their Discipline, timing, pool size, and resulting Teams
- [ ] Reopening a Session selects the same pool for a fresh run
- [ ] Sessions can be deleted
