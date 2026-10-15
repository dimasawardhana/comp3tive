/**
 * Passkeys, wrapped around `@simplewebauthn/server`.
 *
 * ADR-0008 is explicit that the verification is not hand-rolled: Google's own
 * guidance says to use a library, and the specification is still subject to
 * change. So this file holds the *decisions* — which RP ID, which origin, which
 * user-verification policy, and the one place the library's defaults are
 * deliberately overridden — and lets the library do the parsing and the
 * signature checking.
 *
 * Nothing here touches the database. The ceremonies are orchestrated in
 * `./identity.ts`; this module is pure request/response plumbing, which is what
 * makes it readable next to the ADR it implements.
 */

import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
  type WebAuthnCredential,
} from "@simplewebauthn/server";
import { fromBase64Url } from "./encoding";
import type { Account, Credential } from "../src/domain/types";

/**
 * How long a ceremony's challenge stays valid.
 *
 * Long enough for a user to pick an authenticator and complete a prompt; short
 * enough that an abandoned ceremony leaves nothing worth replaying. The
 * challenge is single-use regardless (see `takeChallenge`), so this is the
 * backstop rather than the protection.
 */
export const CHALLENGE_TTL_MS = 5 * 60 * 1000;

/**
 * The Relying Party, derived from the request rather than configured.
 *
 * **Derived, and that is the correct thing rather than the convenient one.**
 * WebAuthn binds a credential to one RP ID and one origin: a passkey registered
 * against `workers.dev` cannot authenticate against a custom domain, and the
 * reverse. A Worker reached by both hosts must therefore answer each with its
 * own hostname, which is exactly what a request-derived value does.
 *
 * It is safe to trust because `request.url` is not user input — the platform
 * sets it from the request that actually arrived, so a caller cannot ask this
 * Worker to mint options for a hostname it does not serve. That is also why
 * there is no allowlist here: an allowlist would be a second copy of a fact the
 * request already carries, and it would go stale the day the custom domain is
 * settled (ADR-0008).
 */
export function relyingParty(request: Request): { rpID: string; origin: string } {
  const url = new URL(request.url);
  return { rpID: url.hostname, origin: url.origin };
}

/**
 * The display name shown by the authenticator's own UI.
 *
 * Not the user handle: the handle is 64 random bytes and the spec forbids it
 * carrying anything identifying, so this is the human-readable half. It is a
 * hint on the device, may be anything, and is never used to look an Account up.
 */
function displayName(account: { email: string | null }): string {
  return account.email ?? "Organizer";
}

/** Registration options for a brand-new Account. */
export async function newAccountRegistrationOptions(
  request: Request,
  account: Pick<Account, "handle" | "email">,
): Promise<Awaited<ReturnType<typeof generateRegistrationOptions>>> {
  const { rpID } = relyingParty(request);
  return generateRegistrationOptions({
    rpName: "comp3tive",
    rpID,
    // The user handle, base64url-decoded. `newUserHandle` generated 64 random
    // bytes and this is the only shape the authenticator will accept.
    userID: fromBase64Url(account.handle),
    userName: displayName(account),
    userDisplayName: displayName(account),
    // Discoverable, so signing in on a second device can offer the credential
    // without the user typing an identifier first (ADR-0008).
    authenticatorSelection: { residentKey: "required", userVerification: "preferred" },
    // Nothing to exclude: this Account has no credentials yet.
    excludeCredentials: [],
  });
}

/** Registration options for adding a passkey to an Account that already exists. */
export async function addPasskeyOptions(
  request: Request,
  account: Account,
  existing: Credential[],
): Promise<Awaited<ReturnType<typeof generateRegistrationOptions>>> {
  const { rpID } = relyingParty(request);
  return generateRegistrationOptions({
    rpName: "comp3tive",
    rpID,
    userID: fromBase64Url(account.handle),
    userName: displayName(account),
    userDisplayName: displayName(account),
    authenticatorSelection: { residentKey: "required", userVerification: "preferred" },
    // Stops the same authenticator registering twice for one Account. The
    // storage layer would collapse the duplicate anyway, but the user would have
    // completed a prompt for nothing.
    excludeCredentials: existing.map((c) => ({ id: c.id, transports: c.transports as never })),
  });
}

/** Verify a registration response against the challenge it answered. */
export async function verifyRegistration(
  request: Request,
  response: RegistrationResponseJSON,
  expectedChallenge: string,
) {
  const { rpID, origin } = relyingParty(request);
  return verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    requireUserVerification: false,
  });
}

/**
 * Authentication options.
 *
 * `allowCredentials` is empty on purpose: the credentials are discoverable, so
 * the authenticator offers the ones it holds for this RP ID and the user picks.
 * That is what makes sign-in possible without typing an address first, and it is
 * the flow ADR-0008 names.
 */
export async function signInOptions(
  request: Request,
): Promise<Awaited<ReturnType<typeof generateAuthenticationOptions>>> {
  const { rpID } = relyingParty(request);
  return generateAuthenticationOptions({
    rpID,
    allowCredentials: [],
    userVerification: "preferred",
  });
}

/** Verify an authentication response against the challenge it answered. */
export async function verifySignIn(
  request: Request,
  response: AuthenticationResponseJSON,
  expectedChallenge: string,
  credential: Credential,
) {
  const { rpID, origin } = relyingParty(request);
  const stored: WebAuthnCredential = {
    id: credential.id,
    publicKey: fromBase64Url(credential.publicKey),
    // **Zero, deliberately, and this is the one library default this file
    // overrides.** The library refuses a response whose counter is not greater
    // than the stored one, and — read from its source on 2026-10-15 — it does so
    // *before* verifying the signature. ADR-0008 forbids that failure: a
    // non-increasing counter "is a signal, but not proof", synced and platform
    // authenticators produce it legitimately, and failing closed locks out the
    // exact user this feature exists for. Passing zero skips that branch, so the
    // signature is always checked. The counter is not discarded: the caller
    // stores the presented value as a high-water mark (see `recordSignCount`),
    // which keeps the signal without ever refusing a sign-in.
    counter: 0,
    transports: credential.transports as never,
  };
  return verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    credential: stored,
    requireUserVerification: false,
  });
}
