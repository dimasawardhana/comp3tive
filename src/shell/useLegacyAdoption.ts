import { useEffect, useRef } from "react";
import type { Community, Player, Session } from "../domain/types";
import type { RosterStore, SessionStore } from "../storage/types";
import type { ToastType } from "./useToasts";

/**
 * Legacy data (pre-community) has no `communityId`: adopt it into the active one.
 *
 * **Why this is a hook and not four lines in `App`.** The behaviour is one rule —
 * *a record whose community no longer exists is moved into the active one, once,
 * and a failure is reported once* — and it reads six inputs to apply it. Left
 * inline it is 24 lines of effect plus two refs declared 80 lines away from their
 * only use, which is the shape that made `App` unreadable: the warning refs sat
 * beside `fileInputRef`, which has nothing to do with them.
 *
 * **The refs move with it, and that is the point.** They are per-record-type
 * "already warned" latches, not app state: nothing outside this effect reads or
 * resets them, so keeping them here is what makes the hook self-contained rather
 * than a relocation of two more `App` fields.
 *
 * **The bug this shape prevents is a toast storm.** A failing write retries on
 * every render, and each retry that notified would bury the screen; the latch
 * makes it one message per record type per page load. That is why the refs are
 * not simply dropped in favour of notifying unconditionally.
 *
 * **`roster` and `sessionStore` are both passed, and they are not the same
 * thing**: `roster.savePlayer` re-reads through the live list, while the session
 * write goes straight to the store because `useSessions` exposes no save. That
 * asymmetry is pre-existing and is preserved rather than tidied — tidying it is
 * a behaviour change this extraction is not allowed to make.
 */
export interface LegacyAdoptionDeps {
  activeCommunity: Community | null;
  communities: Community[];
  players: Player[];
  sessions: Session[];
  savePlayer: RosterStore["savePlayer"];
  sessionStore: SessionStore;
  notify: (text: string, type?: ToastType) => void;
}

export function useLegacyAdoption(deps: LegacyAdoptionDeps): void {
  const { activeCommunity, communities, players, sessions, savePlayer, sessionStore, notify } = deps;
  /** One toast per record type, however many renders the failing write retries. */
  const playerWarned = useRef(false);
  const sessionWarned = useRef(false);

  useEffect(() => {
    if (!activeCommunity) return;
    const known = (id: string | undefined) => id && communities.some((c) => c.id === id);
    for (const p of players) {
      if (!known(p.communityId)) {
        void savePlayer({ ...p, communityId: activeCommunity.id }).catch(() => {
          if (!playerWarned.current) {
            playerWarned.current = true;
            notify("Some saved players could not be moved into this community.", "error");
          }
        });
      }
    }
    for (const s of sessions) {
      if (!known(s.communityId)) {
        void sessionStore.saveSession({ ...s, communityId: activeCommunity.id }).catch(() => {
          if (!sessionWarned.current) {
            sessionWarned.current = true;
            notify("Some saved sessions could not be moved into this community.", "error");
          }
        });
      }
    }
  }, [activeCommunity, communities, players, sessions, savePlayer, sessionStore, notify]);
}
