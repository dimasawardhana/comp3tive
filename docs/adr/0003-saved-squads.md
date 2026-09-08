# Saved Squads: a curated, self-contained layer over the Session log

A saved split needs a first-class home: squads are **explicitly saved, named records of one fair split** (discipline, pool, team count, and the resulting teams), listed in their own bottom-nav tab and consumable by a draft Tournament whose discipline and team count they match. Each squad embeds its own copy of the split data (like a Tournament team snapshot), so re-splitting or deleting the source Session never changes a squad, and deleting a squad never touches the Session log or any Tournament that already consumed it.

**Status**: accepted

**Considered Options**:
- Reuse the auto-saved `Session` as the squad (add a `name` field; the Squads tab filters named Sessions). Cheapest, but History and Squads become two views over one list, every tournament split would need to start writing Sessions (breaking ADR-0002's "tournament splits don't pollute History"), and a Session that gets reopened and re-split would silently morph a squad that points at it.
- A `SavedSquad` that **references** its source Session by id. One source of truth for the teams, but a Session is re-saveable (reopen → re-split → persist overwrites `result`), so the squad's teams could change under it — exactly the failure ADR-0002's snapshots exist to prevent.
- Saved Squad embeds its own copy of the split (chosen): discipline, `poolPlayerIds`, team count, and the full `SplitResult`. Self-contained like a Tournament snapshot; the few KB of duplication buys immunity from Session edits and deletion, and lets a squad survive backup/restore on its own. Storage is one new object store (DB v6) behind the ADR-0001 interfaces; backup goes to v4 with v1–v3 imports migrating to an empty list.
- Squad = a single Team (5 players) rather than a whole split. Rejected: the fair split is the artifact users save and replay; the split (not one team) is the tournament's input unit.

**Consequences**:
- The Split screen gains a "Save squad" action in both ad-hoc and tournament modes. Ad-hoc splits keep auto-saving Sessions (the raw log); saving a squad is an explicit, named curation step on top.
- A draft Tournament shows eligible saved squads (discipline + exact team count) and consumes one as its teams via the existing snapshot path — submitting a squad is the same code path as submitting a fresh split.
- Squads are community-scoped like every aggregate; switching community swaps the list.
- "Squad" is now reserved vocabulary (CONTEXT.md): the artifact, never a Team and never the Community roster. UI copy that used "squad" for the community or a single team is corrected as surfaces are touched.
