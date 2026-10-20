/**
 * Google Sign-In, loaded only when an Organizer asks for it.
 *
 * **The script is fetched on click, never on page load, and that is a
 * requirement rather than an optimisation.** `e2e/live/offline.spec.ts` asserts
 * that a normal visit to the deployed app reaches no host but its own, and the
 * README's runtime section says there is no third-party request of any kind.
 * A `<script src="https://accounts.google.com/...">` in the document would make
 * both false. Deferring the load keeps the promise for everyone who never
 * presses this button, and scopes it honestly for the one person who does:
 * choosing Google is a deliberate act, and it is the act that contacts Google.
 *
 * The client id is not in the bundle either. It comes from `/api/config`, so the
 * client keeps exactly one Vite environment read (`src/account/session.ts:50`,
 * which the acceptance criteria assert is the only one) and a deployment can
 * enable or disable Google without a rebuild.
 */

/** The subset of Google Identity Services this module uses. */
interface GoogleIdentityServices {
  accounts: {
    id: {
      initialize(config: {
        client_id: string;
        callback: (response: { credential?: string }) => void;
        cancel_on_tap_outside?: boolean;
      }): void;
      prompt(momentListener?: (notification: { isNotDisplayed(): boolean; isSkippedMoment(): boolean }) => void): void;
      /**
       * The rendered-button fallback. One Tap is best-effort by Google's own
       * documentation, `isSkippedMoment()` is a normal outcome (no Google
       * session in the profile, third-party cookies blocked, or the prompt
       * was dismissed once and Google now suppresses it for hours), so a
       * button that only ever calls `prompt()` is a button that does nothing
       * for exactly the people it exists for. A rendered button opens the
       * account chooser on click, which works in every one of those states.
       */
      renderButton(
        parent: HTMLElement,
        options: { type?: string; size?: string; text?: string; shape?: string; theme?: string },
      ): void;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleIdentityServices;
  }
}

const GSI_SRC = "https://accounts.google.com/gsi/client";

/** Injected at most once per document, however many times this is called. */
let scriptPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (!scriptPromise) {
    scriptPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = GSI_SRC;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => {
        // Leave nothing behind that would make a retry think it had loaded.
        scriptPromise = null;
        reject(new Error("Could not reach Google. Check your connection and try again."));
      };
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

/** The client id this deployment configured, or null if it has none. */
export async function googleClientId(): Promise<string | null> {
  const response = await fetch("/api/config");
  if (!response.ok) return null;
  const body = (await response.json().catch(() => ({}))) as { googleClientId?: string | null };
  return body.googleClientId ?? null;
}

/**
 * Ask Google for an ID token.
 *
 * Resolves with the token, or rejects with something a person can act on. The
 * token is verified server-side and is never trusted here for anything beyond
 * "this is what Google said".
 *
 * `fallback`, when supplied and still in the document, receives Google's own
 * rendered sign-in button whenever One Tap declines to appear — the promise
 * then stays pending until the Organizer picks an account through it (or
 * abandons the panel and the call's lifetime ends with the panel). Callers
 * that pass no container keep the one-shot contract.
 */
export async function requestGoogleCredential(clientId: string, fallback?: HTMLElement): Promise<string> {
  await loadScript();
  const gsi = window.google;
  if (!gsi) throw new Error("Google Sign-In did not load.");

  return new Promise<string>((resolve, reject) => {
    let settled = false;
    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      fn();
    };

    gsi.accounts.id.initialize({
      client_id: clientId,
      cancel_on_tap_outside: true,
      callback: (response) => {
        // Captured before the closure: TypeScript cannot carry the narrowing
        // into the callback, and `resolve` needs a string.
        const credential = response.credential;
        if (credential) settle(() => resolve(credential));
        else settle(() => reject(new Error("Google did not return a credential.")));
      },
    });

    gsi.accounts.id.prompt((notification) => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        // One Tap declined to appear, which is a normal state, not an error.
        // With a container, hand the choice to Google's rendered button: it
        // opens the account chooser on click and works where One Tap will
        // not (no Google session, blocked third-party cookies, the dismissal
        // cooldown). Without one (callers that only want the answer), keep
        // the old contract and report.
        if (fallback && fallback.isConnected) {
          gsi.accounts.id.renderButton(fallback, { type: "standard", size: "large", text: "signin_with", shape: "pill", theme: "filled_blue" });
          return;
        }
        settle(() => reject(new Error("Google did not offer a sign-in. Try a passkey instead.")));
      }
    });
  });
}
