/**
 * The sign-in lifecycle, as functions App wires once and the AccountPanel calls.
 *
 * The decision is a pure function (`decideSignInAction`) so the tests can pin
 * every branch without a browser; the runner is the only place `window.confirm`
 * appears, which is the one documented exception to Phase D's no-native-dialogs
 * rule - it follows the import-merge precedent (`usePlayerImport`), where the
 * same kind of "this replaces what is here" consent is asked the same way.
 */
import { hasLocalData, localCensus, pullAccount, adoptLocalToAccount, clearLocalData, listAccountCommunities, type SyncStores } from "./sync";

/** What a sign-in does with the two data sets. */
export type SignInAction = "adopt" | "pull" | "confirm-pull" | "none";

/**
 * Decide, from the two answers that matter and nothing else.
 *
 * - Account empty: this device founds it. Adopt, whatever the device has -
 *   even a fresh device adopts (its default community becomes the Account's
 *   first document), because "pull" has nothing to pull.
 * - Account has data, device does not: pull. No prompt for an empty device;
 *   there is nothing on it to lose.
 * - Both have data: ask. Replacing a non-empty device with the Account's data
 *   destroys local records, so it is the one place a confirm runs.
 * - Account unreachable (null from the probe): none. Signed out or offline
 *   mid-sign-in degrades to "stay local" and never errors into the panel.
 */
export function decideSignInAction(
  localHasData: boolean,
  accountHasData: boolean,
): SignInAction {
  if (!accountHasData) return "adopt";
  if (!localHasData) return "pull";
  return "confirm-pull";
}

/** Everything the lifecycle needs, built once in App and passed down. */
export interface AccountSync {
  stores: SyncStores;
  /** Refresh every domain hook, and make `communityId` active when given. */
  onReplaced: (communityId: string | null) => Promise<void>;
  /** The toast sink, so adoption reports through the app's own channel. */
  notify: (text: string) => void;
}

/**
 * Run the sign-in lifecycle after the session is established.
 *
 * Errors are caught and reported through the panel's own error state by the
 * caller (it rethrows nothing): a failed sync must leave the Organizer signed
 * in with their local data intact, not signed out with a broken panel.
 */
export async function runSignInSync(sync: AccountSync): Promise<string | null> {
  try {
    const local = await hasLocalData(sync.stores);
    const accountCommunities = await listAccountCommunities();
    if (!accountCommunities) return null; // unreachable Account: stay local
    const action = decideSignInAction(local, accountCommunities.length > 0);
    if (action === "none") return null;
    if (action === "confirm-pull") {
      // The one documented native-dialog exception (Phase D); same precedent as
      // the import merge: consent before an overwrite the user cannot undo.
      // The census is named because "replace" without a count hides the size of
      // what is being replaced.
      const census = await localCensus(sync.stores);
      const proceed = window.confirm(
        `Your Account already has data. Replace what is on this device with it? This removes ${census.players} ${census.players === 1 ? "player" : "players"} and ${census.sessions} ${census.sessions === 1 ? "session" : "sessions"}.`,
      );
      if (!proceed) return null;
    }
    if (action === "adopt") {
      const adopted = await adoptLocalToAccount(sync.stores);
      sync.notify(
        adopted.length > 0
          ? `Saved ${adopted.length === 1 ? "1 community" : `${adopted.length} communities`} to your Account.`
          : "Nothing needed saving to your Account.",
      );
      return null;
    }
    const communityId = await pullAccount(sync.stores);
    await sync.onReplaced(communityId);
    return communityId;
  } catch (err) {
    sync.notify(err instanceof Error ? err.message : "Syncing your Account did not complete.");
    return null;
  }
}

/** Sign out: clear the device's domain stores, then drop the session. */
export async function runSignOutClear(sync: AccountSync): Promise<void> {
  await clearLocalData(sync.stores);
  await sync.onReplaced(null);
}
