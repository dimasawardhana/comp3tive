/**
 * The debounced, versioned, whole-Community push.
 *
 * After a mutation while signed in, the active Community's collections upload
 * as one document. Bursts coalesce: every mutation calls `markDirty`, which
 * restarts one timer, so a roster edit session produces one push, not one per
 * keystroke. The delay (1.5s) is short enough that a closed tab has almost
 * certainly flushed, and the tab's `pagehide` flushes synchronously so a quick
 * edit-then-close does not lose the upload.
 *
 * **Local state stays the render source.** A push is never a prerequisite for
 * a write to be visible; a failed push degrades sync, never the screen, and
 * leaves the edit intact locally.
 */
import { serializeBackup } from "../data/transfer";
import { apiFetch, getSession } from "./session";
import { readSyncVersion, writeSyncVersion } from "./sync";
import type { SyncStores } from "./sync";
import { decideSync } from "./sync-decision";

/** The coalescing window. Short enough to flush before a tab close, long enough to swallow a burst. */
const DEBOUNCE_MS = 1500;

export interface PushController {
  /** Call after every mutation. Signed out, this is a no-op by construction. */
  markDirty(communityId: string): void;
  /** Push immediately, bypassing the debounce (the pagehide flush). */
  flush(): void;
  /**
   * Push every community the account has a local document for, and report the
   * outcome. The Settings screen's "Sync now" button: a deliberate, visible
   * sync the Organizer can press instead of trusting the debounce. Returns
   * false when nothing could be pushed (offline, or not signed in).
   */
  syncAll(): Promise<boolean>;
  /** Stop the timer (tests, and nothing else). */
  dispose(): void;
}

/** The stores and the payload builder, passed in so this module stays testable. */
export interface PushContext {
  stores: SyncStores;
  /** The community whose collections are pushed. */
  activeCommunityId: () => string | null;
  /** Surface a rejected/failed push. Non-fatal by contract. */
  notify: (text: string) => void;
}

interface PendingPush {
  communityId: string;
  timer: ReturnType<typeof setTimeout>;
}

let pending: PendingPush | null = null;
let pushing = false;

/** Reset module state between tests. */
export function resetPushState(): void {
  if (pending) clearTimeout(pending.timer);
  pending = null;
  pushing = false;
}

/**
 * Build the document exactly as the export flow does - the wire format is the
 * backup format (ADR-0007), and there is no second serialization path.
 */
export async function buildCommunityPayload(
  stores: SyncStores,
  communityId: string,
): Promise<string> {
  const [players, sessions, communities, tournaments, squads, disciplines] = await Promise.all([
    stores.roster.listPlayers(),
    stores.sessions.listSessions(),
    stores.communities.listCommunities(),
    stores.tournaments.listTournaments(),
    stores.squads.listSavedSquads(),
    stores.disciplines.listDisciplines(),
  ]);
  const community = communities.find((c) => c.id === communityId);
  return serializeBackup(
    players.filter((p) => p.communityId === communityId),
    sessions.filter((s) => s.communityId === communityId),
    community ? [community] : [],
    tournaments.filter((t) => t.communityId === communityId),
    squads.filter((s) => s.communityId === communityId),
    disciplines,
  );
}

/**
 * One push, decided by the pure function and executed against the CAS route.
 *
 * Returns whether the push was accepted (or correctly skipped); a rejected or
 * failed push reports through `notify` and answers false, having changed
 * nothing locally.
 */
export async function pushCommunity(ctx: PushContext, communityId: string): Promise<boolean> {
  const session = getSession();
  if (!session) return false; // Signed out: no request, ever.
  if (pushing) return false; // One in flight; the next markDirty reschedules.
  pushing = true;
  try {
    const local = await buildCommunityPayload(ctx.stores, communityId);

    // What the server holds right now, and whether it matches this device.
    const check = await apiFetch("/api/documents/pull", {
      method: "POST",
      body: JSON.stringify({ communityIds: [communityId] }),
    });
    if (!check || !check.ok) return false; // Offline: degraded sync, retry on next mutation.
    const checkBody = (await check.json()) as {
      documents?: Array<{ communityId: string; version: number; payload: string }>;
    };
    const doc = (checkBody.documents ?? []).find((d) => d.communityId === communityId);
    const serverVersion = doc?.version ?? null;
    const identical = doc?.payload === local;
    const lastKnownVersion = readSyncVersion(session.accountId, communityId);

    const decision = decideSync({
      local,
      lastKnownVersion,
      serverVersion,
      identical,
    });
    if (decision === "no-op") {
      if (serverVersion !== null) writeSyncVersion(session.accountId, communityId, serverVersion);
      return true;
    }
    if (decision === "reject-stale") {
      ctx.notify(
        `This community changed on another device. Reload to bring the Account's version here, or sign in there and push this device's data over it.`,
      );
      return false; // Local data is NOT replaced; the Organizer chooses.
    }

    // push or push-and-adopt: adopt is an insert when the server has nothing.
    if (decision === "push-and-adopt") {
      const adopt = await apiFetch("/api/documents/adopt", {
        method: "POST",
        body: JSON.stringify({ communityId, payload: local }),
      });
      if (!adopt || !adopt.ok) return false;
      const body = (await adopt.json()) as { version?: number };
      if (typeof body.version === "number") writeSyncVersion(session.accountId, communityId, body.version);
      return true;
    }
    const push = await apiFetch("/api/documents/push", {
      method: "POST",
      body: JSON.stringify({ communityId, expectedVersion: serverVersion, payload: local }),
    });
    if (!push) return false;
    if (push.status === 409) {
      const body = (await push.json().catch(() => ({}))) as { serverVersion?: number | null };
      // The server moved between the check and the write; the CAS held. Same
      // message as the decision's reject-stale: a refused write says so.
      ctx.notify(
        `This community changed on another device. Reload to bring the Account's version here, or sign in there and push this device's data over it.`,
      );
      if (typeof body.serverVersion === "number")
        writeSyncVersion(session.accountId, communityId, body.serverVersion);
      return false;
    }
    if (!push.ok) return false;
    const body = (await push.json()) as { version?: number };
    if (typeof body.version === "number") writeSyncVersion(session.accountId, communityId, body.version);
    return true;
  } finally {
    pushing = false;
  }
}

/** Build the controller App holds. Module-level timer: one per tab, by design. */
export function createPushController(ctx: PushContext): PushController {
  return {
    markDirty(communityId: string) {
      if (!getSession()) return; // Signed out: not even a timer.
      if (pending) clearTimeout(pending.timer);
      pending = {
        communityId,
        timer: setTimeout(() => {
          const current = pending;
          pending = null;
          if (current) void pushCommunity(ctx, current.communityId);
        }, DEBOUNCE_MS),
      };
    },
    flush() {
      if (!pending) return;
      clearTimeout(pending.timer);
      const current = pending;
      pending = null;
      void pushCommunity(ctx, current.communityId);
    },
    async syncAll() {
      // A pending debounce is the same intent with a timer in front of it:
      // cancel it so its community is pushed by this pass, not twice.
      this.flush();
      const communities = await ctx.stores.communities.listCommunities();
      if (communities.length === 0) return true;
      let any = false;
      let ok = true;
      for (const c of communities) {
        // Sequential on purpose: one in flight (the `pushing` gate would
        // no-op every parallel call after the first anyway).
        const pushed = await pushCommunity(ctx, c.id);
        if (pushed) any = true;
        else ok = false;
      }
      return ok && any;
    },
    dispose() {
      if (pending) clearTimeout(pending.timer);
      pending = null;
    },
  };
}
