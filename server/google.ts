/**
 * Google Sign-In, verified rather than trusted.
 *
 * A Google ID token is a JWT signed by Google. Everything below exists because
 * the token arrives from the client, which means every field in it is attacker
 * controlled until the signature says otherwise. Decoding without verifying is
 * the classic version of this bug, so the order here is: signature first, then
 * the claims.
 *
 * ## What is checked, and why each one
 *
 * - **The signature**, against Google's published rotating keys (JWKS), so the
 *   claims are Google's rather than whoever called the endpoint.
 * - **`aud`** must be this application's client id. Without it, a token minted
 *   for *any other* Google client — including one an attacker owns — would be
 *   accepted here.
 * - **`iss`** must be Google. `accounts.google.com` appears both with and
 *   without the scheme in the wild, and Google's own guidance lists both.
 * - **`exp`** (and `iat`) with a small leeway, so a captured token cannot be
 *   replayed indefinitely and a clock skew does not reject a fresh one.
 *
 * ## What is NOT trusted
 *
 * **The `email` claim is not an identity.** ADR-0008: `sub` is the stable
 * identifier ("Only use the Google ID token's `sub` field as the unique
 * identifier for the user"), and an address "may not be unique to this account
 * and could change over time". It is returned as an attribute so the Organizer
 * has a way to be contacted and found, and the caller must never join on it.
 *
 * `email_verified` is reported as `emailOwnedByIssuer` rather than as truth:
 * Google is authoritative for a `@gmail.com` address or one with `hd` set, and
 * is **not** authoritative for a third-party domain, where "ownership of the
 * third party email account may have since changed". A caller that wants to act
 * on the address has to decide that itself.
 */

/** Google's issuers, in both spellings its own documentation lists. */
const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

/** Google's published key set. Rotating, so it is fetched and cached, not pinned. */
export const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";

/** One hour, the shorter of Google's own cache directives for this endpoint. */
const JWKS_TTL_MS = 60 * 60 * 1000;

/** Clock-skew leeway on `exp` and `iat`. */
const LEEWAY_SECONDS = 60;

export interface GoogleIdentity {
  /** The issuer, as verified. Half of the only stable identifier. */
  issuer: string;
  /** `sub`: the other half, and the value ADR-0008 says to use. */
  subject: string;
  /** An attribute, never a key. Null when Google supplied none. */
  email: string | null;
  /**
   * Whether the address belongs to the issuer — true for Google's own domains,
   * false for a third party. Not "the address is verified", which would be a
   * stronger claim than Google makes.
   */
  emailOwnedByIssuer: boolean;
}

export type GoogleVerification =
  | { ok: true; identity: GoogleIdentity }
  | { ok: false; reason: string };

interface Jwk {
  kid?: string;
  kty?: string;
  n?: string;
  e?: string;
  alg?: string;
}

interface Jwks {
  keys: Jwk[];
}

/** Cached per isolate. Google rotates keys, so this expires. */
let cachedKeys: { fetchedAt: number; keys: Jwk[] } | null = null;

/** Fetches Google's key set. Injectable so the unit tests never touch the network. */
export type JwksFetcher = () => Promise<Jwks>;

const fetchJwks: JwksFetcher = async () => {
  const response = await fetch(GOOGLE_JWKS_URL);
  if (!response.ok) throw new Error(`Google's key set answered ${response.status}.`);
  return (await response.json()) as Jwks;
};

/**
 * A key set, from cache when it is fresh.
 *
 * `now` is a parameter for the same reason the fetcher is: a cache that can only
 * be tested by waiting an hour is a cache nothing tests.
 */
async function keySet(fetcher: JwksFetcher, now: number): Promise<Jwk[]> {
  if (cachedKeys && now - cachedKeys.fetchedAt < JWKS_TTL_MS) return cachedKeys.keys;
  const jwks = await fetcher();
  cachedKeys = { fetchedAt: now, keys: jwks.keys };
  return jwks.keys;
}

/** Drop the cache. For tests, and for a retry after an unknown `kid`. */
export function resetJwksCache(): void {
  cachedKeys = null;
}

interface JwtParts {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  signingInput: Uint8Array;
  signature: Uint8Array;
}

function decodeJwt(token: string): JwtParts | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [rawHeader, rawPayload, rawSignature] = parts;
  try {
    const decoder = new TextDecoder();
    const header = JSON.parse(decoder.decode(fromBase64UrlDecode(rawHeader))) as Record<string, unknown>;
    const payload = JSON.parse(decoder.decode(fromBase64UrlDecode(rawPayload))) as Record<string, unknown>;
    return {
      header,
      payload,
      signingInput: new TextEncoder().encode(`${rawHeader}.${rawPayload}`),
      signature: fromBase64UrlDecode(rawSignature),
    };
  } catch {
    return null;
  }
}

// A local base64url decoder rather than the shared one, because `atob` returns
// a binary string and a JWT's segments are text: decoding straight to bytes here
// keeps the JSON parse honest about UTF-8.
function fromBase64UrlDecode(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

const asString = (v: unknown): string | null => (typeof v === "string" ? v : null);
const asNumber = (v: unknown): number | null => (typeof v === "number" ? v : null);

/**
 * Verify a Google ID token.
 *
 * `audience` is the application's own OAuth client id, which is a runtime
 * secret held in the Worker's environment and never in the repository.
 */
export async function verifyGoogleIdToken(
  token: string,
  audience: string,
  options: { now?: number; fetchKeys?: JwksFetcher } = {},
): Promise<GoogleVerification> {
  const now = options.now ?? Date.now();
  const fetcher = options.fetchKeys ?? fetchJwks;

  const parts = decodeJwt(token);
  if (!parts) return { ok: false, reason: "That credential is not a well-formed JWT." };

  const alg = asString(parts.header.alg);
  // `none` is the attack this refuses: an unsigned token claiming any identity.
  if (alg !== "RS256") return { ok: false, reason: `Unsupported token algorithm: ${alg ?? "none"}.` };

  const kid = asString(parts.header.kid);
  if (!kid) return { ok: false, reason: "That credential names no signing key." };

  const keys = await keySet(fetcher, now);
  const jwk = keys.find((k) => k.kid === kid);
  // A rotated key: the cache is stale rather than the token being forged, so the
  // set is re-fetched once before giving up. Without this, every sign-in in the
  // first hour after a rotation would fail.
  if (!jwk) {
    resetJwksCache();
    const refreshed = await keySet(fetcher, now);
    const retried = refreshed.find((k) => k.kid === kid);
    if (!retried) return { ok: false, reason: "That credential is signed with a key Google does not publish." };
    return finishVerification(parts, retried, audience, now);
  }

  return finishVerification(parts, jwk, audience, now);
}

async function finishVerification(
  parts: JwtParts,
  jwk: Jwk,
  audience: string,
  now: number,
): Promise<GoogleVerification> {
  const key = await crypto.subtle.importKey(
    "jwk",
    { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: "RS256", ext: true },
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const signatureValid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    parts.signature as unknown as ArrayBuffer,
    parts.signingInput as unknown as ArrayBuffer,
  );
  if (!signatureValid) return { ok: false, reason: "That credential's signature does not check out." };

  const issuer = asString(parts.payload.iss);
  if (!issuer || !GOOGLE_ISSUERS.includes(issuer)) {
    return { ok: false, reason: "That credential was not issued by Google." };
  }

  const tokenAudience = asString(parts.payload.aud);
  if (tokenAudience !== audience) {
    // The check that stops a token minted for somebody else's Google client
    // from being accepted as a sign-in here.
    return { ok: false, reason: "That credential was issued for a different application." };
  }

  const expiresAt = asNumber(parts.payload.exp);
  if (expiresAt === null || expiresAt + LEEWAY_SECONDS < Math.floor(now / 1000)) {
    return { ok: false, reason: "That credential has expired." };
  }

  const issuedAt = asNumber(parts.payload.iat);
  if (issuedAt !== null && issuedAt - LEEWAY_SECONDS > Math.floor(now / 1000)) {
    return { ok: false, reason: "That credential is not valid yet." };
  }

  const subject = asString(parts.payload.sub);
  if (!subject) return { ok: false, reason: "That credential identifies nobody." };

  const email = asString(parts.payload.email);
  const hostedDomain = asString(parts.payload.hd);
  const returnEmail = email;

  return {
    ok: true,
    identity: {
      issuer,
      subject,
      email: returnEmail,
      // Google is authoritative for its own domains; for a third-party address
      // it says so itself ("ownership of the third party email account may have
      // since changed"), which is why this is not simply `email_verified`.
      emailOwnedByIssuer: Boolean(hostedDomain) || (email?.endsWith("@gmail.com") ?? false),
    },
  };
}
