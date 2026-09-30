# Account identity: a passkey or Google, attached to an Account that is its own key

An optional backend (ADR-0007) needs an identity, and the repo has none: `CONTEXT.md` reserves the
word "user" against `Player`, and nothing in `src/` knows what an account is. We offer **two ways in
and one Account** — a **passkey** (WebAuthn, no password stored anywhere) and **Google Sign-In** —
where the **Account is its own primary key**, a server-generated opaque id, and each way in is an
**identity attached to that Account**. A passkey contributes a credential record; Google contributes
an issuer-and-subject pair. A **verified email is an attribute of the Account, used to find it and to
notify its owner, and never the key it is joined on.** Attaching a second way in is an explicit act
by an already-signed-in Organizer, not an inference from a matching address.

This corrects an earlier draft of this ADR that keyed Accounts on a verified email address. That
draft was wrong, and the primary sources say so: OpenID Connect Core §5.7 states that "the `sub`
(subject) and `iss` (issuer) Claims from the ID Token, used together, are the only Claims that an RP
can rely upon as a stable identifier for the End-User", and Google states of the `email` claim that
"the value of this claim may not be unique to this account and could change over time, therefore you
shouldn't use this value as the primary identifier to link to your user record." Automatic linking on
a matching address is the account-takeover pattern Google's own Firebase documentation warns about:
"If these two accounts were automatically linked, the malicious actor would gain access to the user's
account."

**Status**: accepted

**Considered Options**:

- **Account keyed on a verified email address** (an earlier draft, rejected — see above). Convenient,
  and it would make passkey and Google land on one Account with no linking UI, but it is contradicted
  by OIDC Core §5.7 and by Google's own guidance, and it makes a change of email address a loss of
  identity.
- **Passkey only, no email.** The strongest credential and the least data, but no recovery: WebAuthn
  §13.4.6 is explicit that "losing an authenticator therefore, in general, means losing all
  credentials bound to the lost authenticator, which could lock the user out of an account if the
  user has only one credential registered", and the spec defines no recovery protocol. It also cannot
  express "the same person as this Google account".
- **Google only.** Cheapest to build and nothing to verify, but it requires a Google account from
  every Organizer, and the audience is "casual sports organizers", not a workforce.
- **Email magic link only** (considered and dropped). No password and no third-party dependency, but
  every sign-in waits on a mail round trip, and on the profile's central device — a phone at a pitch —
  that is the slowest of the three.
- **A password.** Rejected: it stores a secret the server must defend, and gives a worse experience
  than a passkey for the same work.
- **An anonymous sync code** (no account at all). Rejected in ADR-0007: it cannot recover a lost
  device, which is the failure the feature exists to fix.
- **An opaque Account, with credentials and federated identities attached** (chosen).

**Consequences**:

- **There is no `email` column that means identity.** The Account holds a verified address as an
  attribute, which is how "sign in" finds an Account and how recovery notices are sent. Two Accounts
  may therefore share an address without being the same Account, which is correct and is the point.
- **Linking a second way in is an explicit, authenticated act.** An Organizer who registered with a
  passkey and later wants Google signs in first, then adds Google. There is no path where presenting a
  Google token merges into an existing Account because an address matched.
- **A passkey user is asked for an email, and the reason is honest.** WebAuthn's user handle is
  forbidden from carrying it (it "MUST NOT contain personally identifying information about the user,
  such as a username or e-mail address"), so an address must be collected in our own UI and verified
  out of band before it can be used for discovery or recovery. Without one, an Account whose only
  credential is a lost, unsynced passkey is unrecoverable — WebAuthn defines no recovery protocol, and
  §6.1.3 only says relying parties "SHOULD ensure that each user account has additional authenticators
  registered and/or an account recovery process in place."
- **The user handle is 64 random bytes, PII-free, and stable per Account.** The spec recommends exactly
  this ("It is RECOMMENDED to let the user handle be 64 random bytes, and store this value in the user
  account"), and it "ought to be the same for all credentials registered to the same user account".
- **The server stores a credential record per passkey, not per device.** A synced passkey arrives as
  the same credential id and public key from a new device, so signing in on a second device must not
  create a second record. Registration and authentication follow WebAuthn §7.2, using discoverable
  credentials (the user handle comes back) and an identifier-first path for the rest.
- **`signCount` is stored but never used to hard-fail.** The spec says a non-increasing counter "is a
  signal, but not proof" that the authenticator "may be cloned", and names races across devices as a
  cause. Failing closed would break legitimate users signing in from a second synced device.
- **The backup-eligibility and backup-state flags are stored per credential**, as §6.1.3 recommends,
  because they tell us whether a credential survives device loss — which is the whole reason this
  feature exists.
- **Use a maintained WebAuthn server library rather than hand-rolling the verification.** Google's own
  guidance: "While it's possible to implement server-side passkeys functionality from scratch, we
  recommend that you rely on a library instead", and the WebAuthn specification is "still subject to
  change". The library choice is part of this decision, not an implementation detail.
- **Google identity is `iss` + `sub`, and the address is not trusted.** `sub` is the documented unique
  key ("Only use the Google ID token's `sub` field as the unique identifier for the user"), `aud` and
  `iss` and `exp` are verified, and the signature is checked against Google's rotating keys. Google is
  authoritative for a `@gmail.com` address or one with `hd` set, and is **not** authoritative for a
  third-party domain: "ownership of the third party email account may have since changed." A federated
  address is therefore a claim, not a verified contact.
- **Identity binds to an origin, so one origin is canonical.** A credential registered against one host
  does not authenticate on another, and `workers.dev` is on the Public Suffix List's private section,
  so a `*.workers.dev` host and a custom domain can never share a passkey. `wrangler.jsonc` currently
  carries `"name": "comp3tive"` as a documented placeholder, and no production hostname is recorded
  anywhere in the repo.
- **Two origins are not reconciled by Related Origin Requests.** WebAuthn §5.11 offers a documented
  escape hatch (a `/.well-known/webauthn` document listing related origins under one RP ID), but it
  only helps clients that support it and the W3C Adoption CG's own guidance says "ROR is designed to be
  used when federation is *not* possible! It is recommended that Relying Parties first consider
  leveraging industry-standard federation protocols such as OpenID Connect." One canonical origin is
  the simpler answer, and it is the one taken.
- **`localhost` development and production never share credentials.** The spec permits `http` for
  localhost as an origin, but a credential scoped to `localhost` is unusable in production and vice
  versa; development accounts live in a development database and are never promoted.
- **Account recovery is the weakest link, and is treated as one.** Recovery through a verified email is
  strictly weaker than the passkey it restores. This is inherent to offering recovery at all — NIST
  SP 800-63B-4 §6.3 names it plainly: "The weak point in many authentication mechanisms is the process
  followed when a subscriber loses control of one or more authenticators", because recovery tends to
  fall back to "inexpensive and often less secure backup authentication methods". The alternative is an
  Account that dies with a device, which this ADR rejects because device loss is the failure the
  feature exists to fix. A recovery event notifies the Account's verified address, as NIST requires.
- **The Account owns its Communities** (ADR-0007): one Organizer may hold several. Claims that
  Community isolation is a product rule rather than a security boundary stop applying between
  Accounts.
- **A Guest never authenticates.** No sign-in wall, no credential, no server call, and an Organizer who
  never creates an Account is never asked to. Nothing in this decision changes the app for them.
