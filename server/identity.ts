/**
 * The identity use-cases, over `./storage`, `./webauthn` and `./google`.
 *
 * Every function here takes the `Database` seam rather than `env`, so the whole
 * sign-in surface is testable without a Worker runtime. `./index.ts` owns
 * routing and HTTP shapes; this file owns what actually happens.
 *
 * ## The rule this file exists to hold
 *
 * **An Account is its own key, and nothing is joined on an address.** Both ways
 * in follow the same three steps — establish *who* is asking from something
 * cryptographic, look that up, and only then decide about an Account:
 *
 * - A passkey establishes a credential id whose signature has been checked, and
 *   the Account is whichever Account that credential row points at.
 * - Google establishes (iss, sub) whose signature has been checked, and the
 *   Account is whichever Account that pair points at.
 *
 * Neither ever asks "does an Account have this email?" and adopts it. That is
 * the account-takeover pattern ADR-0008 rejects, and the reason `email` is
 * written as an attribute and never read as a key.
 */

import { toBase64Url } from "./encoding";
import type { Account, Credential, Id } from "../src/domain/types";
import type { Database } from "./db";
import * as storage from "./storage";
import * as webauthn from "./webauthn";
import { verifyGoogleIdToken, type JwksFetcher } from "./google";
import {
  hashSessionToken,
  newAccountId,
  newChallengeId,
  newSessionToken,
  newUserHandle,
} from "./tokens";

/**
 * How long a session lasts.
 *
 * Long, and deliberately so: ADR-0008 requires that a lapsed token never clears
 * a device's data, and the whole point of the Account is an Organizer with no
 * signal on a court. A short expiry would buy nothing here — the token is not
 * what protects the data, the signature check is.
 */
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface IssuedSession {
  accountId: Id;
  /** Returned to the client once. Only its digest is stored. */
  token: string;
  expiresAt: number;
}

/** A ceremony's options plus the id that ties them to their verify call. */
export interface Ceremony<T> {
  ceremonyId: string;
  options: T;
}

async function issueSession(db: Database, accountId: Id, now: number): Promise<IssuedSession> {
  const token = newSessionToken();
  const expiresAt = now + SESSION_TTL_MS;
  await storage.insertSession(db, await hashSessionToken(token), accountId, now, expiresAt);
  return { accountId, token, expiresAt };
}

/** The Account a bearer token belongs to, or null. `now` is injectable for tests. */
export async function accountForToken(db: Database, token: string, now = Date.now()): Promise<Id | null> {
  if (!token) return null;
  const session = await storage.findLiveSession(db, await hashSessionToken(token), now);
  return session?.accountId ?? null;
}

export async function signOut(db: Database, token: string): Promise<void> {
  if (!token) return;
  await storage.deleteSession(db, await hashSessionToken(token));
}

// ---- Registration (a passkey) ----

/**
 * Options for registering a passkey.
 *
 * Two callers, and the difference is who the credential ends up belonging to:
 *
 * - **Signed in** — adding a second way in. An explicit act by an Organizer who
 *   already controls the Account, which is why it may attach to an existing one.
 * - **Signed out** — creating an Account. The Account row is NOT written yet:
 *   the generated id and user handle ride in the challenge, and the row appears
 *   only once a credential has actually verified. An abandoned ceremony
 *   therefore leaves no Account behind.
 */
export async function startRegistration(
  db: Database,
  request: Request,
  options: { accountId?: Id | null; email?: string | null; now?: number } = {},
): Promise<Ceremony<unknown>> {
  const now = options.now ?? Date.now();
  const ceremonyId = newChallengeId();
  const challengeExpiry = now + webauthn.CHALLENGE_TTL_MS;

  if (options.accountId) {
    const account = await storage.getAccount(db, options.accountId);
    if (!account) throw new Error("No such Account.");
    const existing = await storage.listCredentials(db, account.id);
    const opts = await webauthn.addPasskeyOptions(request, account, existing);
    await storage.insertChallenge(
      db,
      ceremonyId,
      opts.challenge,
      "registration",
      account.id,
      null,
      challengeExpiry,
    );
    return { ceremonyId, options: opts };
  }

  // A new Account, not yet written.
  const pending: Account = {
    id: newAccountId(),
    handle: newUserHandle(),
    email: options.email ?? null,
    createdAt: now,
  };
  const opts = await webauthn.newAccountRegistrationOptions(request, pending);
  await storage.insertChallenge(
    db,
    ceremonyId,
    opts.challenge,
    "registration",
    pending.id,
    JSON.stringify({ handle: pending.handle, email: pending.email }),
    challengeExpiry,
  );
  return { ceremonyId, options: opts };
}

export interface RegistrationResult {
  account: Account;
  credential: Credential;
  session: IssuedSession;
}

/**
 * Verify a registration response and finish the ceremony.
 *
 * Creates the Account when the challenge named one that does not exist yet,
 * which is the new-Account path. Idempotent in the sense that matters: a
 * replayed response finds no challenge, because `takeChallenge` consumed it.
 */
export async function finishRegistration(
  db: Database,
  request: Request,
  ceremonyId: string,
  response: Parameters<typeof webauthn.verifyRegistration>[1],
  now = Date.now(),
): Promise<RegistrationResult> {
  const challenge = await storage.takeChallenge(db, ceremonyId, "registration", now);
  if (!challenge) throw new Error("That registration attempt has expired. Try again.");

  const verification = await webauthn.verifyRegistration(request, response, challenge.value);
  if (!verification.verified) throw new Error("That passkey could not be verified.");
  const { registrationInfo } = verification;
  if (!registrationInfo) throw new Error("That passkey could not be verified.");

  let accountId = challenge.accountId;
  if (!accountId) throw new Error("That registration attempt is missing its Account.");

  let account = await storage.getAccount(db, accountId);
  if (!account) {
    // The new-Account path: the row is created now, not at options time.
    const pending = challenge.payload
      ? (JSON.parse(challenge.payload) as { handle: string; email: string | null })
      : null;
    if (!pending) throw new Error("That registration attempt is missing its Account.");
    account = { id: accountId, handle: pending.handle, email: pending.email, createdAt: now };
    await storage.insertAccount(db, account);
  }

  const credential: Credential = {
    id: registrationInfo.credential.id,
    accountId: account.id,
    publicKey: toBase64Url(registrationInfo.credential.publicKey),
    signCount: registrationInfo.credential.counter,
    backedUp: registrationInfo.credentialBackedUp,
    deviceType: registrationInfo.credentialDeviceType,
    transports: response.response.transports ?? [],
    createdAt: now,
  };
  await storage.upsertCredential(db, credential);

  const session = await issueSession(db, account.id, now);
  return { account, credential, session };
}

// ---- Sign-in (a passkey) ----

export async function startSignIn(db: Database, request: Request, now = Date.now()): Promise<Ceremony<unknown>> {
  const options = await webauthn.signInOptions(request);
  const ceremonyId = newChallengeId();
  await storage.insertChallenge(
    db,
    ceremonyId,
    options.challenge,
    "authentication",
    null,
    null,
    now + webauthn.CHALLENGE_TTL_MS,
  );
  return { ceremonyId, options };
}

/**
 * Verify an authentication response.
 *
 * The Account comes from the credential row the response's id names, and from
 * nowhere else. A credential this server never registered is refused rather than
 * attributed to anybody.
 */
export async function finishSignIn(
  db: Database,
  request: Request,
  ceremonyId: string,
  response: Parameters<typeof webauthn.verifySignIn>[1],
  now = Date.now(),
): Promise<IssuedSession> {
  const challenge = await storage.takeChallenge(db, ceremonyId, "authentication", now);
  if (!challenge) throw new Error("That sign-in attempt has expired. Try again.");

  const credential = await storage.getCredential(db, response.id);
  if (!credential) throw new Error("That passkey is not registered.");

  const verification = await webauthn.verifySignIn(request, response, challenge.value, credential);
  if (!verification.verified) throw new Error("That passkey could not be verified.");

  // The counter is recorded, never enforced. See `recordSignCount` and the note
  // in `webauthn.verifySignIn` for why a regression must not refuse a sign-in.
  await storage.recordSignCount(db, credential.id, verification.authenticationInfo.newCounter);

  return issueSession(db, credential.accountId, now);
}

// ---- Sign-in (Google) ----

export interface GoogleSignInOptions {
  clientId: string;
  now?: number;
  fetchKeys?: JwksFetcher;
}

/**
 * Sign in with a Google ID token.
 *
 * **A Google identity that has never been attached creates a new Account.** It
 * does not adopt an existing one whose `email` happens to match, and that is the
 * whole point: OIDC Core §5.7 names `iss` + `sub` as the only stable identifier,
 * and Google warns the `email` claim "may not be unique to this account and
 * could change over time". Adopting on a match is the takeover pattern ADR-0008
 * quotes Google's own documentation warning about.
 *
 * Attaching Google to an Account that already exists is a separate, explicit act
 * by a signed-in Organizer — `attachGoogle` below — not something this path
 * infers.
 */
export async function signInWithGoogle(
  db: Database,
  token: string,
  options: GoogleSignInOptions,
): Promise<IssuedSession> {
  const now = options.now ?? Date.now();
  const verified = await verifyGoogleIdToken(token, options.clientId, {
    now,
    fetchKeys: options.fetchKeys,
  });
  if (!verified.ok) throw new Error(verified.reason);
  const { issuer, subject, email } = verified.identity;

  const existing = await storage.findAccountByFederatedIdentity(db, issuer, subject);
  if (existing) return issueSession(db, existing.id, now);

  const account: Account = {
    id: newAccountId(),
    handle: newUserHandle(),
    // The address is stored as an attribute. Nothing looked it up to get here.
    email,
    createdAt: now,
  };
  await storage.insertAccount(db, account);
  await storage.linkFederatedIdentity(db, issuer, subject, account.id, now);
  return issueSession(db, account.id, now);
}

/**
 * Attach a Google identity to the signed-in Account.
 *
 * The explicit half of the rule above: this is how one Organizer ends up with
 * two ways into one Account, and it requires an existing session.
 */
export async function attachGoogle(
  db: Database,
  accountId: Id,
  token: string,
  options: GoogleSignInOptions,
): Promise<void> {
  const now = options.now ?? Date.now();
  const verified = await verifyGoogleIdToken(token, options.clientId, {
    now,
    fetchKeys: options.fetchKeys,
  });
  if (!verified.ok) throw new Error(verified.reason);

  // Refuse if this Google identity already belongs to a different Account.
  // Attaching would otherwise move it, or silently create a second link that
  // `findAccountByFederatedIdentity` could never resolve consistently.
  const owner = await storage.findAccountByFederatedIdentity(db, verified.identity.issuer, verified.identity.subject);
  if (owner && owner.id !== accountId) {
    throw new Error("That Google account is already attached to another Account.");
  }

  await storage.linkFederatedIdentity(
    db,
    verified.identity.issuer,
    verified.identity.subject,
    accountId,
    now,
  );
  // The address becomes an attribute of THIS account, if it had none. It is
  // still not a key, and no other Account is matched against it.
  const account = await storage.getAccount(db, accountId);
  if (account && !account.email && verified.identity.email) {
    await storage.setAccountEmail(db, accountId, verified.identity.email);
  }
}

/** The signed-in Organizer's own view of their Account. */
export async function describeAccount(db: Database, accountId: Id): Promise<Account | null> {
  return storage.getAccount(db, accountId);
}
