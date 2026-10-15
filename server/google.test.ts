import { describe, expect, it } from "vitest";
import { resetJwksCache, verifyGoogleIdToken, type JwksFetcher } from "./google";
import { toBase64Url } from "./encoding";
import { CLIENT_ID, NOW, b64urlJson, googleToken, keysFrom, newSigner } from "./test-support/google-jwt";

/**
 * Google ID-token verification, against a real signature.
 *
 * The point of these cases is that the signature check is not decorative. Every
 * test signs a payload with a locally generated RSA key and serves the matching
 * public key as the "Google" key set, so a token that verifies here has been
 * through `crypto.subtle.verify` for real. A test that only decoded the JWT and
 * asserted on its claims would pass against an implementation that never
 * checked anything.
 *
 * The negative cases are the ones that matter: a token signed by the wrong key,
 * minted for another application, or expired must all be refused, because each
 * corresponds to a way this endpoint could be talked into a false identity.
 *
 * The key generation and signing live in `./test-support/google-jwt`, shared
 * with `identity.test.ts` so both exercise the same real verification rather
 * than one of them stubbing it out.
 */
const token = googleToken;

function verify(jwt: string, fetcher: JwksFetcher) {
  resetJwksCache();
  return verifyGoogleIdToken(jwt, CLIENT_ID, { now: NOW, fetchKeys: fetcher });
}

describe("a valid Google token", () => {
  it("yields the issuer and subject that identify the person", async () => {
    const signer = await newSigner();
    const result = await verify(await token(signer), keysFrom(signer.jwk));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.identity.issuer).toBe("https://accounts.google.com");
    expect(result.identity.subject).toBe("google-subject-1");
  });

  it("carries the address as an attribute", async () => {
    const signer = await newSigner();
    const result = await verify(await token(signer), keysFrom(signer.jwk));
    if (!result.ok) throw new Error(result.reason);
    expect(result.identity.email).toBe("organizer@gmail.com");
  });

  it("accepts the issuer spelled without a scheme", async () => {
    // Google's own documentation lists both spellings, and real tokens have
    // carried each. Refusing one would lock out legitimate sign-ins.
    const signer = await newSigner();
    const jwt = await token(signer, { iss: "accounts.google.com" });
    expect((await verify(jwt, keysFrom(signer.jwk))).ok).toBe(true);
  });

  it("treats a gmail address as owned by the issuer", async () => {
    const signer = await newSigner();
    const result = await verify(await token(signer), keysFrom(signer.jwk));
    if (!result.ok) throw new Error(result.reason);
    expect(result.identity.emailOwnedByIssuer).toBe(true);
  });

  it("does NOT treat a third-party address as owned by the issuer", async () => {
    // Google says ownership of a third-party address "may have since changed",
    // so an address at someone's own domain is a claim rather than a verified
    // contact. Reporting it as owned would be the stronger claim Google declines
    // to make (ADR-0008).
    const signer = await newSigner();
    const jwt = await token(signer, { email: "organizer@theirownclub.org" });
    const result = await verify(jwt, keysFrom(signer.jwk));
    if (!result.ok) throw new Error(result.reason);
    expect(result.identity.emailOwnedByIssuer).toBe(false);
  });
});

describe("a token that must be refused", () => {
  it("is refused when signed by a key Google does not publish", async () => {
    // The forgery this whole file exists for: a payload saying anything, signed
    // with a key the caller holds.
    const published = await newSigner("published-key");
    const attacker = await newSigner("published-key");
    const jwt = await token(attacker, {}, { kid: "published-key" });
    const result = await verify(jwt, keysFrom(published.jwk));
    expect(result.ok).toBe(false);
  });

  it("is refused when its signature has been tampered with", async () => {
    const signer = await newSigner();
    const jwt = await token(signer);
    const [head, body] = jwt.split(".");
    // A well-formed but wrong signature.
    const tampered = `${head}.${body}.${toBase64Url(new Uint8Array(256))}`;
    expect((await verify(tampered, keysFrom(signer.jwk))).ok).toBe(false);
  });

  it("is refused when its payload has been tampered with", async () => {
    const signer = await newSigner();
    const jwt = await token(signer);
    const [, , signature] = jwt.split(".");
    const forgedPayload = b64urlJson({ iss: "https://accounts.google.com", aud: CLIENT_ID, sub: "someone-else" });
    const forged = `${jwt.split(".")[0]}.${forgedPayload}.${signature}`;
    expect((await verify(forged, keysFrom(signer.jwk))).ok).toBe(false);
  });

  it("is refused when minted for a different application", async () => {
    // The `aud` check. Without it, a token issued for any other Google client —
    // including one an attacker registered — would sign a user in here.
    const signer = await newSigner();
    const jwt = await token(signer, { aud: "somebody-elses-client-id" });
    const result = await verify(jwt, keysFrom(signer.jwk));
    expect(result.ok).toBe(false);
  });

  it("is refused when it has expired", async () => {
    const signer = await newSigner();
    const jwt = await token(signer, { exp: Math.floor(NOW / 1000) - 3600 });
    expect((await verify(jwt, keysFrom(signer.jwk))).ok).toBe(false);
  });

  it("is refused when it is not yet valid", async () => {
    const signer = await newSigner();
    const jwt = await token(signer, { iat: Math.floor(NOW / 1000) + 3600 });
    expect((await verify(jwt, keysFrom(signer.jwk))).ok).toBe(false);
  });

  it("is refused when the issuer is not Google", async () => {
    const signer = await newSigner();
    const jwt = await token(signer, { iss: "https://evil.example" });
    expect((await verify(jwt, keysFrom(signer.jwk))).ok).toBe(false);
  });

  it("is refused when it identifies nobody", async () => {
    const signer = await newSigner();
    const jwt = await token(signer, { sub: undefined });
    expect((await verify(jwt, keysFrom(signer.jwk))).ok).toBe(false);
  });

  it("is refused when it is unsigned, whatever its claims say", async () => {
    // `alg: none` is the oldest JWT attack there is: a token with no signature
    // at all, claiming to be anyone.
    const signer = await newSigner();
    const jwt = await token(signer);
    const [head, body] = jwt.split(".");
    const unsignedHeader = b64urlJson({ alg: "none", typ: "JWT", kid: signer.jwk.kid });
    expect((await verify(`${unsignedHeader}.${body}.`, keysFrom(signer.jwk))).ok).toBe(false);
    expect(head).not.toBe(unsignedHeader);
  });

  it("is refused when it is not a JWT at all", async () => {
    const signer = await newSigner();
    expect((await verify("not-a-jwt", keysFrom(signer.jwk))).ok).toBe(false);
    expect((await verify("a.b.c.d", keysFrom(signer.jwk))).ok).toBe(false);
  });
});

describe("key rotation", () => {
  it("re-fetches the key set when a token names an unknown key", async () => {
    // The realistic failure: Google rotates, the cached set is an hour old, and
    // the first sign-in after the rotation names a key the cache does not have.
    // Without the retry, every sign-in fails until the cache expires.
    const oldKey = await newSigner("old-key");
    const newKey = await newSigner("new-key");
    let fetches = 0;
    const rotating: JwksFetcher = async () => {
      fetches += 1;
      // Stale on the first look, current afterwards.
      return { keys: fetches === 1 ? [oldKey.jwk] : [oldKey.jwk, newKey.jwk] };
    };
    resetJwksCache();
    const result = await verifyGoogleIdToken(await token(newKey), CLIENT_ID, {
      now: NOW,
      fetchKeys: rotating,
    });
    expect(result.ok).toBe(true);
    expect(fetches).toBeGreaterThan(1);
  });
});
