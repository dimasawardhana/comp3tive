/**
 * Byte/string encodings.
 *
 * **WebCrypto and hand-rolled base64url, not `node:crypto` and `Buffer`.** The
 * Worker has no Node builtins, so anything shared between the Worker and its
 * tests has to be portable. `Uint8Array` and `btoa` exist in both `workerd` and
 * Node 22+, so this file runs unchanged in either.
 *
 * Base64url rather than base64 because every value that crosses this boundary —
 * a credential id, a COSE public key, a user handle, a challenge — is defined by
 * WebAuthn as base64url with no padding, and a `+` or `/` would be re-encoded by
 * anything that puts it in a URL.
 */

/** base64url, no padding — WebAuthn's own encoding for the values it defines. */
export function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}


/**
 * Inverse of `toBase64Url`. Accepts standard base64 too, and tolerates padding.
 *
 * The return type names `ArrayBuffer` explicitly rather than the bare
 * `Uint8Array`. TypeScript's newer lib types parameterise the buffer, and the
 * WebAuthn library wants one it can hand to WebCrypto, which a
 * `SharedArrayBuffer` cannot be. `new Uint8Array(length)` already produces the
 * narrower type; this only has to say so.
 */
export function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Lowercase hex. Used for the session-token digest, where case must not matter. */
export function toHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}
