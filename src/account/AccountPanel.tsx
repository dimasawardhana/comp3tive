import { useCallback, useState } from "react";
import { getSession, signInWithPasskey, signInWithGoogle, signOut, type Session } from "./session";
import { googleClientId, requestGoogleCredential } from "./google-signin";

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

type Busy = "passkey" | "google" | "out" | null;

export function AccountPanel() {
  const [session, setLocalSession] = useState<Session | null>(() => getSession());
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  /**
   * Both buttons are always offered, and nothing is fetched to decide that.
   *
   * **Deliberate, and it was a bug first.** An earlier cut asked `/api/config`
   * on mount so an unconfigured deployment could hide the Google button. That
   * made every load of the Dashboard a network request, signed in or not —
   * which falsifies `README.md`'s "nothing in `src/` opens a network connection
   * at all" and makes a Guest's device talk to a server for nothing. The probe
   * was buying a hidden button. Clicking instead costs nothing when Google *is*
   * configured, and says so plainly when it is not.
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

  const onPasskey = () => void run("passkey", () => signInWithPasskey());
  const onGoogle = () =>
    void run("google", async () => {
      const clientId = await googleClientId();
      if (!clientId) throw new Error("Google sign-in is not configured on this deployment.");
      await signInWithGoogle(await requestGoogleCredential(clientId));
    });
  const onSignOut = () =>
    void run("out", async () => {
      signOut();
    });

  return (
    <section className="dashboard-account" aria-label="Account">
      <div className="dashboard-teasers-head">
        <h2>Account</h2>
        <span className="kicker">Optional</span>
      </div>

      {session ? (
        <div className="account-signed-in">
          <p className="account-status">
            Signed in. Your data is on this device and on your Account.
          </p>
          <div className="account-actions">
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
              onClick={onPasskey}
              disabled={busy !== null}
            >
              {busy === "passkey" ? "Waiting for your device…" : "Use a passkey"}
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
