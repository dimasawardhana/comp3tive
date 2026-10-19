import { useCallback, useState } from "react";
import { getSession, startPasskeyRegistration, signInWithPasskey, signInWithGoogle, signOut, type Session } from "./session";
import { googleClientId, requestGoogleCredential } from "./google-signin";
import { runSignInSync, runSignOutClear, type AccountSync } from "./useAccount";

/**
 * Who is signed in, and the two ways to change that.
 *
 * ## A Guest is never asked to do anything
 *
 * This panel is a row on the Dashboard that a Guest can ignore forever. It is
 * not a wall, it is not a nag, and no feature behind it is gated: `PRODUCT.md`'s
 * "no dead ends" rule and the Landing Page's trust row both depend on an
 * Organizer being able to use the whole app without an Account, and the existing
 * e2e suite is the regression test for that.
 *
 * ## Why it holds its own state
 *
 * `src/account/session.ts` is a plain module, deliberately: it is read from an
 * event handler during sign-in, not during a render, so it is not a subscription
 * and nothing re-renders when it changes. This component keeps a copy for
 * display and refreshes it after each action, which keeps the module free of
 * React and keeps the number of places that can render a signed-in state at one.
 *
 * ## Copy
 *
 * No em-dashes (`DESIGN.md`), periods and commas instead. "Optional" appears on
 * every state, because that is the promise the Landing Page now makes.
 */

type Busy = "create" | "signin" | "google" | "out" | null;

export function AccountPanel({ accountSync, onSyncNow }: { accountSync: AccountSync; onSyncNow?: () => Promise<boolean> }) {
  const [session, setLocalSession] = useState<Session | null>(() => getSession());
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  /**
   * Every way in is always offered, and nothing is fetched to decide that.
   *
   * **Deliberate, and it was a bug first.** An earlier cut asked `/api/config`
   * on mount so an unconfigured deployment could hide the Google button. That
   * made every load of the Dashboard a network request, signed in or not —
   * which falsifies `README.md`'s "nothing in `src/` opens a network connection
   * at all" and makes a Guest's device talk to a server for nothing. The probe
   * was buying a hidden button. Clicking instead costs nothing when Google *is*
   * configured, and says so plainly when it is not.
   *
   * **Creating and signing in are separate buttons, and that is not padding.**
   * They are two different WebAuthn ceremonies against two different server
   * routes, and no one button can be both: a sign-in ceremony on a device with
   * no credential fails with `NotAllowedError`, which reads to the user as
   * "passkeys are broken". Creating an Account is a deliberate act, and the
   * signed-out panel is the only place a first-time visitor looks for it.
   */

  const run = useCallback(async (which: Exclude<Busy, null>, action: () => Promise<unknown>) => {
    setBusy(which);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
      setLocalSession(getSession());
    }
  }, []);

  const onCreate = () =>
    void run("create", async () => {
      await startPasskeyRegistration();
      // The session exists; now the data moves. Adopt or pull per the
      // lifecycle's decision, which reports through toasts, not this panel.
      await runSignInSync(accountSync);
    });
  const onPasskeySignIn = () =>
    void run("signin", async () => {
      await signInWithPasskey();
      await runSignInSync(accountSync);
    });
  const onGoogle = () =>
    void run("google", async () => {
      const clientId = await googleClientId();
      if (!clientId) throw new Error("Google sign-in is not configured on this deployment.");
      await signInWithGoogle(await requestGoogleCredential(clientId));
      await runSignInSync(accountSync);
    });
  const onSignOut = () =>
    void run("out", async () => {
      // Explicit sign-out is the only thing that clears data (ticket 05): a
      // stale token never reaches here, and a failed clear still signs out.
      await runSignOutClear(accountSync);
      signOut();
    });

  return (
    <section className="account-panel" aria-label="Account">
      <div className="dashboard-teasers-head">
        <h2>Account</h2>
        <span className="kicker">Optional</span>
      </div>

      {session ? (
        <div className="account-signed-in">
          <p className="account-status">
            Signed in. Your data is in your Account and on this device.
          </p>
          <div className="account-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={onSyncNow ? () => void onSyncNow() : undefined}
              disabled={busy !== null || !onSyncNow}
              title="Send every community's latest data to your Account now"
            >
              Sync now
            </button>
            <button type="button" className="btn btn-ghost" onClick={onSignOut} disabled={busy !== null}>
              {busy === "out" ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </div>
      ) : (
        <div className="account-signed-out">
          <p className="account-status">
            You do not need an account. Signing in keeps your data if you lose this device.
          </p>
          <div className="account-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={onCreate}
              disabled={busy !== null}
            >
              {busy === "create" ? "Waiting for your device…" : "Create an account"}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onPasskeySignIn}
              disabled={busy !== null}
            >
              {busy === "signin" ? "Waiting for your device…" : "Sign in with a passkey"}
            </button>
            <button type="button" className="btn btn-ghost" onClick={onGoogle} disabled={busy !== null}>
              {busy === "google" ? "Talking to Google…" : "Sign in with Google"}
            </button>
          </div>
        </div>
      )}

      {error && (
        // Inline rather than a toast: the message is about the buttons directly
        // above it, and a toast that outlives the button it explains is the
        // stale-report problem the import panel already solved by not doing it.
        <p className="account-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
