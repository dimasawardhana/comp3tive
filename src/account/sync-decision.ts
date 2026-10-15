/**
 * The sync decision, pure and outside React.
 *
 * This is the function ticket 06 exists for: given what this device holds, what
 * it last knew the server held, and what the server holds now, it decides
 * between pushing, adopting the server's version, refusing, and doing nothing.
 * Its failure mode is data loss, so it is unit-tested directly rather than
 * pinned only through a browser.
 *
 * The three inputs:
 * - `local` - the payload this device would push, or null when it has nothing
 *   pending (nothing changed since the last sync, or the device is empty).
 * - `lastKnownVersion` - the version this device last saw the server hold for
 *   this community. Null when it has never synced (never adopted or pulled).
 * - `serverVersion` - the version the server holds right now. Null when the
 *   server has no document for this community.
 * - `identical` - true when the local payload serializes to exactly what the
 *   server already holds, so pushing would be a no-op write.
 */
export type SyncDecision = "push" | "push-and-adopt" | "reject-stale" | "no-op";

export interface SyncDecisionInput {
  local: string | null;
  lastKnownVersion: number | null;
  serverVersion: number | null;
  identical?: boolean;
}

/**
 * Decide, from the four answers that matter and nothing else.
 *
 * - Server has nothing and this device does: first push after adoption. The
 *   insert-only boundary from ticket 05 already founded the document, so a
 *   document appearing here is adoption's own write landing - adopt.
 * - Server ahead of what this device last knew: another device wrote first.
 *   Refuse. This is the silent-loss case, and refusing loudly is the point;
 *   the caller surfaces the message and the choice.
 * - Versions agree and the payload differs: the ordinary push.
 * - Versions agree and the payload is identical: nothing to do. Pushing an
 *   unchanged document would bump the version and pick a fight with this
 *   device's other tabs for no content change.
 * - Nothing local pending: nothing to push, whatever the server holds.
 */
export function decideSync(input: SyncDecisionInput): SyncDecision {
  if (input.local === null) return "no-op";
  if (input.serverVersion === null) return "push-and-adopt";
  if (input.identical) return "no-op";
  if (input.lastKnownVersion === null || input.lastKnownVersion !== input.serverVersion)
    return "reject-stale";
  return "push";
}
