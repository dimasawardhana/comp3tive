# 06: Reconcile the docs that contradict the code

**What to build:** The repo's own documentation brought back in line with the shipped app, so that human readers and agent context stop being misled. Several files describe a product that no longer exists, and `docs/agents/*` points agents at them.

Verified contradictions:

| Document | Claim | Reality |
|---|---|---|
| `docs/FLOW.md` §1 | "Four bottom-nav hubs" (Roster/Tournaments/History/Squads); the file declares itself "the contract. The app must conform to it." | Five hubs with **Home** centered; the tournaments hub is labelled **Games** (`src/App.tsx:62-68`) |
| `docs/adr/0004` | "`docs/FLOW.md` is the contract and the edge table there must stay in sync with the code" | FLOW.md predates ADR-0005 and was never updated |
| `docs/FLOW.md` §3 | "Breadcrumbs are links — every crumb above the current screen navigates there" | No screen renders the shared `Breadcrumb` (`src/nav.tsx` is unused); `SplitScreen`'s crumb is a dead `<a href="#">` (`src/session/SplitScreen.tsx:294`) |
| `docs/spec/0002` | DB v5, backup v3, per-match `seriesLength`, `nextMatchId` | DB **v6**, backup **v4**; `seriesLength` is tournament-level; routing uses `winnerNext`/`loserNext` |
| `docs/spec/0002`, `DOMAIN_MODEL.md` | `TournamentTeam.players: [{playerId, roleId}]` — roles captured in the snapshot | `TournamentTeam.players: Id[]` (`src/domain/types.ts:36`) — roles are not snapshotted |
| `docs/adr/0002` | Status `proposed` | The feature shipped and is a primary hub |
| `DOMAIN_MODEL.md` | Describes a Session/Tournament gap and a 4-week plan to close it | Sessions are implemented; every phase shipped |
| `IMPLEMENTATION_PLAN.md` | Week-by-week plan for unbuilt tournament work | All four phases describe shipped behaviour |
| `docs/superpowers/plans/2026-09-10-paper-pencil-redesign.md` | "Tech Stack: TypeScript, React, Tailwind CSS, Vite" | No Tailwind anywhere in the repo |

- Fix the factual drifts above. Keep each document's existing shape; do not rewrite them into specs.
- `docs/FLOW.md` is the one that matters most — it is normative and read as a contract. It also needs the entry row noting the app is entered at `/app` (ADR-0006).
- Decide the fate of the two root planning artifacts explicitly: `DOMAIN_MODEL.md` and `IMPLEMENTATION_PLAN.md` are generated planning documents whose work has shipped. Either mark them `Superseded`, move them under `docs/archive/`, or delete them. `CONTEXT.md` is the live vocabulary and is *not* one of these.
- Leave `CONTEXT.md` alone except for the Landing Page/Home/Dashboard terms already updated.

**Blocked by:** —

**Status:** open

- [ ] `docs/FLOW.md` describes five hubs including Home, and states the app's entry path
- [ ] `docs/spec/0002`'s Data Model matches `src/domain/types.ts` (DB v6, backup v4, tournament-level `seriesLength`, `winnerNext`/`loserNext`)
- [ ] `docs/adr/0002` has a status reflecting reality
- [ ] `DOMAIN_MODEL.md` and `IMPLEMENTATION_PLAN.md` are archived, marked superseded, or deleted — not left as authoritative-looking plans
- [ ] The Tailwind claim in the paper-pencil plan is corrected
- [ ] No remaining statement in `docs/` or the root markdown contradicts the code on a fact a reader would act on

**Design reference:** none.

**Notes:** This is not cosmetic in this repo: `CLAUDE.md` and `docs/agents/domain.md` direct agents to read `CONTEXT.md` and `docs/adr/` before exploring, so stale ADRs and specs propagate into implementation work. A wrong "DB v5" is likely to be believed over the code.
