import type { Capability, Player, SavedSquad, Session, SplitResult } from "../domain/types";
import { MLBB_RETIRED_ROLES } from "../domain/seed";

/** MLBB's discipline id, named once so the scope check reads as a rule. */
const MLBB_DISCIPLINE_ID = "mlbb";

/**
 * The one rewrite in this app that changes *what a stored id means*.
 *
 * MLBB's roles used to be hero classes and are now lanes. Every stored record
 * that names a role therefore holds a word from a vocabulary the discipline no
 * longer declares, and `validateCapability` refuses a capability whose role is
 * not in the discipline (`src/domain/validation.ts:53`). Left alone, an existing
 * roster would fail its next save and an exported backup would be refused
 * outright on import by `parseBackup`. So the ids are rewritten in place, on the
 * upgrade to database version 8, through `MLBB_RETIRED_ROLES`.
 *
 * **Why every function here takes the whole record rather than an id.** The
 * rewrite is scoped to one discipline, and the discipline is a property of the
 * record: a capability knows its `disciplineId`, a session and a squad know
 * theirs. Scoping by the record is what keeps a *custom* discipline free to
 * declare a role called `tank` — the retired ids are ordinary words, and a
 * blanket "rewrite every id in this map" would corrupt that discipline's
 * eligibility lists.
 *
 * **Why the functions are pure and total.** They run inside an IndexedDB
 * `versionchange` transaction, where an exception reverts the version bump and
 * leaves the database unusable at the old version with the new code. So they
 * never throw: an unrecognised id is left exactly as it was, which is the same
 * state the app was already in and is always recoverable by hand.
 *
 * **Idempotent by construction.** A lane id is not a key of the map, so running
 * the migration twice changes nothing the second time.
 */

/** The lane a retired hero-class id became, or the id unchanged. */
export function laneForRoleId(id: string): string {
  return MLBB_RETIRED_ROLES[id] ?? id;
}

/** True when this id belongs to the vocabulary MLBB no longer declares. */
export function isRetiredMlbbRole(id: string): boolean {
  return id in MLBB_RETIRED_ROLES;
}

/**
 * Rewrite one capability's eligibility list and preferred role.
 *
 * `preferredRole` is nulled when the rewritten value is not in the rewritten
 * list, because `validateCapability` requires it to be a member (`:61`). The map
 * is a bijection over MLBB's five classes, so for a well-formed record this
 * never fires; it exists so a hand-edited backup cannot be turned into an
 * unloadable record by this migration.
 */
export function migrateCapability(cap: Capability): Capability {
  if (cap.disciplineId !== MLBB_DISCIPLINE_ID) return cap;
  const eligibleRoles = [...new Set(cap.eligibleRoles.map(laneForRoleId))];
  const preferredRole = cap.preferredRole === null ? null : laneForRoleId(cap.preferredRole);
  return {
    ...cap,
    eligibleRoles,
    preferredRole: preferredRole !== null && eligibleRoles.includes(preferredRole) ? preferredRole : null,
  };
}

/** A player's MLBB capability, rewritten. Other disciplines are untouched. */
export function migratePlayer(player: Player): Player {
  if (!player.capabilities.some((c) => c.disciplineId === MLBB_DISCIPLINE_ID)) return player;
  return { ...player, capabilities: player.capabilities.map(migrateCapability) };
}

/**
 * A split's role assignments, rewritten.
 *
 * Slot role ids are not validated anywhere — the app tolerates a dangling id by
 * design, because deleting a player leaves one behind — so this is not a
 * correctness fix. It is a *display* fix: `SplitScreen` resolves a slot's role
 * to a name through the discipline's role list, and a retired id would render a
 * team with the role silently missing (`src/session/SplitScreen.tsx:80`).
 */
export function migrateSplitResult(result: SplitResult): SplitResult {
  return {
    ...result,
    teams: result.teams.map((team) => ({
      ...team,
      slots: team.slots.map((slot) =>
        slot.roleId === null ? slot : { ...slot, roleId: laneForRoleId(slot.roleId) },
      ),
    })),
  };
}

/** A session's split, when the session was an MLBB one. */
export function migrateSession(session: Session): Session {
  if (session.disciplineId !== MLBB_DISCIPLINE_ID) return session;
  return { ...session, result: migrateSplitResult(session.result) };
}

/** A saved squad's split, when the squad was an MLBB one. */
export function migrateSavedSquad(squad: SavedSquad): SavedSquad {
  if (squad.disciplineId !== MLBB_DISCIPLINE_ID) return squad;
  return { ...squad, result: migrateSplitResult(squad.result) };
}
