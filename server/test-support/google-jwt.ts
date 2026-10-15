/**
 * A locally generated Google, for tests.
 *
 * Signs real JWTs with a real RSA key so `verifyGoogleIdToken` runs its actual
 * `crypto.subtle.verify` path. Shared by `google.test.ts` and `identity.test.ts`
 * because both need a token that would genuinely pass verification — the
 * alternative is one of them stubbing the verifier, and then the thing under
 * test is not the thing that ships.
 *
 * Test support only: nothing in `server/` outside a `.test.ts` imports this.
 */
import type { JwksFetcher } from "../google";
import { toBase64Url } from "../encoding";

export const CLIENT_ID = "test-client-id.apps.googleusercontent.com";
export const KEY_ID = "test-key-1";
/** A fixed instant, so no assertion depends on the wall clock. */
export const NOW = 1_800_000_000_000;

/**
 * The key handle `crypto.subtle` hands back.
 *
 * Derived from the API rather than named as the global `CryptoKey`: the server
 * project's `lib` has no DOM, and Node's own declarations scope that name to
 * `crypto.webcrypto`. Deriving it means this file agrees with whichever
 * `crypto.subtle` is in scope — Node here, `workerd` in the Worker — instead of
 * pinning one of them.
 */
type SubtleKey = Awaited<ReturnType<typeof crypto.subtle.importKey>>;

export interface Signer {
  privateKey: SubtleKey;
  jwk: { kty: string; n: string; e: string; kid: string; alg: string };
}

export async function newSigner(kid = KEY_ID): Promise<Signer> {
  const pair = await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  );
  const exported = await crypto.subtle.exportKey("jwk", pair.publicKey);
  return {
    privateKey: pair.privateKey,
    jwk: { kty: "RSA", n: exported.n as string, e: exported.e as string, kid, alg: "RS256" },
  };
}

/** The key set a Worker would have got from Google, over a test key. */
export const keysFrom =
  (...jwks: Signer["jwk"][]): JwksFetcher =>
  async () => ({ keys: jwks });

/** base64url-encoded JSON, the JWT segment encoding. Exported for forging tests. */
export const b64urlJson = (value: unknown): string =>
  toBase64Url(new TextEncoder().encode(JSON.stringify(value)));

/** A signed JWT. `over` patches the payload; `header` patches the header. */
export async function googleToken(
  signer: Signer,
  over: Record<string, unknown> = {},
  header: Record<string, unknown> = {},
): Promise<string> {
  const nowSeconds = Math.floor(NOW / 1000);
  const payload = {
    iss: "https://accounts.google.com",
    aud: CLIENT_ID,
    sub: "google-subject-1",
    email: "organizer@gmail.com",
    email_verified: true,
    iat: nowSeconds - 10,
    exp: nowSeconds + 600,
    ...over,
  };
  const head = b64urlJson({ alg: "RS256", typ: "JWT", kid: signer.jwk.kid, ...header });
  const body = b64urlJson(payload);
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    signer.privateKey,
    new TextEncoder().encode(`${head}.${body}`) as unknown as ArrayBuffer,
  );
  return `${head}.${body}.${toBase64Url(new Uint8Array(signature))}`;
}
