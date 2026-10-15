/**
 * The values that have to be unguessable: session tokens, challenge ids,
 * Account ids and WebAuthn user handles.
 *
 * Everything here is WebCrypto, so it runs in the Worker and in the tests alike.
 *
 * ## The two rules this file exists to keep in one place
 *
 * **A session token is never stored.** `newSessionToken` returns the token to
 * the client and `hashSessionToken` returns what goes in the database, so a
 * leaked dump of `sessions` contains no usable credential. The digest is
 * SHA-256 rather than a password hash on purpose: the token is 256 bits of
 * randomness, so there is no dictionary to attack and nothing for a slow KDF to
 * buy — a password hash would only add latency to every authenticated request.
 *
 * **A user handle is 64 random bytes and carries nothing.** WebAuthn's spec
 * forbids it holding personal data and recommends exactly this shape, and ADR-0008
 * records the reason: the handle is what an authenticator stores and returns, so
 * anything readable in it would leak from the device.
 */

import { toBase64Url, toHex } from "./encoding";

/** 256 bits. The token's whole security is this call. */
const TOKEN_BYTES = 32;
/** 64 bytes, per WebAuthn's recommendation for the user handle. */
const HANDLE_BYTES = 64;

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

/** A fresh session token. Returned to the client; never written to the database. */
export function newSessionToken(): string {
  return toBase64Url(randomBytes(TOKEN_BYTES));
}

/** The digest of a session token, which IS what the database holds. */
export async function hashSessionToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return toHex(new Uint8Array(digest));
}

/** A ceremony id, tying an options call to the verify call that follows it. */
export function newChallengeId(): string {
  return toBase64Url(randomBytes(TOKEN_BYTES));
}

/** An Account's opaque key. Its own primary key, not derived from anything. */
export function newAccountId(): string {
  return crypto.randomUUID();
}

/** A WebAuthn user handle: 64 random bytes, base64url, PII-free, stable. */
export function newUserHandle(): string {
  return toBase64Url(randomBytes(HANDLE_BYTES));
}

/** A fresh WebAuthn challenge, base64url as the spec requires. */
export function newChallenge(): string {
  return toBase64Url(randomBytes(TOKEN_BYTES));
}
