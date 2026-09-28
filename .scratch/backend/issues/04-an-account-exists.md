# 04: An Account exists, and the app knows who is signed in

**Status:** ready-for-agent

**What to build:** An Organizer can create an Account and sign in on the deployed site, and the app
knows whether it is signed in. No data moves yet — this ticket proves identity end to end, so the
riskier half (ticket 05) starts from a known-good session rather than from a guess.

**Status of the detail below:** the identity mechanism is decided in
`docs/adr/0008-account-identity.md`; the exact `rpId`/origin rules and the Google token-validation
steps are pinned by the research that ADR cites. This ticket implements that ADR; if the ADR's
research lands a correction, the ADR is the authority and this ticket follows it.

**Evidence.** Nothing in the app has any concept of a person: `grep -rniE 'account|login|signin|auth'
src/` returns nothing about an identity, `package.json` has no auth dependency, and the repo contains
no `.env` file while `.gitignore:16-19` already ignores `.env`/`.env.*`/`.dev.vars*` for "Local secrets
and deploy state". CI has no deploy step and `wrangler.jsonc` has no `main` script, so this ticket
introduces the repo's first runtime secret, its first environment read, and its first server.

**What to build, exactly.**

1. **Settle the production origin first.** `wrangler.jsonc:14` carries `"name": "comp3tive"` as a
   documented placeholder; `.scratch/landing-page/issues/05:56-60` records that deploying with it
   unchanged "creates a second Worker rather than updating the live one". Identity binds to an origin,
   so the real hostname and a canonical custom domain are recorded in `wrangler.jsonc` (and in the
   ADR's consequences) before any credential is registered. `workers.dev` is not the canonical origin.

2. **A `server/` deployable in this repository**, importing domain types from `src/domain/types.ts`
   rather than copying them. It exposes `/api/*` — the path ADR-0006 reserved and nothing has claimed
   (`wrangler.jsonc:13`, `docs/adr/0006-landing-page-and-app-paths.md:21`). The static-assets
   behavior of the existing Worker is unchanged: `assets.directory: "./dist"` and
   `not_found_handling: "404-page"` stay exactly as they are, and `/api/*` must still not be answered
   by a static file — which is no longer automatic, see the next item.

   This is the repo's first Worker script. `wrangler.jsonc:3` currently states there is "no Worker
   script and no `main`", and that comment becomes false here and must be corrected in the same
   change rather than left as a stale invariant.

3. **`assets.run_worker_first` is set, and it is not optional.** `wrangler.jsonc:15` sets
   `compatibility_date: "2026-09-14"`, which is past the 2025-04-01 threshold where a navigation
   request does **not** invoke the Worker script even when the path matches. The documented
   consequence is exactly the confusing half-failure this ticket would otherwise ship: a client-side
   `fetch("/api/session")` reaches the Worker, while a browser navigating to that path is served the
   assets fallback. Configure `assets.run_worker_first` with `["/api/*"]` so the API paths are
   exempted, and verify by navigating to an API path in a browser rather than only by calling it from
   the app.

4. **Registration and sign-in, per `docs/adr/0008-account-identity.md`.** Passkey (WebAuthn) and
   Google are both offered. The **Account is its own opaque key**; a passkey contributes a credential
   record, Google contributes an issuer-and-subject pair, and a verified email is an attribute used to
   find an Account and to notify its owner, **never** the value two identities are joined on.
   Attaching a second way in is an explicit act by a signed-in Organizer. The server stores
   credentials, never a password, and uses a maintained WebAuthn library rather than hand-rolling the
   verification.
5. **The app shows who is signed in and offers sign-in and sign-out.** A minimal surface is enough;
   the Dashboard is the natural home (`src/DashboardScreen.tsx`), and this ticket adds no data
   movement. Sign-in and sign-out are reachable without navigating away from where the Organizer
   already is.

6. **A single session module owns the client half.** One module holds the current session, the token,
   and the three operations (sign in, sign out, refresh), and every other caller asks it. This is the
   boundary ticket 05 and ticket 06 build on, and the boundary that answers "may this write reach the
   network" — a question that must have exactly one answer, not one per call site.

7. **The guest path is untouched.** A Guest is never shown a sign-in wall, is never asked to create an
   Account to use a feature, and sees the app exactly as it is today. `PRODUCT.md`'s "no dead ends"
   rule and the trust list's promise both depend on this, and the existing e2e suite is the regression
   test for it.

8. **Secrets and environment.** The client reads one new variable for the API base through Vite's
   `import.meta.env` — the repo's first such read — with a documented default that works in
   development. Server secrets are configured through `wrangler` and never committed; `.gitignore`
   already covers the files. Add `.env.example` so the convention is discoverable rather than folklore.

**Acceptance criteria:**
- [ ] `grep -rn 'import.meta.env' src/` returns exactly the API-base read, and no other environment
      value is read in client code
- [ ] `.env.example` exists and `.env` / `.dev.vars` remain untracked — `git check-ignore` resolves
      both
- [ ] `wrangler.jsonc` carries the real Worker name and the canonical origin, and a comment records
      why the name is not a placeholder any more
- [ ] `wrangler.jsonc` carries `assets.run_worker_first` covering `/api/*`, and the "no Worker script
      and no `main`" comment at `wrangler.jsonc:3` is corrected rather than left stale
- [ ] Navigating a browser directly to an API path reaches the API (not the assets fallback), proving
      the config works for navigation as well as for `fetch()`
- [ ] `not_found_handling: "404-page"` is unchanged, so `public/404.html` still answers unmatched paths
      and the Landing Page is still not served under `/app/`
- [ ] A new Account can be created and signed into on a deployed preview, by passkey and by Google;
      signing in with Google for an Account that has never attached Google creates a **separate**
      Account rather than silently merging on a matching address, and attaching Google to an existing
      Account is an explicit act from inside the signed-in session
- [ ] A second sign-in from another device with a **synced** passkey reuses the existing credential
      record rather than inserting a second one — asserted by counting credential rows across two
      sign-ins
- [ ] A non-increasing `signCount` does not fail authentication: the counter is stored and updated,
      and a test drives a lower value through and expects success, so a synced passkey used from two
      devices is not locked out
- [ ] The Account's user handle is 64 random bytes and contains no email, name or other personal data
      (`CONTEXT.md` calls the person an Organizer; the handle is not the person)
- [ ] A passkey registered on `localhost` cannot authenticate against the deployed origin, and the
      reverse also holds — asserted by attempting a cross-origin sign-in and expecting failure
- [ ] Sign-out returns the app to the guest experience with no residual signed-in UI
- [ ] Nothing is gated: a fresh browser with no Account reaches the split flow in the same number of
      steps as today, and `npm run e2e` is green **unchanged**
- [ ] The client never sends a request when signed out — asserted by a test that signs out, performs a
      mutation, and observes no request
- [ ] `npx tsc -b` exits 0 and `npx vitest run` exits 0

**Blocked by:** 03 — the repository must stop promising there is no account before it offers one.

**Notes:** Do not build sync here. The temptation to "finish the feature" in this ticket is exactly
the risk ADR-0007's sequencing exists to avoid: identity and data movement fail in different ways, and
a session that is wrong makes every later bug look like a sync bug. Do not add a router (ADR-0004,
ADR-0006), and do not add an auth dependency to the client bundle if a thinner path exists — the
Landing Page deliberately ships no framework and the app's only runtime dependencies are React and
ReactDOM.
