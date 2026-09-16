# Product Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the organizer's evening: the teams leave the screen (as text and as a branded image), the app opens with no signal, the data has a durability story, a 3- or 5-team night can run a tournament, and the roster stops being one player at a time.

**Architecture:** Phase D is the last of four phases. Phases A (green suite), B (honest claims) and C (decomposed shell) have landed before it; D's UI work targets `src/shell/` files that only exist after C. Each ticket is a small, independently testable unit: two pure modules in a new `src/share/` (`teamsAsText`, `explainFairness`, plus a canvas poster whose layout is pure), one PWA surface (manifest + self-hosted fonts + a versioned classic service worker), one hook (`useDurability`) and its UI, one pure scheduler (`roundRobinSchedule`) wired into the existing bracket engine, and roster fast-entry UI that renders what Phase A's CSV parser returns. Nothing in this phase changes the solver.

**Tech Stack:** React 19, TypeScript 5.8, Vite 6 (`appType: "mpa"`, two documents), Vitest 3 (node environment, `src/**/*.test.ts` only), Playwright 1.62 (chromium, `workers: 1`), IndexedDB via `fake-indexeddb`, no runtime dependencies beyond `react` and `react-dom`.

**Spec:** `docs/superpowers/specs/2026-09-17-product-completion-design.md`

## Global Constraints

Copied verbatim from the spec. Every task's requirements implicitly include this section.

- **This phase runs last.** `contracts.md` fixes the order **A before C, C before D**. D's UI work targets files that only exist after C: `src/shell/RosterScreen.tsx`, `src/shell/usePlayerImport.ts`, `src/shell/useSplitFlow.ts`, `src/shell/useToasts.ts`, `src/ui/Modal.tsx`, `src/ui/constants.ts`, `src/shell/useCommunityScope.ts`. If any of those is missing, **stop**: a prerequisite phase has not landed.
- **Zero new runtime dependencies.** `package.json` `dependencies` is `{"react": "^19.1.0", "react-dom": "^19.1.0"}` and stays that way (ADR-0001). The poster is hand-drawn to `<canvas>`; no DOM-to-image library. Reversing that decision requires an ADR.
- **Unit tests only collect `.ts`.** `vite.config.ts` sets `test.include: ["src/**/*.test.ts"]`, so extracted hooks and pure modules must be `.ts`, not `.tsx`, to be unit-testable. This is a design constraint, not a preference.
- **Test environment is `node`.** `vite.config.ts` sets `test.environment: "node"`. There is no `jsdom`, no `happy-dom` and no `@testing-library/*` in `node_modules`, and this plan adds none. Unit tests therefore cover pure functions and hook shape via `renderToStaticMarkup`; anything needing a real layout is proven by a Playwright spec.
- **E2E paths are relative to `e2e/`.** `e2e/playwright.config.ts` sets `testDir: "./tests"`, so an e2e command is `npx playwright test --config=e2e/playwright.config.ts tests/<group>/<file>.spec.ts`. A bare `e2e/tests/...` argument finds NO tests.
- **Always rebuild before trusting an e2e run.** The config sets `reuseExistingServer: true` and `webServer.command: "npm run preview"`, which serves `dist/`. Run `npx vite build` first.
- **Brand tokens, exact values.** paper `#FAF8F5`, elevated surface `#FFFFFF`, ink `#1C1917`, slate `#57534E`, amber `#C2410C`, hairline `#E7E3DC`, dark-mode deep ink `#23201C`, dark amber `#EA580C`, bibs `--bib-a #FFC400`, `--bib-b #FF4F9A`, `--bib-c #4E8FDB`, `--bib-d #6FAF8E`, `--bib-e #C9A227`. Display face **Outfit**, body face **Familjen Grotesk**; both family names stay byte-identical.
- **No em-dash in on-screen UI copy** (`docs/design.md:72`, "A zero-tolerance rule"). The one exception is D31's clipboard text, whose exact closing lines the spec states with an em-dash: it is content pasted into a chat, not UI Chrome.
- **No native dialogs.** No `alert`, no `window.confirm` in anything this phase adds. The app's inline vocabulary and `notify` are the mechanisms.
- **The Swiss and single-elim arms are frozen.** All existing `src/tournament/bracket.test.ts` assertions stay green with no spec edited. New coverage is additive.
- **The four shapes are frozen** (`contracts.md`): `hubButton(page, name)` from `e2e/support/seed.ts`; `gapKind`/`gapQualifier` from `src/session/gapProvenance.ts`; `parsePlayerCsv`/`ImportSkip` from `src/data/player-import.ts`; `FORMAT_LABEL` from `src/ui/constants.ts`. D consumes them and adds no duplicate.
- **`notify` is a prop, not a context.** `useToasts()` is called once, in `src/App.tsx`; C does not add a `ToastProvider`, and `src/` contains no `createContext`. Anything that needs a toast takes `notify` as a prop.
- **Copy strings are exact.** Where a step gives a string in backticks, that string is the deliverable; do not paraphrase it.

## File Map

| Action | File | Responsibility |
|---|---|---|
| Create | `src/share/share-text.ts` | Pure: the finished teams as the exact text a group chat can read |
| Create | `src/share/share-text.test.ts` | Asserts the whole produced string, both provenance cases, the unassigned line |
| Create | `src/share/share-image.ts` | Pure `layoutShareImage` returning `DrawOp[]`, plus `renderShareImage` replaying them to a PNG Blob |
| Create | `src/share/share-image.test.ts` | Asserts width, 8px-rounded height, brand hexes, bib order, type floor, determinism |
| Create | `src/share/ShareSheet.tsx` | The share modal: read-only preview, `Copy text`, `Copy image`/`Download image`, `.share-status` |
| Create | `src/share/fairness.ts` | Pure `explainFairness`: why the split is fair, in words, with no provenance word |
| Create | `src/share/fairness.test.ts` | Asserts both copy forms, capability-less exclusion, the empty case, the banned-substring rule |
| Create | `src/data/round-robin.ts` | Pure `roundRobinSchedule(n)`, circle method, pairing team indices |
| Create | `src/data/round-robin.test.ts` | Exhaustive n = 3..8 scheduling invariants |
| Create | `src/data/csv-template.ts` | `CSV_TEMPLATE`, tied to A08's parser by a test |
| Create | `src/data/csv-template.test.ts` | Runs A08's `parsePlayerCsv` over the template |
| Create | `src/shell/useDurability.ts` | `persist()` once, `tb-last-export`, `tb-export-nudge-dismissed`, `shouldNudge` |
| Create | `src/shell/useDurability.test.ts` | Shape and the no-`navigator.storage` path |
| Create | `src/roster/BulkRateModal.tsx` | One rating per attribute, written through `validatePlayer` |
| Create | `src/fonts.css` | Four `@font-face` rules, two per family |
| Create | `public/fonts/*.woff2` (4), `public/fonts/OFL.txt` | Self-hosted variable subsets plus the licence |
| Create | `public/manifest.webmanifest` | Install metadata for both documents |
| Create | `public/sw.js` | Classic versioned service worker with two build-time placeholders |
| Create | `public/icons/{icon-192,icon-512,maskable-512}.png` | Install icons from `brand/3-icon.svg` |
| Create | `scripts/make-icons.mjs` | Regenerates the icons deterministically, refusing a fallback glyph |
| Create | `e2e/tests/share/share.spec.ts` | Clipboard text, clipboard image, both fallbacks |
| Create | `e2e/tests/split/fairness.spec.ts` | `.fairness` renders and carries no banned substring |
| Create | `e2e/tests/tournament/round-robin.spec.ts` | A 3-team round robin runs to a champion |
| Create | `e2e/tests/pwa/offline.spec.ts` | Both documents offline, no third-party host, stale-deploy purge |
| Create | `e2e/tests/roster/fast-entry.spec.ts` | Template download, partial-import report, bulk rating |
| Modify | `src/session/SplitScreen.tsx` | Additive only: the `share?` prop + `Share` button in `.split-bar`, the `.fairness` line at both readouts |
| Modify | `src/main.tsx` | Additive: SW registration on `load`, after A05's boundary |
| Modify | `src/tokens.css` | One `@import "./fonts.css";` line |
| Modify | `src/index.html`, `app/index.html`, `public/404.html` | Font preloads, manifest, icons, the restored offline claim |
| Modify | `public/_headers` | Four added rules; the three existing ones byte-identical |
| Modify | `src/domain/types.ts` | `TournamentFormat` gains `"round-robin"` |
| Modify | `src/ui/constants.ts` | `FORMAT_LABEL` gains the `"round-robin"` key |
| Modify | `src/tournament/tournament-validation.ts` | `getValidTeamCounts` gains the round-robin arm |
| Modify | `src/tournament/bracket.ts` | Round-robin arms in `buildBracket` and `roundsFor`; `champion()` accepts round robin |
| Modify | `src/tournament/bracket.test.ts` | New round-robin `describe` blocks; no existing assertion changed |
| Modify | `src/tournament/GamesScreen.tsx` | Counts, chips, hint, preview, prefill |
| Modify | `src/tournament/TournamentScreen.tsx` | The standings branch at `:359` |
| Modify | `src/shell/useSplitFlow.ts` | `consumeTeams` gains the round-robin guard |
| Modify | `src/shell/RosterScreen.tsx` | Import report, template button, column hint, `Rate selected`, durability note, `notify` prop |
| Modify | `src/App.tsx` | Pass `share` to `SplitScreen`; `notify` to `RosterScreen`; `recordExport` in `handleExport`; the durability nudge props |
| Modify | `src/DashboardScreen.tsx` | The `.nudge` row between the stat cards and the teasers |
| Modify | `vite.config.ts` | One added `plugins[]` entry writing the version and precache list into `dist/sw.js` |
| Modify | `e2e/tests/landing/landing.spec.ts` | D33 restores the offline trust assertion |
| Modify | `package.json` | `capture:hero` stays; no dependency added |

---

### Task 1: The teams as shareable text

**Files:**
- Create: `src/share/share-text.ts`
- Test: `src/share/share-text.test.ts`

**Interfaces:**
- Consumes: `gapKind(result: SplitResult): GapKind` from `src/session/gapProvenance.ts` (B13); `strengthOf(player, discipline): number | null` and `teamName(index): string` from `src/session/flow.ts` (`:10`, `:16`).
- Produces: `teamsAsText(input: ShareTextInput): string` and the exported `interface ShareTextInput { communityName: string; disciplineName: string; discipline: Discipline; result: SplitResult; roster: Player[] }`. Task 2 and Task 4 call it.

- [ ] **Step 1: Write the failing test**

Create `src/share/share-text.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { teamsAsText } from "./share-text";
import { FUTSAL_DISCIPLINE } from "../domain/seed";
import type { Player, SplitResult } from "../domain/types";

const cap = (technical: number, fitness: number, gameIq: number) => ({
  disciplineId: "futsal",
  attributeRatings: { technical, fitness, "game-iq": gameIq },
  eligibleRoles: ["goalkeeper", "defender", "winger", "pivot"],
  preferredRole: null,
});

const player = (id: string, name: string, ratings?: [number, number, number]): Player => ({
  id,
  communityId: "c1",
  name,
  capabilities: ratings ? [cap(...ratings)] : [],
});

const ROSTER: Player[] = [
  player("p1", "Andi", [5, 4, 4]),
  player("p2", "Budi", [3, 4, 4]),
  player("p3", "Citra", [4, 4, 4]),
  player("p4", "Dewi"),
];

const result = (optimal: boolean, unassigned: string[] = []): SplitResult => ({
  teams: [
    { index: 0, slots: [{ playerId: "p2", roleId: null }, { playerId: "p1", roleId: null }], totalStrength: 8.4, avgStrength: 4.2 },
    { index: 1, slots: [{ playerId: "p4", roleId: null }, { playerId: "p3", roleId: null }], totalStrength: 7.6, avgStrength: 3.8 },
  ],
  gap: 0.4,
  flags: [],
  unassigned,
  solver: { optimal, nodesExplored: optimal ? 51 : 4_000_001, elapsedMs: 7 },
});

const input = (optimal: boolean, unassigned: string[] = []) => ({
  communityName: "Thursday Crew",
  disciplineName: "Futsal",
  discipline: FUTSAL_DISCIPLINE,
  result: result(optimal, unassigned),
  roster: ROSTER,
});

describe("teamsAsText", () => {
  it("renders the proven case with the headline, one block per team and the proven closing line", () => {
    expect(teamsAsText(input(true))).toBe(
      [
        "Futsal · Thursday Crew — 2 teams",
        "",
        "Team A · avg 4.2",
        "• Andi (4.3)",
        "• Budi (3.7)",
        "",
        "Team B · avg 3.8",
        "• Citra (4.0)",
        "• Dewi",
        "",
        "Gap 0.4 — the proven minimum for this pool.",
      ].join("\n"),
    );
  });

  it("states the best-found verdict in full, because a chat message has no surrounding sentence", () => {
    expect(teamsAsText(input(false))).toContain(
      "Gap 0.4 — the smallest gap found. The search ended before proving it minimal.",
    );
  });

  it("appends the not-playing line only when someone is unassigned", () => {
    expect(teamsAsText(input(true))).not.toContain("Not playing:");
    expect(teamsAsText(input(true, ["p1", "p3"]))).toContain("Not playing: Andi, Citra");
  });

  it("lists a player without a capability in the discipline last, with no parenthesis", () => {
    // Dewi has no futsal capability, so her line is bare and it is the last in her block.
    const block = teamsAsText(input(true)).split("Team B · avg 3.8\n")[1];
    expect(block.split("\n")[0]).toBe("\u2022 Citra (4.0)");
    expect(block.split("\n")[1]).toBe("\u2022 Dewi");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/share/share-text.test.ts`
Expected: FAIL — `Failed to resolve import "./share-text"`.

- [ ] **Step 3: Write the implementation**

Create `src/share/share-text.ts`:

```ts
import type { Discipline, Id, Player, SplitResult, TeamSlot } from "../domain/types";
import { gapKind } from "../session/gapProvenance";
import { strengthOf, teamName } from "../session/flow";

export interface ShareTextInput {
  communityName: string;
  disciplineName: string;
  discipline: Discipline;
  result: SplitResult;
  roster: Player[];
}

/** Strongest first; a player with no capability in this discipline sorts last. */
function orderedSlots(slots: TeamSlot[], roster: Player[], discipline: Discipline) {
  return slots
    .map((slot, position) => ({ slot, position, player: roster.find((p) => p.id === slot.playerId) }))
    .filter((x): x is typeof x & { player: Player } => x.player !== undefined)
    .sort((a, b) => {
      const sa = strengthOf(a.player, discipline);
      const sb = strengthOf(b.player, discipline);
      if (sa === null && sb === null) return a.position - b.position;
      if (sa === null) return 1;
      if (sb === null) return -1;
      return sb - sa || a.position - b.position;
    });
}

/**
 * The verdict, stated in both cases. A chat message has no surrounding sentence to
 * carry it, so this branches on `gapKind`, never on `gapQualifier() !== null`: the
 * qualifier is append-only and returns null when the gap is proven.
 */
function closingLine(result: SplitResult): string {
  const gap = result.gap.toFixed(1);
  return gapKind(result) === "proven"
    ? `Gap ${gap} — the proven minimum for this pool.`
    : `Gap ${gap} — the smallest gap found. The search ended before proving it minimal.`;
}

export function teamsAsText(input: ShareTextInput): string {
  const { communityName, disciplineName, discipline, result, roster } = input;
  const nameOf = (id: Id): string => roster.find((p) => p.id === id)?.name ?? "?";

  const blocks = result.teams.map((team) => {
    const lines = orderedSlots(team.slots, roster, discipline).map(({ player }) => {
      const strength = strengthOf(player, discipline);
      return strength === null ? `• ${player.name}` : `• ${player.name} (${strength.toFixed(1)})`;
    });
    return [`${teamName(team.index)} · avg ${team.avgStrength.toFixed(1)}`, ...lines].join("\n");
  });

  const parts = [
    `${disciplineName} · ${communityName} — ${result.teams.length} teams`,
    blocks.join("\n\n"),
    closingLine(result),
  ];
  if (result.unassigned.length > 0) {
    parts.push(`Not playing: ${result.unassigned.map(nameOf).join(", ")}`);
  }
  return parts.join("\n\n");
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/share/share-text.test.ts`
Expected: PASS — 4 passed.

- [ ] **Step 5: Type-check**

Run: `npx tsc -b`
Expected: exit 0, no output.

- [ ] **Step 6: Commit**

```bash
git add src/share/share-text.ts src/share/share-text.test.ts
git commit -m "feat(share): render the finished teams as text with a true provenance line"
```

---

### Task 2: The share sheet, and the entry point on the split screen

**Files:**
- Create: `src/share/ShareSheet.tsx`
- Modify: `src/session/SplitScreen.tsx:12-26` (the `Props` interface), `:80` region (imports), `:372-407` (the `.split-bar`)
- Modify: `src/App.tsx:1177-1201` (the `<SplitScreen …>` mount)
- Test: `e2e/tests/share/share.spec.ts`

**Interfaces:**
- Consumes: `teamsAsText(input)` from Task 1; `Modal` from `src/ui/Modal.tsx` (C23) with props `{ onClose: () => void; children: ReactNode }`; `hubButton`/`gotoSeeded`/`seedScript`/`SeedWorld` from `e2e/support/seed.ts` (A01/A11).
- Produces: `SplitScreen` gains the optional prop `share?: { communityName: string }`; `SplitScreenProps.share` is what Task 5's render sites sit beside. `ShareSheet` gains the optional prop `imageControl?: ReactNode`, which Task 4 fills.

- [ ] **Step 1: Write the failing e2e spec**

Create `e2e/tests/share/share.spec.ts`. This asserts the exact produced string, including the provenance clause.

```ts
/**
 * The share surface: the teams as text, onto the clipboard.
 *
 * Clipboard reads need an explicit grant, and the grant is per browser context —
 * `test.use` puts it on the context the spec runs in.
 */
import { test, expect } from "@playwright/test";
import { gotoHubSeeded, hubButton, type SeedWorld } from "../../support/seed";

test.use({ permissions: ["clipboard-read", "clipboard-write"] });

const MLBB_ATTRS = { mechanics: 4, "game-sense": 4, "hero-pool": 4, teamwork: 4 };
const ROLES = ["tank", "assassin", "mage", "marksman", "fighter"];

/** Ten MLBB players, two per role, so a 2-team split is available and deterministic. */
const world = (): SeedWorld => ({
  communities: [{ id: "comm-share", name: "Thursday Crew", createdAt: 100 }],
  players: ["Andi", "Budi", "Citra", "Dewi", "Eka", "Fajar", "Gita", "Hana", "Irfan", "Joko"].map((name, i) => ({
    id: `p${i + 1}`,
    communityId: "comm-share",
    name,
    capabilities: [{ disciplineId: "mlbb", attributeRatings: MLBB_ATTRS, eligibleRoles: ROLES, preferredRole: ROLES[i % 5] }],
  })),
  sessions: [],
  tournaments: [],
  squads: [],
  activeCommunityId: "comm-share",
});

/** Roster → Split match → Split 2 teams, landing on the split screen. */
async function splitTwoTeams(page: import("@playwright/test").Page) {
  await gotoHubSeeded(page, world(), "Roster");
  await page.getByRole("button", { name: "Split match" }).click();
  await expect(page.locator(".match-setup")).toBeVisible({ timeout: 10000 });
  await page.getByTestId("split-button").click();
  await expect(page.locator(".split-screen")).toBeVisible({ timeout: 15000 });
}

test("copies the finished teams to the clipboard as text, provenance included", async ({ page }) => {
  await splitTwoTeams(page);

  await expect(page.getByTestId("share-teams")).toBeVisible();
  await page.getByTestId("share-teams").click();

  const sheet = page.locator(".modal-card");
  await expect(sheet).toBeVisible();
  const preview = sheet.locator("textarea.share-preview");
  // The sheet shows the text before it is copied, so the organizer sees what they send.
  await expect(preview).toHaveValue(/^Mobile Legends · Thursday Crew — 2 teams\n/);

  await sheet.getByTestId("share-copy-text").click();
  await expect(sheet.locator(".share-status")).toHaveText("Copied.");

  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied.startsWith("Mobile Legends · Thursday Crew — 2 teams\n")).toBe(true);
  for (const name of ["Andi", "Budi", "Citra", "Dewi", "Eka", "Fajar", "Gita", "Hana", "Irfan", "Joko"]) {
    expect(copied).toContain(name);
  }
  // The verdict is stated in full: a chat message has no surrounding sentence.
  expect(copied).toMatch(/Gap \d\.\d — (the proven minimum for this pool\.|the smallest gap found\. The search ended before proving it minimal\.)/);
  // The same string the sheet is showing, byte for byte.
  expect(copied).toBe(await preview.inputValue());
});

test("keeps the text and says so when the clipboard API is unavailable", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, "clipboard", { get: () => undefined, configurable: true });
  });
  await splitTwoTeams(page);

  await page.getByTestId("share-teams").click();
  const sheet = page.locator(".modal-card");
  await sheet.getByTestId("share-copy-text").click();

  await expect(sheet.locator(".share-status")).toHaveText("Copy failed. Select the text above and copy it.");
  // The text is never lost, and it is left selected for a manual copy.
  const preview = sheet.locator("textarea.share-preview");
  await expect(preview).toHaveValue(/Thursday Crew/);
  const selection = await preview.evaluate((el) => {
    const t = el as HTMLTextAreaElement;
    return { start: t.selectionStart, end: t.selectionEnd, len: t.value.length };
  });
  expect(selection.end - selection.start).toBe(selection.len);
});

test("the landing hero gains no share control", async ({ page }) => {
  // landing.spec.ts:38 asserts the hero renders the split screen; the split
  // screen must still render there WITHOUT the share affordance, which is why
  // the prop is optional and src/landing.tsx:151-161 does not pass it.
  await page.goto("/");
  await expect(page.locator("#landing-hero .split-screen")).toBeVisible();
  await expect(page.locator("#landing-hero").getByTestId("share-teams")).toHaveCount(0);
});
```

- [ ] **Step 2: Run the spec to verify it fails**

Run:
```bash
npx vite build && npx playwright test --config=e2e/playwright.config.ts tests/share/share.spec.ts
```
Expected: FAIL — `expect(locator).toBeVisible()` on `getByTestId('share-teams')`, which resolves to 0 elements.

- [ ] **Step 3: Write the share sheet**

Create `src/share/ShareSheet.tsx`:

```tsx
import { useRef, useState, type ReactNode } from "react";
import type { Discipline, Player, SplitResult } from "../domain/types";
import { Modal } from "../ui/Modal";
import { teamsAsText } from "./share-text";

interface Props {
  communityName: string;
  disciplineName: string;
  discipline: Discipline;
  result: SplitResult;
  roster: Player[];
  onClose: () => void;
  /** D32's image action. Absent until that task lands, so this file stands alone. */
  imageControl?: ReactNode;
}

export function ShareSheet({ communityName, disciplineName, discipline, result, roster, onClose, imageControl }: Props) {
  const text = teamsAsText({ communityName, disciplineName, discipline, result, roster });
  const [status, setStatus] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const previewRef = useRef<HTMLTextAreaElement>(null);

  const selectAll = () => {
    const el = previewRef.current;
    if (!el) return;
    el.focus();
    el.select();
  };

  const copyText = async () => {
    // No alert, and no losing the text: the preview is the fallback.
    if (!navigator.clipboard?.writeText) {
      setStatus("Copy failed. Select the text above and copy it.");
      selectAll();
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setStatus("Copied.");
    } catch {
      setStatus("Copy failed. Select the text above and copy it.");
      selectAll();
    }
  };

  return (
    <Modal onClose={onClose}>
      <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>
        &times;
      </button>
      <h1 className="modal-title">Share the teams</h1>
      <div className="modal-section">
        <textarea className="share-preview" readOnly value={text} ref={previewRef} rows={14} aria-label="Team list" />
      </div>
      <p className="share-status" role="status">{status}</p>
      <div className="bar">
        <button type="button" className="btn btn-primary" data-testid="share-copy-text" onClick={() => void copyText()}>
          {copied ? "Copied" : "Copy text"}
        </button>
        {imageControl}
      </div>
    </Modal>
  );
}
```

- [ ] **Step 4: Add the share button to the split screen, additively**

In `src/session/SplitScreen.tsx`, add to the `Props` interface (the block ending at `:26`):

```tsx
  /** Present only where sharing makes sense: the app, never the landing hero. */
  share?: { communityName: string };
```

Add to the destructured parameter list in the `SplitScreen` signature (the line beginning `export function SplitScreen({ session, discipline, roster,` at `:186`):

```tsx
  share,
```

Add the import beside the existing sibling imports (after the `freshSplit, swapPlayers` import at `:5`):

```tsx
import { ShareSheet } from "../share/ShareSheet";
```

Add the state beside the existing `saveOpen` state (`:205`):

```tsx
  const [shareOpen, setShareOpen] = useState(false);
```

Add the button inside `.split-bar` (`:372`), after the submit-tournament/Re-roll block and before the closing `</div>` at `:407`. It sits in every non-swapping state so sharing is always reachable, and renders only when the prop is present:

```tsx
        {share && !swapMode && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setShareOpen(true)}
            data-testid="share-teams"
          >
            Share
          </button>
        )}
```

Add the sheet beside the existing `SaveSquadModal` mount (after the block ending at `:417`):

```tsx
      {shareOpen && share && (
        <ShareSheet
          communityName={share.communityName}
          disciplineName={discipline.name}
          discipline={discipline}
          result={result}
          roster={roster}
          onClose={() => setShareOpen(false)}
        />
      )}
```

**Every existing line in `SplitScreen.tsx` stays byte-identical.** A and B both landed before D (`contracts.md`: A before C, C before D), so this is an append to a quiescent file. Verify with the diff in Step 7.

- [ ] **Step 5: Pass the prop from `src/App.tsx`**

In `src/App.tsx`, inside the `<SplitScreen …>` mount at `:1178`, add one prop after `source={view.source}`:

```tsx
          share={{ communityName: activeCommunity?.name ?? "" }}
```

`src/landing.tsx:151-161` is **not** touched. It passes no `share` prop, so the hero renders the split screen with no share control — which is what the third spec asserts and what `e2e/tests/landing/landing.spec.ts:31-38` and `:157-164` require.

- [ ] **Step 6: Run the spec to verify it passes**

Run:
```bash
npx vite build && npx playwright test --config=e2e/playwright.config.ts tests/share/share.spec.ts
```
Expected: PASS — 3 passed. (The two image specs from Task 4 are added to this file later; this run covers 3.)

- [ ] **Step 7: Prove the `SplitScreen.tsx` edit is additive**

Run:
```bash
git diff --stat src/session/SplitScreen.tsx
git diff -U0 src/session/SplitScreen.tsx | grep -E "^-[^-]" | grep -v "^---"
```
Expected: the second command prints **nothing** — no removed lines. Only `+` lines.

- [ ] **Step 8: Type-check, then commit**

Run: `npx tsc -b`
Expected: exit 0.

```bash
git add src/share/ShareSheet.tsx src/session/SplitScreen.tsx src/App.tsx e2e/tests/share/share.spec.ts
git commit -m "feat(share): a share sheet with the teams as copyable text"
```

---

### Task 3: The branded poster, as pure layout

**Files:**
- Create: `src/share/share-image.ts`
- Test: `src/share/share-image.test.ts`

**Interfaces:**
- Consumes: `capabilityFor(player, discipline): Capability | undefined` from `src/session/flow.ts` (`:5`).
- Produces: `type DrawOp` (discriminated union `rect` / `roundRect` / `text`); `LayoutShareImageInput`; `layoutShareImage(input): { width: number; height: number; ops: DrawOp[] }`; `blockHeight(playerCount): number`; `renderShareImage(input): Promise<Blob>`. Task 4 calls `renderShareImage`.

- [ ] **Step 1: Write the failing test**

Create `src/share/share-image.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { layoutShareImage } from "./share-image";
import { FUTSAL_DISCIPLINE } from "../domain/seed";
import type { Player, SplitResult } from "../domain/types";

const cap = (t: number, f: number, g: number) => ({
  disciplineId: "futsal",
  attributeRatings: { technical: t, fitness: f, "game-iq": g },
  eligibleRoles: ["goalkeeper"],
  preferredRole: "goalkeeper",
});

const roster: Player[] = Array.from({ length: 12 }, (_, i) => ({
  id: `p${i + 1}`,
  communityId: "c1",
  name: `Player ${i + 1}`,
  capabilities: [cap(4, 4, 4)],
}));

const result = (teamCount: number, perTeam: number): SplitResult => ({
  teams: Array.from({ length: teamCount }, (_, index) => ({
    index,
    slots: Array.from({ length: perTeam }, (_, s) => ({ playerId: `p${index * perTeam + s + 1}`, roleId: null })),
    totalStrength: 4 * perTeam,
    avgStrength: 4,
  })),
  gap: 0.4,
  flags: [],
  unassigned: [],
  solver: { optimal: true, nodesExplored: 51, elapsedMs: 6 },
});

const input = (teamCount: number, perTeam: number) => ({
  disciplineName: "Futsal", discipline: FUTSAL_DISCIPLINE, result: result(teamCount, perTeam), roster,
});

describe("layoutShareImage", () => {
  it("is a fixed 1080 px wide", () => {
    for (const n of [2, 3, 4]) expect(layoutShareImage(input(n, 5)).width).toBe(1080);
  });

  it("rounds the height up to the next 8 px", () => {
    for (const n of [2, 3, 4]) expect(layoutShareImage(input(n, 5)).height % 8).toBe(0);
  });

  it("grows the height with team count for stacked blocks", () => {
    const two = layoutShareImage(input(2, 5)).height;
    const three = layoutShareImage(input(3, 5)).height;
    const four = layoutShareImage(input(4, 5)).height;
    expect(three).toBeGreaterThan(two);
    expect(four).toBeGreaterThan(three);
  });

  it("paints the brand tokens by literal hex, never a CSS variable", () => {
    const fills = layoutShareImage(input(2, 5)).ops.map((op) => op.fill);
    expect(fills).toContain("#FAF8F5");
    expect(fills).toContain("#1C1917");
    expect(fills).toContain("#57534E");
    expect(fills).toContain("#C2410C");
    expect(fills).toContain("#E7E3DC");
    expect(fills.some((f) => f.startsWith("var("))).toBe(false);
  });

  it("gives each team its bib colour, in order", () => {
    const bars = layoutShareImage(input(3, 5)).ops.filter((op) => op.kind === "roundRect").map((op) => op.fill);
    expect(bars).toEqual(["#FFC400", "#FF4F9A", "#4E8FDB"]);
  });

  it("never uses a type size below 34 px", () => {
    for (const op of layoutShareImage(input(2, 5)).ops) {
      if (op.kind !== "text") continue;
      const size = Number(op.font.match(/(\d+)px/)?.[1]);
      expect(size).toBeGreaterThanOrEqual(34);
    }
  });

  it("is deterministic, so the same split yields the same image in dark mode", () => {
    const a = layoutShareImage(input(2, 5));
    const b = layoutShareImage(input(2, 5));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("keeps every glyph inside the poster, clipping a long name instead of overflowing", () => {
    const longName = { ...input(2, 5) };
    longName.roster = roster.map((p, i) => (i === 0 ? { ...p, name: "A Very Long Player Name That Should Clip" } : p));
    const { width, height, ops } = layoutShareImage(longName);
    for (const op of ops) {
      if (op.kind !== "text") continue;
      const size = Number(op.font.match(/(\d+)px/)?.[1]);
      const w = op.text.length * size * 0.52;
      const left = op.align === "right" ? op.x - w : op.x;
      expect(left).toBeGreaterThanOrEqual(0);
      expect(left + w).toBeLessThanOrEqual(width);
      expect(op.y).toBeLessThanOrEqual(height);
      expect(op.y - size).toBeGreaterThanOrEqual(0);
    }
    expect(ops.some((op) => op.kind === "text" && op.text.includes("\u2026"))).toBe(true);
  });

  it("lists unassigned players only when there are any", () => {
    const withUnassigned = { ...input(2, 5), result: { ...result(2, 5), unassigned: ["p11"] } };
    expect(layoutShareImage(withUnassigned).ops.some((op) => op.kind === "text" && op.text.includes("Not playing: Player 11"))).toBe(true);
    expect(layoutShareImage(input(2, 5)).ops.some((op) => op.kind === "text" && op.text.includes("Not playing"))).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/share/share-image.test.ts`
Expected: FAIL — `Failed to resolve import "./share-image"`.

- [ ] **Step 3: Write the layout and the replay**

Create `src/share/share-image.ts`:

```ts
import type { Discipline, Player, SplitResult } from "../domain/types";
import { capabilityFor } from "../session/flow";

/**
 * The poster's geometry as pure data, so the layout is testable in node and the
 * canvas replay is a thin loop. No canvas import here on purpose.
 */
export type DrawOp =
  | { kind: "rect"; x: number; y: number; w: number; h: number; fill: string }
  | { kind: "roundRect"; x: number; y: number; w: number; h: number; r: number; fill: string }
  | { kind: "text"; x: number; y: number; text: string; font: string; fill: string; align: "left" | "right" };

export interface LayoutShareImageInput {
  disciplineName: string;
  discipline: Discipline;
  result: SplitResult;
  roster: Player[];
}

/**
 * The brand tokens by literal hex. The poster never reads `prefers-color-scheme`
 * or `data-theme`, so the same split yields the same image in either theme.
 */
const PAPER = "#FAF8F5";
const INK = "#1C1917";
const SLATE = "#57534E";
const AMBER = "#C2410C";
const HAIRLINE = "#E7E3DC";
const BIB = ["#FFC400", "#FF4F9A", "#4E8FDB", "#6FAF8E", "#C9A227"];

const WIDTH = 1080;
const MARGIN = 64;
const HEADER_HEIGHT = 240;
const FOOTER_HEIGHT = 160;
const BLOCK_BASE = 96;
const ROW_HEIGHT = 56;
const BLOCK_PADDING = 32;
const COLUMN_GAP = 32;
const INSET = 36;

const DISPLAY = '600 48px "Outfit"';
const BODY = '500 34px "Familjen Grotesk"';
const FIGURE = '700 64px "Outfit"';

/** Glyph widths are approximated: there is no canvas in a pure layout. */
const CHAR_WIDTH = 0.52;

function textWidth(text: string, font: string): number {
  const size = Number(font.match(/(\d+)px/)?.[1] ?? 34);
  return text.length * size * CHAR_WIDTH;
}

/** Clip a label to the space available, so a long name cannot leave the poster. */
function fit(text: string, font: string, maxWidth: number): string {
  if (textWidth(text, font) <= maxWidth) return text;
  let out = text;
  while (out.length > 1 && textWidth(`${out}\u2026`, font) > maxWidth) out = out.slice(0, -1);
  return `${out}\u2026`;
}

export function blockHeight(playerCount: number): number {
  return BLOCK_BASE + playerCount * ROW_HEIGHT + BLOCK_PADDING;
}

export function layoutShareImage(input: LayoutShareImageInput): { width: number; height: number; ops: DrawOp[] } {
  const { disciplineName, discipline, result, roster } = input;
  const teams = result.teams;
  const columns = teams.length === 2;
  const nameOf = (id: string) => roster.find((p) => p.id === id)?.name ?? "?";

  /** Strongest first, with a capability-less player last and no parenthesis. */
  const rowsFor = (slots: SplitResult["teams"][number]["slots"]) =>
    slots
      .map((slot, position) => ({ position, player: roster.find((p) => p.id === slot.playerId) }))
      .filter((x): x is typeof x & { player: Player } => x.player !== undefined)
      .map(({ player, position }) => {
        const cap = capabilityFor(player, discipline);
        const value = cap
          ? discipline.attributes.reduce((sum, a) => sum + (cap.attributeRatings[a.id] ?? 0), 0) / discipline.attributes.length
          : null;
        return { name: player.name, value, position };
      })
      .sort((a, b) => (b.value ?? -1) - (a.value ?? -1) || a.position - b.position);

  const heights = teams.map((t) => blockHeight(t.slots.length));
  const stacked = heights.reduce((s, h) => s + h + 24, 0);
  const height = columns ? HEADER_HEIGHT + Math.max(...heights, 0) + FOOTER_HEIGHT : HEADER_HEIGHT + stacked + FOOTER_HEIGHT;
  const rounded = Math.ceil(height / 8) * 8;

  const ops: DrawOp[] = [{ kind: "rect", x: 0, y: 0, w: WIDTH, h: rounded, fill: PAPER }];
  ops.push({ kind: "text", x: MARGIN, y: 96, text: fit(disciplineName, DISPLAY, WIDTH / 2), font: DISPLAY, fill: INK, align: "left" });
  ops.push({ kind: "text", x: WIDTH - MARGIN, y: 88, text: "GAP", font: BODY, fill: SLATE, align: "right" });
  ops.push({ kind: "text", x: WIDTH - MARGIN, y: 168, text: result.gap.toFixed(1), font: FIGURE, fill: AMBER, align: "right" });
  ops.push({ kind: "rect", x: MARGIN, y: HEADER_HEIGHT - 24, w: WIDTH - MARGIN * 2, h: 1, fill: HAIRLINE });

  const blockWidth = columns ? (WIDTH - MARGIN * 2 - COLUMN_GAP) / 2 : WIDTH - MARGIN * 2;
  const labelRoom = blockWidth - INSET - MARGIN;
  let y = HEADER_HEIGHT;
  teams.forEach((team, index) => {
    const x = columns ? MARGIN + index * (blockWidth + COLUMN_GAP) : MARGIN;
    ops.push({ kind: "roundRect", x, y: y + 24, w: 12, h: heights[index] - 48, r: 6, fill: BIB[team.index % BIB.length] ?? BIB[0] });
    ops.push({ kind: "text", x: x + INSET, y: y + 64, text: `Team ${String.fromCharCode(65 + team.index)}`, font: DISPLAY, fill: INK, align: "left" });
    // The average sits at the block's own right edge, not the poster's, so two
    // columns cannot collide.
    ops.push({ kind: "text", x: x + blockWidth, y: y + 64, text: `avg ${team.avgStrength.toFixed(1)}`, font: BODY, fill: SLATE, align: "right" });
    rowsFor(team.slots).forEach((row, r) => {
      const line = row.value === null ? row.name : `${row.name} (${row.value.toFixed(1)})`;
      const prefix = "\u2022 ";
      ops.push({
        kind: "text",
        x: x + INSET,
        y: y + 128 + r * ROW_HEIGHT,
        text: prefix + fit(line, BODY, labelRoom - textWidth(prefix, BODY)),
        font: BODY,
        fill: SLATE,
        align: "left",
      });
    });
    if (!columns) y += heights[index] + 24;
  });

  if (result.unassigned.length > 0) {
    ops.push({ kind: "rect", x: MARGIN, y: rounded - FOOTER_HEIGHT + 24, w: WIDTH - MARGIN * 2, h: 1, fill: HAIRLINE });
    ops.push({
      kind: "text",
      x: MARGIN,
      y: rounded - FOOTER_HEIGHT + 72,
      text: fit(`Not playing: ${result.unassigned.map(nameOf).join(", ")}`, BODY, WIDTH - MARGIN * 2),
      font: BODY,
      fill: SLATE,
      align: "left",
    });
  }
  return { width: WIDTH, height: rounded, ops };
}

/**
 * Replay the layout onto a canvas. Both faces are variable woff2, and a `fillText`
 * before the face loads silently draws a fallback, so the fonts are awaited before
 * the first draw. `src/landingDeal.tsx` re-measures on `document.fonts.ready` for
 * the same reason.
 */
export async function renderShareImage(input: LayoutShareImageInput): Promise<Blob> {
  const { width, height, ops } = layoutShareImage(input);
  if (typeof document !== "undefined" && document.fonts?.ready) await document.fonts.ready;

  const canvas: OffscreenCanvas | HTMLCanvasElement =
    typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(width, height)
      : Object.assign(document.createElement("canvas"), { width, height });
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  ctx.textBaseline = "alphabetic";

  for (const op of ops) {
    if (op.kind === "rect") {
      ctx.fillStyle = op.fill;
      ctx.fillRect(op.x, op.y, op.w, op.h);
    } else if (op.kind === "roundRect") {
      ctx.fillStyle = op.fill;
      ctx.beginPath();
      ctx.roundRect(op.x, op.y, op.w, op.h, op.r);
      ctx.fill();
    } else {
      ctx.font = op.font;
      ctx.fillStyle = op.fill;
      ctx.textAlign = op.align;
      ctx.fillText(op.text, op.x, op.y);
    }
  }

  if ("convertToBlob" in canvas) return canvas.convertToBlob({ type: "image/png" });
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not render the image."))), "image/png");
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/share/share-image.test.ts`
Expected: PASS — 9 passed.

- [ ] **Step 5: Type-check, then commit**

Run: `npx tsc -b`
Expected: exit 0.

```bash
git add src/share/share-image.ts src/share/share-image.test.ts
git commit -m "feat(share): a branded poster laid out as pure draw ops"
```

---

### Task 4: The image action on the share sheet

**Files:**
- Modify: `src/share/ShareSheet.tsx` (the `.bar` region added in Task 2, and the imports)
- Modify: `e2e/tests/share/share.spec.ts` (append two specs)
- Test: `e2e/tests/share/share.spec.ts`

**Interfaces:**
- Consumes: `renderShareImage(input): Promise<Blob>` from Task 3; the `imageControl?: ReactNode` slot `ShareSheet` already accepts.
- Produces: `data-testid="share-image"`, whose label is `Copy image` when `ClipboardItem.supports?.("image/png")` and `Download image` otherwise. No later task consumes it.

**Dependency cost: zero.** `dependencies` stays `{"react": "^19.1.0", "react-dom": "^19.1.0"}`. The poster is drawn by hand to `<canvas>`; a DOM-to-image library would add a third runtime dependency, ship a large bundle, and produce output the node test environment cannot test at all.

- [ ] **Step 1: Write the failing specs**

Append to `e2e/tests/share/share.spec.ts`:

```ts
test("copies the poster to the clipboard as a PNG", async ({ page }) => {
  await splitTwoTeams(page);
  await page.getByTestId("share-teams").click();
  const sheet = page.locator(".modal-card");
  await expect(sheet.getByTestId("share-image")).toHaveText("Copy image");

  await sheet.getByTestId("share-image").click();
  await expect(sheet.locator(".share-status")).toHaveText("Copied.");

  const items = await page.evaluate(async () => {
    const list = await navigator.clipboard.read();
    const out: Array<{ type: string; size: number }> = [];
    for (const item of list) {
      for (const type of item.types) {
        if (type !== "image/png") continue;
        const blob = await item.getType(type);
        out.push({ type, size: blob.size });
      }
    }
    return out;
  });
  expect(items.length).toBeGreaterThan(0);
  expect(items[0].type).toBe("image/png");
  // A legible poster at 1080 px wide, not a blank or truncated bitmap.
  expect(items[0].size).toBeGreaterThan(10_000);
});

test("downloads the poster when the browser cannot write an image to the clipboard", async ({ page }) => {
  await page.addInitScript(() => {
    // Deleting ClipboardItem makes the capability check fail, which is exactly the
    // path a browser without image clipboard support takes.
    delete (window as unknown as { ClipboardItem?: unknown }).ClipboardItem;
  });
  await splitTwoTeams(page);
  await page.getByTestId("share-teams").click();
  const sheet = page.locator(".modal-card");
  await expect(sheet.getByTestId("share-image")).toHaveText("Download image");

  const download = page.waitForEvent("download");
  await sheet.getByTestId("share-image").click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^comp3tive-teams-\d{4}-\d{2}-\d{2}\.png$/);
});
```

- [ ] **Step 2: Run the specs to verify they fail**

Run:
```bash
npx vite build && npx playwright test --config=e2e/playwright.config.ts tests/share/share.spec.ts
```
Expected: FAIL — `getByTestId('share-image')` resolves to 0 elements in both new specs; the three Task 2 specs still pass.

- [ ] **Step 3: Add the image action**

In `src/share/ShareSheet.tsx`, extend the imports:

```tsx
import { renderShareImage } from "./share-image";
```

Add the capability check and the handler beside the existing `copyText`:

```tsx
  // Feature-detected, not assumed: a browser may have ClipboardItem and still
  // refuse image/png, in which case the download is the honest action.
  const canCopyImage = typeof ClipboardItem !== "undefined" && ClipboardItem.supports?.("image/png") === true;

  const imageInput = () => ({ disciplineName, discipline, result, roster });

  const downloadImage = async () => {
    const blob = await renderShareImage(imageInput());
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `comp3tive-teams-${new Date().toISOString().slice(0, 10)}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setStatus("Saved the image.");
  };

  const shareImage = async () => {
    if (!canCopyImage) {
      await downloadImage();
      return;
    }
    try {
      const blob = await renderShareImage(imageInput());
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setStatus("Copied.");
    } catch {
      // A copy failure never costs the user the text the sheet already holds.
      await downloadImage();
      setStatus("Couldn't copy the image. Saved it instead.");
    }
  };
```

Replace the `{imageControl}` line in the render with the real control:

```tsx
        <button type="button" className="btn btn-ghost" data-testid="share-image" onClick={() => void shareImage()}>
          {canCopyImage ? "Copy image" : "Download image"}
        </button>
```

Then remove the now-unused `imageControl?: ReactNode` prop from the interface, its destructuring, and the `type ReactNode` import, so `noUnusedLocals` stays clean:

```tsx
interface Props {
  communityName: string;
  disciplineName: string;
  discipline: Discipline;
  result: SplitResult;
  roster: Player[];
  onClose: () => void;
}
```

- [ ] **Step 4: Run the specs to verify they pass**

Run:
```bash
npx vite build && npx playwright test --config=e2e/playwright.config.ts tests/share/share.spec.ts
```
Expected: PASS — 5 passed.

- [ ] **Step 5: Type-check, then commit**

Run: `npx tsc -b`
Expected: exit 0.

```bash
git add src/share/ShareSheet.tsx e2e/tests/share/share.spec.ts
git commit -m "feat(share): render the teams as a PNG, clipboard first with a download fallback"
```

---

### Task 5: Why the split is fair, in words

**Files:**
- Create: `src/share/fairness.ts`
- Test: `src/share/fairness.test.ts`
- Modify: `src/session/SplitScreen.tsx` (imports; a `.fairness` line after the readout in `GapMeter` at `:130-141`; the same line after the 3+ readout at `:334-345`)
- Create: `e2e/tests/split/fairness.spec.ts`

**Interfaces:**
- Consumes: `strengthOf(player, discipline): number | null` (`src/session/flow.ts:10`), `teamName(index): string` (`:16`), `gapQualifier(result): string | null` (B13, read but **not** imported — see the boundary below).
- Produces: `explainFairness(input: FairnessInput): { averages: string; trade: string }`, plus the exported `interface FairnessInput`. No later task consumes it.

**The boundary with B13, stated here and enforced by a test.** B13 owns *"is this proven?"*: `gapKind`, `gapQualifier`, and the `Best gap found.` suffix inside `.readout .fine`. D37 owns *"why is this fair?"*: what the number measures and where the strength sits. **D37's copy must not restate or contradict a provenance word**, and since the sentence is identical in both provenance cases, **D37 does not import `gapProvenance.ts` at all**. The banned-substring test below is the mechanical guarantee, not a matter of taste.

- [ ] **Step 1: Write the failing test**

Create `src/share/fairness.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { explainFairness } from "./fairness";
import { FUTSAL_DISCIPLINE } from "../domain/seed";
import type { Player, SplitResult } from "../domain/types";

/** Every word that belongs to B13's provenance verdict, plus the em-dash rule. */
const BANNED = ["proven", "best gap", "best-found", "exact", "minimum", "optimal", "solver", "search", "node", "heuristic", "aborted"];

const cap = (...r: number[]) => ({
  disciplineId: "futsal",
  attributeRatings: { technical: r[0], fitness: r[1], "game-iq": r[2] },
  eligibleRoles: ["goalkeeper", "defender", "winger", "pivot"],
  preferredRole: null,
});

const player = (id: string, name: string, ratings?: number[]): Player => ({
  id,
  communityId: "c1",
  name,
  capabilities: ratings ? [cap(...ratings)] : [],
});

const ROSTER: Player[] = [
  player("p1", "Andi", [5, 5, 5]),
  player("p2", "Budi", [4, 4, 4]),
  player("p3", "Citra", [2, 2, 2]),
  player("p4", "Dewi"),
];

const result = (avgA: number, avgB: number, slotsA = ["p1"], slotsB = ["p3"]): SplitResult => ({
  teams: [
    { index: 0, slots: slotsA.map((id) => ({ playerId: id, roleId: null })), totalStrength: avgA, avgStrength: avgA },
    { index: 1, slots: slotsB.map((id) => ({ playerId: id, roleId: null })), totalStrength: avgB, avgStrength: avgB },
  ],
  gap: Math.abs(avgA - avgB),
  flags: [],
  unassigned: [],
  solver: { optimal: false, nodesExplored: 4_000_001, elapsedMs: 900 },
});

const input = (r: SplitResult) => ({ result: r, discipline: FUTSAL_DISCIPLINE, roster: ROSTER });

describe("explainFairness", () => {
  it("states the range every team's average falls inside", () => {
    expect(explainFairness(input(result(5, 4))).averages).toBe("Every team averages 4.0 to 5.0.");
  });

  it("uses the singular form when the teams agree to one decimal", () => {
    expect(explainFairness(input(result(4, 4))).averages).toBe("Every team averages 4.0.");
  });

  it("sets the strongest player on the higher-averaging team against the weakest on the lower", () => {
    const { trade } = explainFairness(input(result(5, 2)));
    expect(trade).toBe("Andi (5.0) is Team A's best; Citra (2.0) is Team B's weakest.");
  });

  it("never names a player with no capability in the discipline", () => {
    const { trade } = explainFairness(input(result(5, 5, ["p4"], ["p3"])));
    expect(trade).not.toContain("Dewi");
  });

  it("returns an empty pair when fewer than two teams exist", () => {
    const single: SplitResult = { ...result(4, 4), teams: [result(4, 4).teams[0]] };
    expect(explainFairness(input(single))).toEqual({ averages: "", trade: "" });
  });

  it("produces no provenance word and no em-dash, in either provenance case", () => {
    for (const r of [result(5, 4), { ...result(5, 4), solver: { optimal: true, nodesExplored: 51, elapsedMs: 6 } }]) {
      const { averages, trade } = explainFairness(input(r));
      for (const value of [averages, trade]) {
        for (const banned of BANNED) expect(value.toLowerCase()).not.toContain(banned);
        expect(value).not.toContain("\u2014");
      }
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/share/fairness.test.ts`
Expected: FAIL — `Failed to resolve import "./fairness"`.

- [ ] **Step 3: Write the implementation**

Create `src/share/fairness.ts`:

```ts
import type { Discipline, Player, SplitResult, TeamAssignment, TeamSlot } from "../domain/types";
import { strengthOf, teamName } from "../session/flow";

export interface FairnessInput {
  result: SplitResult;
  discipline: Discipline;
  roster: Player[];
}

/** The lowest- and highest-averaging teams; ties break by index so the output is stable. */
function extremes(teams: TeamAssignment[]) {
  if (teams.length < 2) return null;
  const byAverage = [...teams].sort((a, b) => a.avgStrength - b.avgStrength || a.index - b.index);
  return { low: byAverage[0], high: byAverage[byAverage.length - 1] };
}

/** Each rated player on a team, in slot order, with their Strength. */
function rated(team: TeamAssignment, roster: Player[], discipline: Discipline) {
  return team.slots
    .map((slot: TeamSlot, position: number) => ({ position, player: roster.find((p) => p.id === slot.playerId) }))
    .filter((x): x is typeof x & { player: Player } => x.player !== undefined)
    .map((x) => ({ ...x, strength: strengthOf(x.player, discipline) }))
    .filter((x): x is typeof x & { strength: number } => x.strength !== null);
}

/**
 * Why the teams are fair, in the terms a player would use: the band every team's
 * average falls inside, and the strongest player on one side set against the
 * weakest on the other. It says nothing about how the search went; that verdict
 * belongs to `src/session/gapProvenance.ts`.
 */
export function explainFairness(input: FairnessInput): { averages: string; trade: string } {
  const { result, discipline, roster } = input;
  const span = extremes(result.teams);
  if (!span) return { averages: "", trade: "" };

  const low = span.low.avgStrength.toFixed(1);
  const high = span.high.avgStrength.toFixed(1);
  const averages = low === high ? `Every team averages ${low}.` : `Every team averages ${low} to ${high}.`;

  // Ties break by slot order, so the same input always names the same two players.
  const best = rated(span.high, roster, discipline).sort((a, b) => b.strength - a.strength || a.position - b.position)[0];
  const weakest = rated(span.low, roster, discipline).sort((a, b) => a.strength - b.strength || a.position - b.position)[0];
  if (!best || !weakest) return { averages, trade: "" };

  const trade =
    `${best.player.name} (${best.strength.toFixed(1)}) is ${teamName(span.high.index)}'s best; ` +
    `${weakest.player.name} (${weakest.strength.toFixed(1)}) is ${teamName(span.low.index)}'s weakest.`;
  return { averages, trade };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/share/fairness.test.ts`
Expected: PASS — 6 passed.

- [ ] **Step 5: Render it at both live sites, additively**

In `src/session/SplitScreen.tsx`, add the import beside the Task 2 import:

```tsx
import { explainFairness } from "../share/fairness";
```

In `GapMeter`, after the `</div>` that closes `.readout` at `:141` and before the closing `</>`, insert:

```tsx
      <FairnessLine result={result} discipline={discipline} roster={roster} />
```

`GapMeter` currently takes only `{ result, balanced }` (`:109`). Widen it to receive what the line needs:

```tsx
function GapMeter({ result, balanced, discipline, roster }: { result: SplitResult; balanced: boolean; discipline: Discipline; roster: Player[] }) {
```

and update its one call site at `:330`:

```tsx
          <GapMeter result={result} balanced={balanced} discipline={discipline} roster={roster} />
```

Add the component above `GapMeter` (before `:109`):

```tsx
/** Why the teams are fair, beside the gap that measures it. */
function FairnessLine({ result, discipline, roster }: { result: SplitResult; discipline: Discipline; roster: Player[] }) {
  const { averages, trade } = explainFairness({ result, discipline, roster });
  if (!averages) return null;
  return (
    <p className="fairness">
      <span className="fine">{averages}</span>
      {trade && <> <span className="fine">{trade}</span></>}
    </p>
  );
}
```

In the 3+ team branch, after the `</div>` that closes `.readout` at `:345` and before `<div className="team-stack">`, insert:

```tsx
          <FairnessLine result={result} discipline={discipline} roster={roster} />
```

The empty state (`:346-353`, "Not enough eligible players") gets no line: it has no teams to explain.

Add the styling to `src/index.css`, reusing the `.readout` vocabulary rather than a new component. Place it directly after the `.readout .fine` rule at `:2149`:

```css
/* D37: the plain-language explanation beside the gap. Same voice as .readout. */
.fairness {
  text-align: center;
  margin-top: 6px;
}
```

- [ ] **Step 6: Write the e2e spec and run it**

Create `e2e/tests/split/fairness.spec.ts`:

```ts
/**
 * The split explains itself in words, and the words stay D37's: no word that
 * belongs to the gap's provenance verdict may appear here.
 */
import { test, expect } from "@playwright/test";
import { gotoHubSeeded, type SeedWorld } from "../../support/seed";

const ROLES = ["tank", "assassin", "mage", "marksman", "fighter"];
const BANNED = ["proven", "best gap", "best-found", "exact", "minimum", "optimal", "solver", "search", "node", "heuristic", "aborted"];

const world = (): SeedWorld => ({
  communities: [{ id: "comm-fair", name: "Fair Play", createdAt: 100 }],
  players: ["Andi", "Budi", "Citra", "Dewi", "Eka", "Fajar", "Gita", "Hana", "Irfan", "Joko"].map((name, i) => ({
    id: `p${i + 1}`,
    communityId: "comm-fair",
    name,
    capabilities: [{
      disciplineId: "mlbb",
      attributeRatings: { mechanics: 5 - (i % 3), "game-sense": 4, "hero-pool": 4 - (i % 2), teamwork: 4 },
      eligibleRoles: ROLES,
      preferredRole: ROLES[i % 5],
    }],
  })),
  sessions: [],
  tournaments: [],
  squads: [],
  activeCommunityId: "comm-fair",
});

test("the split says why it is fair, and uses none of the provenance words", async ({ page }) => {
  await gotoHubSeeded(page, world(), "Roster");
  await page.getByRole("button", { name: "Split match" }).click();
  await expect(page.locator(".match-setup")).toBeVisible({ timeout: 10000 });
  await page.getByTestId("split-button").click();
  await expect(page.locator(".split-screen")).toBeVisible({ timeout: 15000 });

  const line = page.locator(".fairness");
  await expect(line).toBeVisible();
  await expect(line).toContainText("Every team averages");

  const text = ((await line.innerText()) ?? "").toLowerCase();
  for (const banned of BANNED) expect(text).not.toContain(banned);
  expect(await line.innerText()).not.toContain("\u2014");
});

test("the landing hero gains no fairness line", async ({ page }) => {
  // src/landing.tsx:151-161 mounts SplitScreen without the app's readouts, and
  // landing.spec.ts:157-164 asserts the hero does not overflow at 390x844.
  await page.goto("/");
  await expect(page.locator("#landing-hero .split-screen")).toBeVisible();
  await expect(page.locator("#landing-hero .fairness")).toHaveCount(0);
});
```

Run:
```bash
npx vite build && npx playwright test --config=e2e/playwright.config.ts tests/split/fairness.spec.ts
```
Expected: PASS — 2 passed.

> **Note on the landing hero.** `landing.spec.ts` asserts the hero renders `.split-screen` and `.pitch`; it does **not** assert an exact `.readout` string, so the added line does not break it. `scripts/capture-hero.mjs:209` only *logs* `.readout`. Confirm both by running, in Step 7, the landing spec and `node scripts/capture-hero.mjs`.

- [ ] **Step 7: Confirm the landing page and the hero capture are unaffected**

Run:
```bash
npx vite build && npx playwright test --config=e2e/playwright.config.ts tests/landing/landing.spec.ts
npm run preview & sleep 3; node scripts/capture-hero.mjs
```
Expected: landing spec passes unchanged (16 passed); `capture-hero.mjs` prints its report and exits 0, its bib-pixel check satisfied. Kill the preview afterwards.

- [ ] **Step 8: Prove the `SplitScreen.tsx` edit is still additive, then commit**

Run:
```bash
git diff -U0 src/session/SplitScreen.tsx | grep -E "^-[^-]" | grep -v "^---"
```
Expected: **no output** — no removed lines across Tasks 2 and 5.

```bash
git add src/share/fairness.ts src/share/fairness.test.ts src/session/SplitScreen.tsx src/index.css e2e/tests/split/fairness.spec.ts
git commit -m "feat(split): explain why the teams are fair, beside the gap that measures it"
```

---

### Task 6: The round-robin schedule, as a pure function

**Files:**
- Create: `src/data/round-robin.ts`
- Test: `src/data/round-robin.test.ts`

**Interfaces:**
- Consumes: nothing. The module pairs team **indices**, so it has no dependency on the domain types.
- Produces: `roundRobinSchedule(n: number): RoundRobinPairing[]` and `interface RoundRobinPairing { round: number; teamA: number; teamB: number | null }`. Task 7's `buildBracket` arm consumes it.

- [ ] **Step 1: Write the failing test**

Create `src/data/round-robin.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { roundRobinSchedule } from "./round-robin";

const N = [3, 4, 5, 6, 7, 8];
const pairs = (n: number) => roundRobinSchedule(n).filter((p) => p.teamB !== null);
const key = (a: number, b: number) => [a, b].sort((x, y) => x - y).join(":");

describe("roundRobinSchedule", () => {
  it.each(N)("pairs every unordered pair exactly once for n=%i", (n) => {
    const seen = pairs(n).map((p) => key(p.teamA, p.teamB!));
    expect(seen).toHaveLength((n * (n - 1)) / 2);
    expect(new Set(seen).size).toBe(seen.length);
    for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) expect(seen).toContain(key(a, b));
  });

  it.each(N)("never schedules a team twice in one round for n=%i", (n) => {
    const schedule = roundRobinSchedule(n);
    for (const round of new Set(schedule.map((p) => p.round))) {
      const playing = schedule
        .filter((p) => p.round === round)
        .flatMap((p) => (p.teamB === null ? [p.teamA] : [p.teamA, p.teamB]));
      expect(new Set(playing).size).toBe(playing.length);
    }
  });

  it.each([3, 5, 7])("gives each round exactly one bye and each team exactly one bye for odd n=%i", (n) => {
    const schedule = roundRobinSchedule(n);
    const perRound = [...new Set(schedule.map((p) => p.round))].map(
      (r) => schedule.filter((p) => p.round === r && p.teamB === null).length,
    );
    expect(perRound.every((count) => count === 1)).toBe(true);
    const perTeam = Array.from({ length: n }, (_, i) => schedule.filter((p) => p.teamB === null && p.teamA === i).length);
    expect(perTeam).toEqual(Array.from({ length: n }, () => 1));
  });

  it.each(N)("uses the documented round count for n=%i", (n) => {
    expect(new Set(roundRobinSchedule(n).map((p) => p.round)).size).toBe(n % 2 === 0 ? n - 1 : n);
  });

  it.each([4, 6, 8])("has no bye at all for even n=%i", (n) => {
    expect(roundRobinSchedule(n).filter((p) => p.teamB === null)).toEqual([]);
  });

  it("returns nothing for fewer than two teams", () => {
    expect(roundRobinSchedule(0)).toEqual([]);
    expect(roundRobinSchedule(1)).toEqual([]);
  });

  it("emits the documented 4-team schedule, pairing the first slot with the last", () => {
    expect(roundRobinSchedule(4)).toEqual([
      { round: 1, teamA: 0, teamB: 3 },
      { round: 1, teamA: 1, teamB: 2 },
      { round: 2, teamA: 0, teamB: 2 },
      { round: 2, teamA: 3, teamB: 1 },
      { round: 3, teamA: 0, teamB: 1 },
      { round: 3, teamA: 2, teamB: 3 },
    ]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/data/round-robin.test.ts`
Expected: FAIL — `Failed to resolve import "./round-robin"`.

- [ ] **Step 3: Write the implementation**

Create `src/data/round-robin.ts`:

```ts
/**
 * Round-robin scheduling by the **circle method**.
 *
 * For an odd team count one `null` placeholder pads the field to `m = n + 1`
 * slots. Slot 0 stays fixed while slots 1..m-1 rotate one position per round, and
 * each round pairs slot `i` with slot `m - 1 - i`. A `null` on either side of a
 * pair is a bye, emitted as `teamB: null` (with `teamA` naming who rests).
 *
 * Pairing is by team *index*, so this module has no dependency on the domain
 * types and is testable on its own. Round counts: `n - 1` for even `n`, `n` for
 * odd; matches: `n * (n - 1) / 2`.
 */
export interface RoundRobinPairing {
  /** 1-based round number. */
  round: number;
  /** The team that plays, or the team taking the bye when `teamB` is null. */
  teamA: number;
  /** The opponent, or null for a bye. */
  teamB: number | null;
}

export function roundRobinSchedule(n: number): RoundRobinPairing[] {
  if (n < 2) return [];
  const slots: (number | null)[] = Array.from({ length: n % 2 === 1 ? n + 1 : n }, (_, i) => (i < n ? i : null));
  const m = slots.length;
  const out: RoundRobinPairing[] = [];

  for (let round = 1; round <= m - 1; round++) {
    for (let i = 0; i < m / 2; i++) {
      const a = slots[i];
      const b = slots[m - 1 - i];
      out.push(a === null || b === null ? { round, teamA: (a ?? b)!, teamB: null } : { round, teamA: a, teamB: b });
    }
    // Rotate slots 1..m-1 by one; slot 0 stays fixed.
    const last = slots[m - 1];
    for (let i = m - 1; i > 1; i--) slots[i] = slots[i - 1];
    slots[1] = last;
  }
  return out;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/data/round-robin.test.ts`
Expected: PASS — 26 passed.

- [ ] **Step 5: Type-check, then commit**

Run: `npx tsc -b`
Expected: exit 0.

```bash
git add src/data/round-robin.ts src/data/round-robin.test.ts
git commit -m "feat(tournament): a pure round-robin schedule by the circle method"
```

---

### Task 7: Round robin in the bracket engine

**Files:**
- Modify: `src/domain/types.ts:25`
- Modify: `src/ui/constants.ts` (the `FORMAT_LABEL` record created by C23)
- Modify: `src/tournament/tournament-validation.ts:58-63`
- Modify: `src/tournament/bracket.ts:53`, `:120-127`, `:317-326`
- Modify: `src/tournament/bracket.test.ts` (append `describe` blocks only)
- Modify: `src/shell/useSplitFlow.ts` (`consumeTeams`'s format guard)

**Interfaces:**
- Consumes: `roundRobinSchedule(n)` from Task 6; `emptyMatch(round, position)` at `bracket.ts:56`; `FORMAT_LABEL` from `src/ui/constants.ts` (C23).
- Produces: `TournamentFormat` includes `"round-robin"`; `FORMAT_LABEL["round-robin"] === "Round robin"`; `getValidTeamCounts("round-robin")` is `[3, 4, 5, 6, 7, 8]`; `buildBracket` handles round robin; `champion()` returns a round-robin champion. Task 8's UI consumes all four.

**Two things stated up front, because they are the load-bearing decisions.**

1. **`roundsFor` is extended, not bypassed.** `bracket.ts:53` is shared by `buildBracket` (`:91`), `requiredMatches` (`:194`) and `champion` (`:323`). Round robin needs a different round count (`n - 1` / `n`), so it gains an arm. The `single-elim` and Swiss arms are untouched.
2. **`champion()` is a required change, and it fails silently in two distinct ways.** Today only `"swiss"` takes the standings branch (`:319`); everything else falls to the single-elim final lookup at `:323`, which computes `finalRound = 1` for a non-single-elim format and then reads `matches.find(m => m.round === 1 && !m.isThirdPlace)`. For round robin that is the **first round's first match**. Measured against this exact source: with a completed 4-team schedule whose standings leader finished on 2 wins, `champion()` returned `t4` — a team with 1 win that happened to win round 1's first match — and with a 3-team schedule whose last round was decided but whose round 1 was blank, it returned `null`. Both are wrong results, not crashes.

- [ ] **Step 1: Write the failing tests**

Append to `src/tournament/bracket.test.ts` (existing assertions are not touched). The `team`, `seeded`, `tourney`, `tourneyWith` and `game` fixtures at `:1-46` are reused as-is:

```ts
describe("buildBracket: round robin", () => {
  it("builds every pairing exactly once, with no advancing links", () => {
    const t = buildBracket(tourney("round-robin", 4));
    expect(t.status).toBe("active");
    expect(t.matches).toHaveLength(6);
    // Round robin matches are independent, so no match feeds another.
    for (const m of t.matches) {
      expect(m.winnerNext).toBeNull();
      expect(m.loserNext).toBeNull();
    }
    const seen = t.matches.map((m) => [m.teamAId!, m.teamBId!].sort().join(":"));
    expect(new Set(seen).size).toBe(6);
  });

  it("uses n-1 rounds for an even count and n for an odd one, with ids from the shared helper", () => {
    const even = buildBracket(tourney("round-robin", 6));
    expect(Math.max(...even.matches.map((m) => m.round))).toBe(5);
    expect(even.matches).toHaveLength(15);

    const odd = buildBracket(tourney("round-robin", 3));
    expect(Math.max(...odd.matches.map((m) => m.round))).toBe(3);
    expect(odd.matches).toHaveLength(3);
    expect(odd.matches.map((m) => m.id)).toEqual(["m-1-0", "m-2-0", "m-3-0"]);
  });

  it("emits no match for a bye: an odd count produces n(n-1)/2 matches", () => {
    for (const n of [3, 5, 7]) {
      expect(buildBracket(tourney("round-robin", n)).matches).toHaveLength((n * (n - 1)) / 2);
    }
  });

  it("is idempotent: rebuilding regenerates the same matches", () => {
    const once = buildBracket(tourney("round-robin", 5));
    const twice = buildBracket(once);
    expect(twice.matches.map((m) => m.id)).toEqual(once.matches.map((m) => m.id));
  });
});

describe("round robin: status, stands and champion", () => {
  // `tourney` defaults to a best-of-3 series, where one recorded game decides
  // nothing. A round robin is proven here at best-of-1, so a single game resolves
  // a match and the last round's completion is observable.
  const bo1 = (n: number) => buildBracket(tourney("round-robin", n, { seriesLength: 1 }));

  /** Play every match, giving each win to teamB, so the outcome is deterministic. */
  const playAll = (t: ReturnType<typeof buildBracket>) =>
    t.matches.reduce((acc, m) => applyResult(acc, m.id, [game(m.teamBId!)]), t);

  it("stays active until the last round is decided, then completes", () => {
    const built = bo1(4);
    const lastRound = Math.max(...built.matches.map((m) => m.round));
    let t = built;
    for (const m of built.matches.filter((x) => x.round < lastRound)) {
      t = applyResult(t, m.id, [game(m.teamAId!)]);
    }
    expect(t.status).toBe("active");
    const finals = built.matches.filter((m) => m.round === lastRound);
    t = applyResult(t, finals[0].id, [game(finals[0].teamAId!)]);
    expect(t.status).toBe("active"); // one match of the last round still open
    t = applyResult(t, finals[1].id, [game(finals[1].teamAId!)]);
    expect(t.status).toBe("complete");
  });

  it("crowns the standings leader, and is never null once complete", () => {
    const t = playAll(bo1(4));
    expect(t.status).toBe("complete");
    const leader = standings(t)[0].teamId;
    // The specific silent breakage this change prevents: every result is recorded,
    // so a null champion would be a wrong answer, not an unfinished tournament.
    expect(champion(t)).not.toBeNull();
    expect(champion(t)!.id).toBe(leader);
  });

  it("crowns the standings leader even when the first match of round 1 was won by someone else", () => {
    // Without the champion() change this returned the round-1 winner instead.
    // t4 wins only the opening match; t2 and t3 finish on two wins, t2 leads on seed.
    let t = bo1(4);
    t = applyResult(t, "m-1-0", [game("t4")]);
    t = applyResult(t, "m-1-1", [game("t3")]);
    t = applyResult(t, "m-2-0", [game("t1")]);
    t = applyResult(t, "m-2-1", [game("t2")]);
    t = applyResult(t, "m-3-0", [game("t2")]);
    t = applyResult(t, "m-3-1", [game("t3")]);
    expect(t.status).toBe("complete");
    expect(standings(t)[0].teamId).toBe("t2");
    expect(champion(t)!.id).toBe("t2");
  });

  it("is null while the tournament is unfinished, which is the only legitimate null", () => {
    const t = bo1(3);
    expect(t.status).toBe("active");
    expect(champion(t)).toBeNull();
  });

  it("undoes a recorded game and drops back to active", () => {
    const played = playAll(bo1(3));
    expect(played.status).toBe("complete");
    expect(undoLastGame(played).status).toBe("active");
  });
});
```

The file's import line at `:2` becomes:

```ts
import { applyResult, buildBracket, champion, standings, undoLastGame } from "./bracket";
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/tournament/bracket.test.ts`
Expected: FAIL, and specifically: `buildBracket: round robin` fails because the Swiss fallthrough builds `floor(n/2)` matches for a round-robin format, so the counts are wrong; and the `champion` test fails, either on the `t2` expectation or on `not.toBeNull()`, depending on which case runs first.

- [ ] **Step 3: Add the format value and the label**

In `src/domain/types.ts:25`:

```ts
export type TournamentFormat = "series" | "single-elim" | "swiss" | "round-robin";
```

Run: `npx tsc -b`
Expected: **FAIL** at `src/ui/constants.ts`, on the `FORMAT_LABEL` object literal — `Property 'round-robin' is missing in type 'Record<TournamentFormat, string>'`. That failure is the signal, not a surprise. Add the key:

```ts
export const FORMAT_LABEL: Record<TournamentFormat, string> = {
  series: "Series",
  "single-elim": "Single elimination",
  swiss: "Swiss",
  "round-robin": "Round robin",
};
```

Also check the three other `FORMAT_LABEL` tables C23 removed. If C23 left a local copy anywhere (`grep -rn "Single elimination" src/`), the compiler will name it; add the key there too, or delete the copy in favour of the shared import if C23's consolidation is complete. Run `npx tsc -b` again and expect exit 0 before continuing.

- [ ] **Step 4: Add the valid team counts**

In `src/tournament/tournament-validation.ts:58-63`:

```ts
/** Get valid team counts for a tournament format. */
function getValidTeamCounts(format: TournamentFormat): number[] {
  return format === "series" ? [2]
       : format === "single-elim" ? [2, 4, 8]
       : format === "swiss" ? [4, 6, 8]
       : format === "round-robin" ? [3, 4, 5, 6, 7, 8]
       : [];
}
```

`isValidTeamCountForFormat` (`:66`) needs no change: it reads `getValidTeamCounts`.

- [ ] **Step 5: Add the bracket arms**

In `src/tournament/bracket.ts`, add the import at the top:

```ts
import { roundRobinSchedule } from "../data/round-robin";
```

Extend `roundsFor` at `:53`:

```ts
/** Round count for a format: single elim = log2(N); swiss = ceil(log2 N); round robin = n-1 even, n odd. */
const roundsFor = (format: Tournament["format"], n: number): number =>
  format === "single-elim" ? Math.log2(n)
  : format === "round-robin" ? (n % 2 === 0 ? n - 1 : n)
  : Math.ceil(Math.log2(n));
```

Add the round-robin arm in `buildBracket` immediately **before** the Swiss fallthrough comment at `:122`, so the Swiss block is reached only by Swiss:

```ts
  if (t.format === "round-robin") {
    // Every team plays every other exactly once. A bye produces no match, so the
    // schedule's bye entries are dropped here rather than modelled.
    const byRound = new Map<number, { teamA: number; teamB: number }[]>();
    for (const pairing of roundRobinSchedule(n)) {
      if (pairing.teamB === null) continue;
      if (!byRound.has(pairing.round)) byRound.set(pairing.round, []);
      byRound.get(pairing.round)!.push({ teamA: pairing.teamA, teamB: pairing.teamB });
    }
    for (const round of [...byRound.keys()].sort((a, b) => a - b)) {
      byRound.get(round)!.forEach((pairing, position) => {
        const m = emptyMatch(round, position);
        m.teamAId = t.teams[pairing.teamA].id;
        m.teamBId = t.teams[pairing.teamB].id;
        // winnerNext and loserNext stay null: round-robin matches are
        // independent, so settle()'s downstream re-derivation is a no-op for them.
        t.matches.push(m);
      });
    }
    return { ...t, status: "active" };
  }
```

`requiredMatches` (`:191`) needs **no arm** — its final fallthrough at `:199-200` returns every match in the last round, and for round robin the last round *is* the last set of matches, so "all matches required" is the correct semantics. The test in Step 1 asserts this rather than assuming it.

Extend `champion` at `:317-326`. The condition at `:319` becomes:

```ts
export function champion(tournament: Tournament): TournamentTeam | null {
  if (tournament.status !== "complete") return null;
  // Round robin has no final: the champion is the standings leader, exactly as in Swiss.
  if (tournament.format === "swiss" || tournament.format === "round-robin") {
    const top = standings(tournament)[0];
    return tournament.teams.find((t) => t.id === top?.teamId) ?? null;
  }
  const finalRound = tournament.format === "single-elim" ? roundsFor(tournament.format, tournament.teams.length) : 1;
  const final = tournament.matches.find((m) => m.round === finalRound && !m.isThirdPlace);
  if (!final?.winnerTeamId) return null;
  return tournament.teams.find((t) => t.id === final.winnerTeamId) ?? null;
}
```

The `series` and `single-elim` arms, and every line of the Swiss arm, are untouched.

- [ ] **Step 6: Extend the split flow's guard**

In `src/shell/useSplitFlow.ts`, inside `consumeTeams`, the `bracketOk` expression (moved verbatim from `src/App.tsx:328-331` by C26) gains one arm. Everything else in the statement stays byte-identical, including the message:

```ts
    const bracketOk =
      tournament.format === "swiss" ? n >= 2 && n % 2 === 0
      : tournament.format === "single-elim" ? (n === 2 || n === 4 || n === 8)
      : tournament.format === "round-robin" ? n >= 3 && n <= 8
      : n === 2; // series
```

- [ ] **Step 7: Run the bracket tests to verify they pass**

Run: `npx vitest run src/tournament/bracket.test.ts`
Expected: PASS — the pre-existing Swiss and single-elim tests (`:254`, `:268` among them) plus the new round-robin blocks.

- [ ] **Step 8: Prove no existing bracket assertion or frozen arm changed**

Run:
```bash
git diff -U0 src/tournament/bracket.test.ts | grep -E "^-[^-]" | grep -v "^---"
git diff src/tournament/bracket.ts
```
Expected: the first command prints **nothing** (additions only). The second shows the three additive hunks: `roundsFor`'s new arm, the new `buildBracket` block, and the widened `champion` condition. No `swiss`, `single-elim` or `series` line appears as a removal.

- [ ] **Step 9: Run the whole unit suite, then commit**

Run: `npx vitest run`
Expected: exit 0, 0 failed.

```bash
git add src/domain/types.ts src/ui/constants.ts src/tournament/tournament-validation.ts src/tournament/bracket.ts src/tournament/bracket.test.ts src/shell/useSplitFlow.ts
git commit -m "feat(tournament): round robin as a real format, champion included"
```

---

### Task 8: Round robin in the UI

**Files:**
- Modify: `src/tournament/GamesScreen.tsx:36-40`, `:60-70`, `:334`, `:354-358`, `:374-378`
- Modify: `src/tournament/TournamentScreen.tsx:359-363`
- Create: `e2e/tests/tournament/round-robin.spec.ts`

**Interfaces:**
- Consumes: `getValidTeamCounts` (Task 7), `FORMAT_LABEL["round-robin"]` (Task 7), `standings` (`bracket.ts:303`) and the existing `.standings` markup (`TournamentScreen.tsx:493-503`, styles at `src/index.css:2477-2513`), `gotoHubSeeded`/`hubButton` (A01/A11).
- Produces: a selectable 3- and 5-team round robin, and a standings view for it. No later task consumes it.

**Reusing, not rebuilding.** `standings(tournament)` at `bracket.ts:303` is already format-agnostic: it reads only `records(tournament)` (`:136`), which walks `t.matches`. The `.standings` markup already ships. Round robin adds **no new table and no new CSS**.

- [ ] **Step 1: Write the failing spec**

Create `e2e/tests/tournament/round-robin.spec.ts`:

```ts
/**
 * A 3-team night can split, so it must be able to run a tournament: round robin
 * every team plays every other once, and the standings crown the most wins.
 */
import { test, expect } from "@playwright/test";
import { gotoHubSeeded, hubButton, type SeedWorld } from "../../support/seed";

const ROLES = ["tank", "assassin", "mage", "marksman", "fighter"];

/** 15 players, three teams of five, all MLBB-eligible. */
const world = (): SeedWorld => ({
  communities: [{ id: "comm-rr", name: "Three Team Night", createdAt: 100 }],
  players: Array.from({ length: 15 }, (_, i) => ({
    id: `p${i + 1}`,
    communityId: "comm-rr",
    name: `Player ${i + 1}`,
    capabilities: [{
      disciplineId: "mlbb",
      attributeRatings: { mechanics: 4, "game-sense": 4, "hero-pool": 4, teamwork: 4 },
      eligibleRoles: ROLES,
      preferredRole: ROLES[i % 5],
    }],
  })),
  sessions: [],
  tournaments: [],
  squads: [],
  activeCommunityId: "comm-rr",
});

test("a 3-team round robin is selectable, runs, and crowns a champion from the standings", async ({ page }) => {
  await gotoHubSeeded(page, world(), "Games");

  await page.getByRole("button", { name: "New tournament" }).click();
  const modal = page.locator(".modal-card");
  await modal.locator("#tournament-name").fill("Three team night");
  await modal.locator(".chip", { hasText: "Mobile Legends" }).click();
  // 3 teams must be selectable for round robin. Before this task the chip row was [2,4,6,8].
  await modal.locator(".chip", { hasText: "Round robin" }).click();
  await expect(modal.locator(".chip", { hasText: /^3$/ })).toBeEnabled();
  await expect(modal.locator(".modal-section-hint", { hasText: /Round robin/ })).toBeVisible();
  await modal.locator(".chip", { hasText: /^3$/ }).click();
  await modal.locator(".btn-primary", { hasText: "Create" }).click();

  // The new tournament is a draft with no teams, so split three teams into it.
  await page.locator(".row", { hasText: "Three team night" }).click();
  await page.getByTestId("split-teams-cta").click();
  await expect(page.locator(".match-setup")).toBeVisible({ timeout: 10000 });
  await page.getByTestId("split-button").click();
  await expect(page.locator(".split-screen")).toBeVisible({ timeout: 15000 });
  await page.getByTestId("submit-tournament-squad").click();

  // Standings render: round robin reuses the Swiss table, so `.standings` exists.
  await expect(page.locator(".standings")).toBeVisible({ timeout: 10000 });
  await expect(page.locator(".standings-row")).toHaveCount(3);

  // Three teams round robin: three matches, one per round, each team resting once.
  const matches = page.locator(".bracket-match");
  await expect(matches).toHaveCount(3);

  // Record every match, always picking the first team, then the champion appears.
  for (let i = 0; i < 3; i++) {
    await page.locator(".bracket-match").nth(i).click();
    const record = page.locator(".modal-card");
    await expect(record).toBeVisible();
    await record.locator(".record-game .chip").first().click();
    await record.locator(".btn-primary", { hasText: "Save result" }).click();
    await expect(record).not.toBeVisible({ timeout: 5000 });
  }

  await expect(page.locator(".champ-name")).toBeVisible({ timeout: 5000 });
  await expect(page.locator(".champ-name")).not.toHaveText("");
});

test("a 2-team round robin is still refused, with the format's own message", async ({ page }) => {
  await gotoHubSeeded(page, world(), "Games");
  await page.getByRole("button", { name: "New tournament" }).click();
  const modal = page.locator(".modal-card");
  await modal.locator("#tournament-name").fill("Too small");
  await modal.locator(".chip", { hasText: "Mobile Legends" }).click();
  await modal.locator(".chip", { hasText: "Round robin" }).click();
  // 2 is outside round robin's counts, so the chip must be disabled.
  await expect(modal.locator(".chip", { hasText: /^2$/ })).toBeDisabled();
});
```

- [ ] **Step 2: Run the spec to verify it fails**

Run:
```bash
npx vite build && npx playwright test --config=e2e/playwright.config.ts tests/tournament/round-robin.spec.ts
```
Expected: FAIL — `getByText("Round robin")` resolves to 0 chips, because `FORMATS` at `GamesScreen.tsx:31` still lists three formats.

- [ ] **Step 3: Add the format to the create modal**

In `src/tournament/GamesScreen.tsx:31`:

```ts
const FORMATS: TournamentFormat[] = ["series", "single-elim", "swiss", "round-robin"];
```

Extend `TEAM_COUNTS` at `:36-40`:

```ts
/**
 * Team counts per format. The arrays are the format's own counts, in the order the
 * chips should read; `getValidTeamCounts` in tournament-validation.ts is the
 * validator's copy of the same rule, and the two are asserted equal by a test.
 */
const TEAM_COUNTS: Record<TournamentFormat, number[]> = {
  series: [2],
  "single-elim": [2, 4, 8],
  swiss: [4, 6, 8],
  "round-robin": [3, 4, 5, 6, 7, 8],
};
```

Write the test that keeps the two copies honest. Create `src/tournament/team-counts.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { validateTournamentSpec } from "./tournament-validation";
import { FUTSAL_DISCIPLINE } from "../domain/seed";
import type { TournamentFormat } from "../domain/types";

/**
 * `TEAM_COUNTS` in GamesScreen decides which chips are enabled; `getValidTeamCounts`
 * in tournament-validation decides what the validator accepts. A disagreement
 * produces a chip that looks fine and a create that fails, or the reverse, so the
 * two are asserted equal here rather than trusted to stay in step.
 */
const EXPECTED: Record<TournamentFormat, number[]> = {
  series: [2],
  "single-elim": [2, 4, 8],
  swiss: [4, 6, 8],
  "round-robin": [3, 4, 5, 6, 7, 8],
};

const accepts = (format: TournamentFormat, teamCount: number): boolean =>
  validateTournamentSpec(
    { name: "T", disciplineId: FUTSAL_DISCIPLINE.id, format, seriesLength: 3, teamCount },
    FUTSAL_DISCIPLINE,
  ).every((issue) => issue.path !== "teamCount");

describe("team counts per format", () => {
  it.each(Object.keys(EXPECTED) as TournamentFormat[])("accepts exactly the documented counts for %s", (format) => {
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
      expect(accepts(format, n)).toBe(EXPECTED[format].includes(n));
    }
  });

  it("no longer accepts a 3- or 5-team series, single-elim or swiss night", () => {
    expect(accepts("series", 3)).toBe(false);
    expect(accepts("swiss", 3)).toBe(false);
    expect(accepts("single-elim", 5)).toBe(false);
  });

  it("accepts 3 and 5 teams for round robin, which is the size that dead-ended before", () => {
    expect(accepts("round-robin", 3)).toBe(true);
    expect(accepts("round-robin", 5)).toBe(true);
  });
});
```

Run: `npx vitest run src/tournament/team-counts.test.ts`
Expected: PASS — 6 passed. This is the assertion that the two copies agree, so a later edit to one fails here.

- [ ] **Step 4: Stop mis-routing 3- and 5-team squads into Swiss**

In `src/tournament/GamesScreen.tsx:62-65`, the prefill chain becomes:

```ts
    // 3- and 5-team squads used to prefill as Swiss, which validation then rejected,
    // so the squad dead-ended. Round robin is the format that accepts them.
    const squadFormat: TournamentFormat =
      prefill.teamCount === 2 ? "series"
      : TEAM_COUNTS["single-elim"].includes(prefill.teamCount) ? "single-elim"
      : prefill.teamCount === 6 ? "swiss"
      : prefill.teamCount >= 3 && prefill.teamCount <= 8 ? "round-robin"
      : "swiss";
```

Preserved exactly: 2 → `series`, 4 and 8 → `single-elim`, 6 → `swiss`.

- [ ] **Step 5: Make 3 and 5 selectable, and explain byes**

In `src/tournament/GamesScreen.tsx:334`, the chip array stops being hard-coded and derives from the count table, so it cannot drift again:

```tsx
                {[2, 3, 4, 5, 6, 7, 8].map((n) => {
```

The hint at `:354-358` gains the round-robin line, and the byes are explained where the count is chosen because a player will ask:

```tsx
              <p className="modal-section-hint">
                {format === "series" && "Series: 2 teams only."}
                {format === "single-elim" && "Single elimination: 2, 4, or 8 teams."}
                {format === "swiss" && "Swiss: 4, 6, or 8 teams."}
                {format === "round-robin" && "Round robin: 3 to 8 teams."}
              </p>
              {format === "round-robin" && teamCount % 2 === 1 && (
                <p className="modal-section-hint">
                  {teamCount} teams means one team sits out each round. Every team rests once.
                </p>
              )}
```

The preview at `:374-378` gains the round count and the plain-language rule:

```tsx
              {format === "round-robin" && ` · ${teamCount % 2 === 0 ? teamCount - 1 : teamCount} rounds · every team plays every other`}
```

- [ ] **Step 6: Render the standings for round robin**

In `src/tournament/TournamentScreen.tsx:359-363`:

```tsx
          {tournament.format === "swiss" || tournament.format === "round-robin" ? (
            <StandingsView tournament={tournament} onMatch={setRecording} />
          ) : (
            <BracketView tournament={tournament} onMatch={setRecording} />
          )}
```

`StandingsView` (`:482-520`) is unchanged. It already renders whatever rounds the tournament has, and `standings(tournament)` is already format-agnostic, so a round-robin tournament renders three rows and one `.swiss-round` block per round with no new code and no new CSS.

- [ ] **Step 7: Run the spec to verify it passes**

Run:
```bash
npx vite build && npx playwright test --config=e2e/playwright.config.ts tests/tournament/round-robin.spec.ts
```
Expected: PASS — 2 passed.

- [ ] **Step 8: Prove the existing tournament specs still pass, then commit**

Run:
```bash
npx playwright test --config=e2e/playwright.config.ts tests/tournament/create.spec.ts tests/tournament/draft.spec.ts
```
Expected: PASS — no existing tournament spec changed behaviour. (A01 has already re-anchored these to `hubButton`; if they are still red, the prerequisite phase has not landed.)

Run: `npx vitest run`
Expected: exit 0, and `src/tournament/bracket.test.ts`'s pre-existing assertions are among the passes.

```bash
git add src/tournament/GamesScreen.tsx src/tournament/TournamentScreen.tsx src/tournament/team-counts.test.ts e2e/tests/tournament/round-robin.spec.ts
git commit -m "feat(tournament): offer round robin for 3 to 8 teams, byes explained"
```

---

### Task 9: Self-hosted fonts

**Files:**
- Create: `public/fonts/outfit-latin.woff2`, `public/fonts/outfit-latin-ext.woff2`, `public/fonts/familjen-grotesk-latin.woff2`, `public/fonts/familjen-grotesk-latin-ext.woff2`, `public/fonts/OFL.txt`
- Create: `src/fonts.css`
- Modify: `src/tokens.css:1-7` (one added `@import`)
- Modify: `index.html:25-30`, `app/index.html:7-12`, `public/404.html:7-12`

**Interfaces:**
- Consumes: nothing in code. `src/index.css:2` and `src/landing.css:7` already import `./tokens.css`, so one added `@import` reaches both documents.
- Produces: the four font files at `/fonts/*.woff2`, which Task 10's icons draw from and Task 11's worker precaches.

**Family names stay byte-identical**: `"Outfit"` and `"Familjen Grotesk"`. `e2e/tests/community/community.spec.ts:21-26` asserts the computed family contains `Familjen Grotesk` and the weight is `600`. No existing stylesheet declaration changes.

- [ ] **Step 1: Download the four subsets and verify them**

`public/` is not gitignored, so the files are committed. The `User-Agent` matters: Chrome is served woff2; a bot UA is served TTF.

```bash
mkdir -p public/fonts
UA="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
curl -s -A "$UA" -o public/fonts/outfit-latin.woff2 \
  "https://fonts.gstatic.com/s/outfit/v15/QGYvz_MVcBeNP4NJtEtq.woff2"
curl -s -A "$UA" -o public/fonts/outfit-latin-ext.woff2 \
  "https://fonts.gstatic.com/s/outfit/v15/QGYvz_MVcBeNP4NJuktqQ4E.woff2"
curl -s -A "$UA" -o public/fonts/familjen-grotesk-latin.woff2 \
  "https://fonts.gstatic.com/s/familjengrotesk/v11/Qw3GZR9ZHiDnImG6-NEMQ41wby8WbHoEjw.woff2"
curl -s -A "$UA" -o public/fonts/familjen-grotesk-latin-ext.woff2 \
  "https://fonts.gstatic.com/s/familjengrotesk/v11/Qw3GZR9ZHiDnImG6-NEMQ41wby8WbHQEj6M7.woff2"
sha256sum public/fonts/*.woff2
```

Expected output, in this order (`ls` orders them alphabetically, so compare by name):

```
c53f18ec…  public/fonts/familjen-grotesk-latin-ext.woff2
414d5dfe…  public/fonts/familjen-grotesk-latin.woff2
0f53d1c0…  public/fonts/outfit-latin-ext.woff2
6c18d579…  public/fonts/outfit-latin.woff2
```

Sizes: `familjen-grotesk-latin-ext.woff2` 15,468 B; `familjen-grotesk-latin.woff2` 18,916 B; `outfit-latin-ext.woff2` 14,808 B; `outfit-latin.woff2` 32,292 B. Total ≈ 81 kB. Verify with `wc -c public/fonts/*.woff2`.

Any mismatch means Google has republished the file; stop and fetch the current URLs from `https://fonts.googleapis.com/css2?family=Outfit:wght@100..900&family=Familjen+Grotesk:wght@400..700&display=swap` with the Chrome UA, then update this step and the sizes in the plan.

- [ ] **Step 2: Add the licence text**

Both families are SIL OFL 1.1 (`google/fonts` `METADATA.pb`: Outfit `license: "OFL"`, copyright *The Outfit Project Authors*; Familjen Grotesk `license: "OFL"`, copyright *The Familjen Grotesk Project Authors*), so self-hosting is legally clean and the licence ships alongside.

```bash
curl -s -A "Mozilla/5.0" -o public/fonts/OFL.txt "https://openfontlicense.org/documents/OFL.txt"
head -3 public/fonts/OFL.txt
wc -c public/fonts/OFL.txt
```

Expected: the head is `Copyright (c) <dates>, <Copyright Holder> (<URL|email>),` / `with Reserved Font Name <Reserved Font Name>.`; the file is 4,599 bytes.

- [ ] **Step 3: Declare the faces**

Create `src/fonts.css`. Each file is **one** variable font covering its whole weight axis, so there is one rule per family per subset, two per family, four total. Outfit spans 100–900; Familjen Grotesk spans 400–700.

```css
/* Self-hosted type. Both families are SIL OFL 1.1 (see public/fonts/OFL.txt).
   One variable file per family per subset, so one rule covers the whole weight
   axis. Family names are load-bearing: src/index.css:13, :24 and src/landing.css:21
   name "Outfit" and "Familjen Grotesk", and community.spec.ts asserts the computed
   family. Do not rename them. */

@font-face {
  font-family: "Outfit";
  font-style: normal;
  font-weight: 100 900;
  font-display: swap;
  src: url("/fonts/outfit-latin-ext.woff2") format("woff2-variations"),
       url("/fonts/outfit-latin-ext.woff2") format("woff2");
  unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF;
}
@font-face {
  font-family: "Outfit";
  font-style: normal;
  font-weight: 100 900;
  font-display: swap;
  src: url("/fonts/outfit-latin.woff2") format("woff2-variations"),
       url("/fonts/outfit-latin.woff2") format("woff2");
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
@font-face {
  font-family: "Familjen Grotesk";
  font-style: normal;
  font-weight: 400 700;
  font-display: swap;
  src: url("/fonts/familjen-grotesk-latin-ext.woff2") format("woff2-variations"),
       url("/fonts/familjen-grotesk-latin-ext.woff2") format("woff2");
  unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF;
}
@font-face {
  font-family: "Familjen Grotesk";
  font-style: normal;
  font-weight: 400 700;
  font-display: swap;
  src: url("/fonts/familjen-grotesk-latin.woff2") format("woff2-variations"),
       url("/fonts/familjen-grotesk-latin.woff2") format("woff2");
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
```

- [ ] **Step 4: Reach both documents with one line**

In `src/tokens.css`, add the import as the file's first statement, above the existing header comment's token block:

```css
@import "./fonts.css";

/* Design system: "Paper & Pencil" (per DESIGN.md). Warm paper, quiet ink, one amber accent for live action. */
```

`src/index.css:2` is `@import "./tokens.css";` and `src/landing.css:7` is the same, so one line reaches both documents. Neither Phase B's `src/landing.css` nor Phase C's `src/index.css` is written to.

Verify the nested import survives the build with the absolute font URL intact:

```bash
npx vite build && grep -o '/fonts/[a-z-]*\.woff2' dist/assets/*.css | sort -u
```
Expected: four distinct `/fonts/*.woff2` URLs. Vite flattens the nested `@import` into the entry's stylesheet and leaves an absolute URL untouched.

- [ ] **Step 5: Replace the three CDN blocks**

In `index.html`, replace `:25-30` (the two `preconnect` hints and the `css2` link) with two preloads, so first paint does not regress: one `preconnect` is replaced one-for-one by one `preload`.

```html
    <link
      rel="preload"
      as="font"
      type="font/woff2"
      crossorigin
      href="/fonts/outfit-latin.woff2"
    />
    <link
      rel="preload"
      as="font"
      type="font/woff2"
      crossorigin
      href="/fonts/familjen-grotesk-latin.woff2"
    />
```

Apply the same replacement to `app/index.html:7-12` and `public/404.html:7-12`. The three files' surrounding markup is untouched.

Run:
```bash
grep -rn "fonts.googleapis\|fonts.gstatic\|preconnect" index.html app/index.html public/404.html
```
Expected: **no output**.

- [ ] **Step 6: Verify both documents load the faces and reach no third party**

Run:
```bash
npx vite build && npx playwright test --config=e2e/playwright.config.ts tests/community/community.spec.ts
```
Expected: PASS — the computed family is `Familjen Grotesk` at weight `600`, now from a local file.

Then confirm the build serves the fonts with the right type:

```bash
npm run preview & sleep 3
curl -sI http://localhost:4173/fonts/outfit-latin.woff2 | grep -i "content-type\|content-length"
```
Expected: `Content-Type: font/woff2` and `Content-Length: 32292`. Kill the preview afterwards.

- [ ] **Step 7: Commit**

```bash
git add public/fonts src/fonts.css src/tokens.css index.html app/index.html public/404.html
git commit -m "feat(pwa): self-host Outfit and Familjen Grotesk, no third party at runtime"
```

---

### Task 10: The manifest and the icons

**Files:**
- Create: `scripts/make-icons.mjs`
- Create: `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/icons/maskable-512.png`
- Create: `public/manifest.webmanifest`
- Modify: `index.html`, `app/index.html` (manifest link, `theme-color`, icon links)

**Interfaces:**
- Consumes: `public/fonts/outfit-latin.woff2` from Task 9.
- Produces: `/manifest.webmanifest` and `/icons/*.png`, both of which Task 11's worker precaches.

- [ ] **Step 1: Write the icon generator**

`brand/3-icon.svg` carries a `@font-face` pointing at `fonts.gstatic.com`, so drawing it as-is with no network renders a system fallback glyph. The script swaps that rule for the self-hosted woff2 and **refuses to write a file if the face did not load**, so a fallback "3" can never ship.

Create `scripts/make-icons.mjs`:

```js
/**
 * Draw the PWA icons from the brand icon mark (brand/3-icon.svg) into public/icons/.
 *
 * The source SVG references a Google Fonts @font-face, which is unreachable offline;
 * this script swaps it for the self-hosted woff2 the app ships, so the glyph is the
 * real Outfit "3" and not a system fallback. It refuses to write a file whose face
 * failed to load, because a fallback glyph is the one failure a screenshot would hide.
 *
 * Usage: node scripts/make-icons.mjs   (requires public/fonts/outfit-latin.woff2)
 */
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

const ROOT = import.meta.dirname;
const OUT = resolve(ROOT, "../public/icons");
const PAPER = "#FAF8F5";
/** The squared icon variant, with the remote @font-face replaced by the shipped file. */
async function iconMarkup() {
  const svg = await readFile(resolve(ROOT, "../brand/3-icon.svg"), "utf8");
  const font = await readFile(resolve(ROOT, "../public/fonts/outfit-latin.woff2"));
  return svg.replace(
    /@font-face\{[^}]*\}/,
    `@font-face{font-family:'Outfit';src:url(data:font/woff2;base64,${font.toString("base64")}) format('woff2');font-weight:100 900;font-display:block}`,
  );
}

await mkdir(OUT, { recursive: true });
const mark = await iconMarkup();
const browser = await chromium.launch();
try {
  const targets = [
    { file: "icon-192.png", size: 192, pad: 0 },
    { file: "icon-512.png", size: 512, pad: 0 },
    // Maskable icons are cropped to a shape, so the glyph must sit inside the
    // 80% safe zone. Padding by 10% keeps it there.
    { file: "maskable-512.png", size: 512, pad: 0.1 },
  ];
  for (const target of targets) {
    const inner = Math.round(target.size * (1 - target.pad * 2));
    const offset = Math.round((target.size - inner) / 2);
    const page = await browser.newPage({ viewport: { width: target.size, height: target.size } });
    await page.setContent(
      `<!doctype html><html><body style="margin:0;background:${PAPER};width:${target.size}px;height:${target.size}px">` +
        `<div style="position:absolute;left:${offset}px;top:${offset}px;width:${inner}px;height:${inner}px">` +
        mark.replace(/width="128" height="128"/, `width="${inner}" height="${inner}"`) +
        `</div></body></html>`,
      { waitUntil: "load" },
    );
    await page.evaluate(() => document.fonts.ready);
    const loaded = await page.evaluate(() => document.fonts.check("600 88px Outfit"));
    if (!loaded) throw new Error(`Outfit did not load; refusing to draw a fallback glyph (${target.file})`);
    const png = await page.screenshot({ clip: { x: 0, y: 0, width: target.size, height: target.size } });
    await writeFile(resolve(OUT, target.file), png);
    console.log(`${target.file}  ${target.size}x${target.size}  ${png.length} bytes`);
    await page.close();
  }
} finally {
  await browser.close();
}
```

- [ ] **Step 2: Generate and verify the icons**

Run: `node scripts/make-icons.mjs`
Expected:
```
icon-192.png  192x192  <about 2,600> bytes
icon-512.png  512x512  <about 7,000> bytes
maskable-512.png  512x512  <about 6,100> bytes
```

Verify the brand colours are actually painted, not an empty sheet. `scripts/analyze-png.mjs` renders each PNG as a histogram:

Run: `node scripts/analyze-png.mjs public/icons/icon-512.png 40`
Expected: the exact-colour list leads with `#faf8f5` at roughly 95% and includes `#c2410c` (the amber top half of the "3") and `#57534e` (the stone bottom half). If either brand colour is absent, the glyph did not render — re-check that `public/fonts/outfit-latin.woff2` exists and that the script's `document.fonts.check` guard did not throw.

- [ ] **Step 3: Write the manifest**

Create `public/manifest.webmanifest`:

```json
{
  "name": "comp3tive",
  "short_name": "comp3tive",
  "description": "Split a roster into balanced teams, then run the tournament.",
  "start_url": "/app/",
  "scope": "/",
  "display": "standalone",
  "background_color": "#FAF8F5",
  "theme_color": "#C2410C",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

`scope` is `/` so one installation covers both `/` and `/app/`, matching the two-document layout `vite.config.ts`'s `appType: "mpa"` and `wrangler.jsonc`'s `not_found_handling: "404-page"` describe.

- [ ] **Step 4: Link it from both documents**

In `index.html` and `app/index.html`, add inside `<head>`:

```html
    <link rel="manifest" href="/manifest.webmanifest" />
    <meta name="theme-color" content="#C2410C" />
    <link rel="icon" href="/icons/icon-192.png" />
    <link rel="apple-touch-icon" href="/icons/icon-192.png" />
```

- [ ] **Step 5: Verify the manifest resolves on both documents**

Run:
```bash
npx vite build && npx playwright test --config=e2e/playwright.config.ts tests/pwa/offline.spec.ts
```
Expected: the spec does not exist yet (Task 12 creates it), so this run reports no tests found. That is expected here. Instead confirm the files are emitted:

```bash
ls dist/manifest.webmanifest dist/icons
npx vitest run
```
Expected: the manifest and three PNGs are present in `dist/`; the unit suite exits 0.

- [ ] **Step 6: Commit**

```bash
git add scripts/make-icons.mjs public/icons public/manifest.webmanifest index.html app/index.html
git commit -m "feat(pwa): a manifest with real icons drawn from the brand mark"
```

---

### Task 11: The service worker, versioned to the build

**Files:**
- Create: `public/sw.js`
- Modify: `vite.config.ts` (one added `plugins[]` entry)
- Modify: `public/_headers` (four added rules)
- Modify: `src/main.tsx`
- Modify: `index.html` (the restored trust row and description), `e2e/tests/landing/landing.spec.ts` (the trust assertions)

**Interfaces:**
- Consumes: `dist/` contents from the build (the hashed `/assets/*` URLs, `/fonts/*.woff2`, `/icons/*`).
- Produces: `/sw.js` at scope `/`, and `src/main.tsx`'s registration. Task 12 proves offline and the stale-deploy path.

**Why the version is written by the build.** Cloudflare's static-assets default is `public, max-age=0, must-revalidate` plus a content-hash `ETag`, so a hashed `sw.js` would not be safely cached without an explicit rule — which is exactly why `/sw.js` gains `no-cache` below. The cache name is `comp3tive-<version>`, where `<version>` is a hash of the emitted precache list, so a deploy that changes any asset changes the string.

- [ ] **Step 1: Write the worker**

Create `public/sw.js`. It is a classic worker: no imports, no bundler step, no workbox. The two placeholders are replaced by the build; each appears exactly once.

```js
/**
 * comp3tive service worker — classic worker, no imports, no bundler, no workbox.
 *
 * The two placeholders below are replaced at build time by the `service-worker-build`
 * plugin in vite.config.ts. `__BUILD_VERSION__` is a hash of the emitted asset list,
 * so a deploy that changes any asset changes the cache name, which is what stops a
 * stale worker from pinning users to an old build.
 *
 * Scope is `/`, so one worker covers both documents: `/` (the Landing Page) and
 * `/app/` (the app). See docs/adr/0006-landing-page-and-app-paths.md.
 */
const VERSION = "__BUILD_VERSION__";
/** Hashed asset URLs the build emitted, plus the fonts and icons. */
const PRECACHE_ASSETS = __PRECACHE_ASSETS__;
const CACHE = "comp3tive-" + VERSION;
/** The documents themselves, precached under their canonical URLs. */
const DOCUMENTS = ["/", "/app/", "/404.html", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(DOCUMENTS.concat(PRECACHE_ASSETS)))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

/** Cache-first for immutable build output, fonts and icons. */
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

/** Network-first for documents, with the precached copy as the offline fallback. */
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const url = new URL(request.url);
    const cached =
      (await caches.match(request)) || (await caches.match(url.pathname)) || (await caches.match("/404.html"));
    if (cached) return cached;
    throw err;
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  // Never intercept another origin: the app must reach no third party anyway.
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }
  if (
    url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/fonts/") ||
    url.pathname.startsWith("/icons/")
  ) {
    event.respondWith(cacheFirst(request));
  }
});
```

- [ ] **Step 2: Write the build hook that fills it in**

In `vite.config.ts`, the plugin array at `plugins: [react()]` becomes `plugins: [react(), serviceWorkerBuild()]`, and the plugin is defined above `defineConfig`. The `closeBundle` hook is the correct point: Vite copies `publicDir` into `outDir` in `prepareOutDir`, which runs **before** `bundle.write()`, so by `closeBundle` both the copied `sw.js` and the emitted hashed assets are on disk. This was verified against the installed Vite.

```ts
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

/** Replace every occurrence, then prove none survived. */
function substitute(source: string, token: string, value: string): string {
  if (!source.includes(token)) throw new Error(`service-worker-build: sw.js has no ${token} placeholder.`);
  const next = source.split(token).join(value);
  if (next.includes(token)) throw new Error(`service-worker-build: ${token} survived substitution.`);
  return next;
}

/**
 * Write the emitted asset list and a build-derived version into dist/sw.js.
 *
 * The precache list is generated, never hand-maintained: a hand-written list would
 * drift from the hashed filenames and 404 on every offline fetch. The version is a
 * hash of that list, so any asset change produces a new cache name and the old cache
 * is purged on activate.
 */
function serviceWorkerBuild() {
  return {
    name: "service-worker-build",
    apply: "build" as const,
    closeBundle() {
      const outDir = resolve(import.meta.dirname, "dist");
      const swPath = join(outDir, "sw.js");
      if (!existsSync(swPath)) {
        throw new Error("service-worker-build: dist/sw.js is missing; public/sw.js was not copied.");
      }
      const list = (dir: string, keep: (name: string) => boolean = () => true) =>
        existsSync(join(outDir, dir))
          ? readdirSync(join(outDir, dir)).filter(keep).map((name) => `/${dir}/${name}`).sort()
          : [];
      const assets = list("assets");
      if (assets.length === 0) {
        throw new Error("service-worker-build: no hashed assets were emitted, so the precache list would be empty.");
      }
      const precache = [...assets, ...list("fonts", (n) => n.endsWith(".woff2")), ...list("icons")];
      const version = createHash("sha256").update(precache.join("\n")).digest("hex").slice(0, 12);
      let source = readFileSync(swPath, "utf8");
      source = substitute(source, "__BUILD_VERSION__", version);
      source = substitute(source, "__PRECACHE_ASSETS__", JSON.stringify(precache));
      writeFileSync(swPath, source);
      console.log(`  sw.js  version ${version}  precache ${precache.length} urls`);
    },
  };
}
```

`rollupOptions.input` and `appType: "mpa"` are **not** touched: this is one added entry in `plugins[]`.

- [ ] **Step 3: Verify the build writes and the worker is valid**

Run: `npx vite build`
Expected: exit 0, and a line like `sw.js  version <12 hex chars>  precache <n> urls`.

Run:
```bash
grep -c "__BUILD_VERSION__\|__PRECACHE_ASSETS__" dist/sw.js
node --check dist/sw.js
head -14 dist/sw.js | tail -4
```
Expected: `0` (every placeholder replaced); `node --check` exits 0 (the emitted file is valid JavaScript); the four lines show `const VERSION = "<12 hex>";` and a JSON array of `/assets/*`, `/fonts/*` and `/icons/*` URLs.

- [ ] **Step 4: Extend `_headers` coherently**

Replace `public/_headers` with the three existing rules **byte-identical** plus four new ones:

```
/assets/*
  Cache-Control: public, max-age=31536000, immutable

/*.html
  Cache-Control: no-cache

/
  Cache-Control: no-cache

/fonts/*
  Cache-Control: public, max-age=31536000, immutable

/icons/*
  Cache-Control: public, max-age=31536000, immutable

/manifest.webmanifest
  Cache-Control: no-cache

/sw.js
  Cache-Control: no-cache
```

`/sw.js`'s `no-cache` is the one that stops a new deploy from being pinned to an old worker: Workers parses this file from the static asset directory, and the three original rules are untouched.

Run:
```bash
git diff public/_headers | grep -E "^-[^-]" | grep -v "^---"
```
Expected: no output for the three original rules' lines. Then confirm the file is copied and served:

```bash
npx vite build && npm run preview & sleep 3
curl -sI http://localhost:4173/sw.js | grep -i "content-type"
curl -s http://localhost:4173/_headers | head -4
```
Expected: `Content-Type: text/javascript` for the worker. Note that `vite preview` does **not** apply `_headers` (it is a Cloudflare/Sites convention), so the cache header itself is verified in production or by reading the file, not by curl against the preview server. Kill the preview afterwards.

- [ ] **Step 5: Register the worker, additively**

In `src/main.tsx`, add the registration without touching the render call or A05's `<ErrorBoundary>` wrapper:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Registered on `load` and after the error boundary, additively. A failed
// registration is silent: offline support is an enhancement, and a browser that
// refuses the worker must not show an error.
window.addEventListener("load", () => {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("/sw.js").catch(() => undefined);
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
```

(The `ErrorBoundary` import and wrapper are A05's; if C27 or A05 left `src/main.tsx` otherwise shaped, keep their lines and add only the `load` listener.)

- [ ] **Step 6: Restore the offline claim, exactly as B14's handoff specifies**

B14 deleted the sentence and left a note; D restores it because it is now true.

In `index.html`, the `.landing-trust` list at `:180-184` becomes three rows in this order:

```html
          <ul class="landing-trust">
            <li>The gap is the proven minimum for a two-team split.</li>
            <li>Works with no signal. The court has no wifi.</li>
            <li>Your data stays on your device. No account, no server.</li>
          </ul>
```

The `<meta name="description">` at `:7-10` regains the leading `Works offline, `:

```html
    <meta
      name="description"
      content="comp3tive splits your group into balanced teams with the smallest possible strength gap, then runs the tournament. Works offline, no account."
    />
```

In `e2e/tests/landing/landing.spec.ts`, the trust assertions become exactly:

```ts
    const trust = page.locator(".landing-trust li");
    await expect(trust).toHaveCount(3);
    await expect(trust).toContainText([
      "proven minimum for a two-team split",
      "no signal",
      "stays on your device",
    ]);
```

The count stays 3, and no other landing copy changes.

- [ ] **Step 7: Verify the claim the page now makes**

Run:
```bash
npx vite build && npx playwright test --config=e2e/playwright.config.ts tests/landing/landing.spec.ts
```
Expected: PASS — the trust assertions read the three restored rows, and the page contains no `fonts.googleapis.com` reference.

- [ ] **Step 8: Commit**

```bash
git add public/sw.js public/_headers vite.config.ts src/main.tsx index.html e2e/tests/landing/landing.spec.ts
git commit -m "feat(pwa): a versioned service worker covering both documents, offline claim restored"
```

---

### Task 12: Prove offline, and prove a new deploy escapes the old cache

**Files:**
- Create: `e2e/tests/pwa/offline.spec.ts`

**Interfaces:**
- Consumes: everything Task 11 produced: `/sw.js` with its version in the cache name, `/manifest.webmanifest`, the four fonts, `src/main.tsx`'s registration.
- Produces: no code. This is the phase gate on the roadmap's top-named D risk: stale assets pinning users to an old build.

**How the stale-deploy spec works, verified experimentally.** The deploy is simulated by
**rewriting `dist/sw.js` on disk**, which is what a deploy actually does and which
`vite preview` re-reads per request (verified: `curl` against the running preview returns the
new body immediately after the file changes). `page.route()` on `**/sw.js` was tried and
**does not work** — it must not be used. Measured: with a routed handler the browser received
the new body, but the route log recorded a single fetch, the replacement worker reached
`waiting` and never `activated`, and the old cache name survived for the full 9-second poll.
The disk swap reaches `activated` and purges the old cache name in about one second. The spec
therefore writes the file, which also means it needs a real build and must not run concurrently
with another spec touching `dist/sw.js`; `workers: 1` in `e2e/playwright.config.ts` already
guarantees that.

- [ ] **Step 1: Write the spec**

Create `e2e/tests/pwa/offline.spec.ts`:

```ts
/**
 * Offline, for real: both documents open with no network, no request leaves the
 * origin, and a new deploy escapes the old cache.
 *
 * The baseURL points at `/app/`; the Landing Page is reached by absolute path, the
 * same convention e2e/tests/landing/landing.spec.ts uses.
 */
import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { gotoSeeded, gotoHubSeeded, type SeedWorld } from "../../support/seed";

const world = (): SeedWorld => ({
  communities: [{ id: "comm-pwa", name: "Offline Crew", createdAt: 100 }],
  players: [],
  sessions: [],
  tournaments: [],
  squads: [],
  activeCommunityId: "comm-pwa",
});

/** Wait until a worker controls this page, so `offline` cannot race the install. */
async function waitForController(page: Page) {
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 15000 });
}

test("neither document reaches a host other than the origin", async ({ page }) => {
  const hosts = new Set<string>();
  page.on("request", (request) => hosts.add(new URL(request.url()).host));

  await page.goto("/app/", { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.goto("/", { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);

  const origin = new URL(page.url()).host;
  expect([...hosts].filter((h) => h !== origin)).toEqual([]);
});

test("the app opens with no network", async ({ page, context }) => {
  await gotoSeeded(page, world());
  await waitForController(page);

  await context.setOffline(true);
  await page.reload({ waitUntil: "load" });

  // The shell renders: the app document came from the precache.
  await expect(page.locator(".app")).toBeVisible({ timeout: 15000 });
  await expect(page.locator(".screen h1")).toHaveText("Dashboard");
  await context.setOffline(false);
});

test("the landing page opens with no network", async ({ page, context }) => {
  await page.goto("/", { waitUntil: "load" });
  await waitForController(page);

  await context.setOffline(true);
  await page.reload({ waitUntil: "load" });

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Pick the players. Get the fairest teams.");
  await context.setOffline(false);
});

test("a font is served from the cache with no network", async ({ page, context }) => {
  await page.goto("/app/", { waitUntil: "load" });
  await waitForController(page);
  await context.setOffline(true);

  const font = await page.evaluate(async () => {
    const response = await fetch("/fonts/outfit-latin.woff2");
    return { status: response.status, bytes: (await response.arrayBuffer()).byteLength };
  });
  expect(font.status).toBe(200);
  expect(font.bytes).toBe(32292);
  await context.setOffline(false);
});

test("a new deploy activates and purges the old cache", async ({ page, context }) => {
  await page.goto("/app/", { waitUntil: "load" });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await waitForController(page);

  const installed = await page.evaluate(() => caches.keys());
  expect(installed).toHaveLength(1);
  const staleCache = installed[0];
  expect(staleCache).toMatch(/^comp3tive-/);

  // Read the served worker, bump its version, and write it back: this is a deploy.
  const served = await readFile(new URL("../../dist/sw.js", import.meta.url), "utf8");
  const oldVersion = (served.match(/const VERSION = "([^"]+)"/) ?? [])[1];
  expect(oldVersion).toBeTruthy();
  await writeFile(
    new URL("../../dist/sw.js", import.meta.url),
    served.replace(`const VERSION = "${oldVersion}"`, 'const VERSION = "e2e-new-deploy"'),
    "utf8",
  );

  const after = await page.evaluate(async (stale: string) => {
    const registration = await navigator.serviceWorker.getRegistration();
    await registration.update();
    // The replacement installs, activates (it calls skipWaiting), and purges.
    for (let i = 0; i < 100; i++) {
      const keys = await caches.keys();
      if (keys.includes("comp3tive-e2e-new-deploy") && !keys.includes(stale)) return keys;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return caches.keys();
  }, staleCache);
  expect(after).toEqual(["comp3tive-e2e-new-deploy"]);
});
```

`readFile`/`writeFile` come from `node:fs/promises`, added to the spec's imports:

```ts
import { readFile, writeFile } from "node:fs/promises";
```

- [ ] **Step 2: Run the spec**

Run:
```bash
npx vite build && npx playwright test --config=e2e/playwright.config.ts tests/pwa/offline.spec.ts
```
Expected: PASS — 5 passed.

If the origin spec fails, a third-party host is still referenced; `grep -rn "https://" index.html app/index.html public/404.html src/` and remove it. If the offline specs fail, the precache list is missing a URL — read `dist/sw.js`'s `PRECACHE_ASSETS` and compare it against `ls dist/assets dist/fonts dist/icons`.

- [ ] **Step 3: Commit**

```bash
git add e2e/tests/pwa/offline.spec.ts
git commit -m "test(pwa): prove both documents open offline and a deploy purges the old cache"
```

---

### Task 13: The durability hook

**Files:**
- Create: `src/shell/useDurability.ts`
- Test: `src/shell/useDurability.test.ts`

**Interfaces:**
- Consumes: nothing. It follows the shape of C26's `src/shell/usePreferences.ts` (`useStoredPref`, "already wraps `localStorage` in try/catch") and the `tb-` key prefix (`tb-theme`, `tb-layout`, `tb-rail`, `tb-community`).
- Produces: `useDurability({ playerCount }): { persisted: boolean | null; granted: boolean | null; lastExportAt: number | null; shouldNudge: boolean; dismissNudge: () => void; recordExport: () => void }`. Task 14 renders it.

**The trigger, decided:** the nudge appears when **all three** hold — (a) `persist()` was refused or `navigator.storage` is absent, (b) the roster holds at least 5 players, and (c) no export has happened or the last was more than 14 days ago. Before 5 records there is nothing worth losing, so a prompt is noise; after a loss it is useless; and mid-session, getting teams onto a court, is the failure mode to avoid.

- [ ] **Step 1: Write the failing test**

Create `src/shell/useDurability.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { useDurability } from "./useDurability";

/** The node test environment has no DOM, so the hook's shape is proven by a static render. */
function Probe({ playerCount }: { playerCount: number }) {
  const d = useDurability({ playerCount });
  return createElement("span", {
    "data-persisted": String(d.persisted),
    "data-granted": String(d.granted),
    "data-last-export": String(d.lastExportAt),
    "data-should-nudge": String(d.shouldNudge),
  });
}

describe("useDurability", () => {
  it("returns without throwing and reports unknown persistence when navigator.storage is absent", () => {
    expect((navigator as unknown as { storage?: unknown }).storage).toBeUndefined();
    const html = renderToStaticMarkup(createElement(Probe, { playerCount: 6 }));
    // Effects do not run in a static render, so persistence is unknown here, not refused.
    expect(html).toContain('data-persisted="null"');
  });

  it("does not throw when navigator.storage exists but has no persist()", () => {
    Object.defineProperty(navigator, "storage", { value: {}, configurable: true });
    expect(() => renderToStaticMarkup(createElement(Probe, { playerCount: 6 }))).not.toThrow();
    Object.defineProperty(navigator, "storage", { value: undefined, configurable: true });
  });

  it("never conflates unknown with refused", () => {
    // `null` is "this browser did not answer"; only `false` is a refusal.
    const html = renderToStaticMarkup(createElement(Probe, { playerCount: 6 }));
    expect(html).toContain('data-persisted="null"');
    expect(html).not.toContain('data-persisted="false"');
  });

  it("never nudges while persistence is unknown, so an unanswered browser is not nagged", () => {
    expect(renderToStaticMarkup(createElement(Probe, { playerCount: 6 }))).toContain('data-should-nudge="false"');
  });

  it("never nudges on a small roster, because there is nothing worth losing", () => {
    expect(renderToStaticMarkup(createElement(Probe, { playerCount: 2 }))).toContain('data-should-nudge="false"');
  });

  it("has no last export before one has happened", () => {
    expect(renderToStaticMarkup(createElement(Probe, { playerCount: 6 }))).toContain('data-last-export="null"');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/shell/useDurability.test.ts`
Expected: FAIL — `Failed to resolve import "./useDurability"`.

- [ ] **Step 3: Write the hook**

Create `src/shell/useDurability.ts`:

```ts
import { useCallback, useEffect, useState } from "react";

const NUDGE_DISMISSED_KEY = "tb-export-nudge-dismissed";
const LAST_EXPORT_KEY = "tb-last-export";
/** Nothing worth losing below this many players, so a prompt would be noise. */
const MIN_PLAYERS_TO_NUDGE = 5;
/** A fortnight: long enough that the nudge is a reminder, not a nag. */
const NUDGE_AFTER_MS = 14 * 24 * 60 * 60 * 1000;

/** localStorage, wrapped: a blocked store degrades to in-memory rather than throwing. */
function readPref(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writePref(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage blocked; the in-memory value still drives this session */
  }
}

export interface DurabilityDeps {
  /** The active community's player count; the nudge needs to know there is something to lose. */
  playerCount: number;
}

export function useDurability({ playerCount }: DurabilityDeps): {
  persisted: boolean | null;
  granted: boolean | null;
  lastExportAt: number | null;
  shouldNudge: boolean;
  dismissNudge: () => void;
  recordExport: () => void;
} {
  /** null = unknown (before the promise settles, or no API in this browser). */
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [granted, setGranted] = useState<boolean | null>(null);
  const [dismissed, setDismissed] = useState<boolean>(() => readPref(NUDGE_DISMISSED_KEY) === "1");
  const [lastExportAt, setLastExportAt] = useState<number | null>(() => {
    const raw = readPref(LAST_EXPORT_KEY);
    if (raw === null) return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  });

  useEffect(() => {
    // Feature-detected, asked for exactly once, and silent on refusal: the user
    // cannot change the outcome, so there is nothing to report.
    const storage = typeof navigator === "undefined" ? undefined : navigator.storage;
    if (!storage?.persist) {
      setGranted(false);
      return;
    }
    let live = true;
    void storage.persist().then(
      (value) => {
        if (!live) return;
        setGranted(true);
        setPersisted(value);
      },
      () => {
        if (!live) return;
        setGranted(true);
        setPersisted(false);
      },
    );
    return () => {
      live = false;
    };
  }, []);

  const dismissNudge = useCallback(() => {
    setDismissed(true);
    writePref(NUDGE_DISMISSED_KEY, "1");
  }, []);

  const recordExport = useCallback(() => {
    const now = Date.now();
    setLastExportAt(now);
    writePref(LAST_EXPORT_KEY, String(now));
  }, []);

  // All three must hold. `persisted === null` is unknown, not a refusal, so a
  // browser that never answered is not nagged.
  const exportIsStale = lastExportAt === null || Date.now() - lastExportAt > NUDGE_AFTER_MS;
  const shouldNudge =
    !dismissed && persisted === false && playerCount >= MIN_PLAYERS_TO_NUDGE && exportIsStale;

  return { persisted, granted, lastExportAt, shouldNudge, dismissNudge, recordExport };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/shell/useDurability.test.ts`
Expected: PASS — 6 passed.

- [ ] **Step 5: Type-check, then commit**

Run: `npx tsc -b`
Expected: exit 0.

```bash
git add src/shell/useDurability.ts src/shell/useDurability.test.ts
git commit -m "feat(data): ask the browser to keep the data, and record when it was exported"
```

---

### Task 14: The nudge and the storage note

**Files:**
- Modify: `src/DashboardScreen.tsx:113-127` (the nudge row between the stat cards and the first teaser), the `Props` interface
- Modify: `src/shell/RosterScreen.tsx` (the `.durability-note` beside the `Export` button in `.roster-toolbar`)
- Modify: `src/App.tsx:412-424` (`handleExport` records the timestamp), the `<DashboardScreen …>` mount, the `<RosterScreen …>` mount
- Test: `e2e/tests/dashboard/nudge.spec.ts`

**Interfaces:**
- Consumes: `useDurability` from Task 13; `hubButton`/`gotoSeeded`/`SeedWorld` from `e2e/support/seed.ts`.
- Produces: `.nudge` and `.durability-note`. No later task consumes them.

**Two things this task must not break.** The stat cards are untouched: `.dashboard-stats` still renders exactly three `.tournament-meta-card.dashboard-stat` children labelled `Players`, `Saved squads`, `Tournaments`, so `e2e/tests/dashboard/dashboard.spec.ts:114-118` and `:221-224` stay green unchanged. And A09 owns untracking `playwright-report/` and `test-results/`; D does not duplicate that work.

- [ ] **Step 1: Write the failing spec**

Create `e2e/tests/dashboard/nudge.spec.ts`:

```ts
/**
 * The export nudge: appears only when it can help, and stays dismissed forever.
 */
import { test, expect } from "@playwright/test";
import { gotoSeeded, type SeedWorld } from "../../support/seed";

const ROLES = ["tank", "assassin", "mage", "marksman", "fighter"];

/** A world with `n` players, no export record, and no dismissal recorded. */
const world = (n: number): SeedWorld => ({
  communities: [{ id: "comm-nudge", name: "Nudge Crew", createdAt: 100 }],
  players: Array.from({ length: n }, (_, i) => ({
    id: `p${i + 1}`,
    communityId: "comm-nudge",
    name: `Player ${i + 1}`,
    capabilities: [{
      disciplineId: "mlbb",
      attributeRatings: { mechanics: 4, "game-sense": 4, "hero-pool": 4, teamwork: 4 },
      eligibleRoles: ROLES,
      preferredRole: ROLES[i % 5],
    }],
  })),
  sessions: [],
  tournaments: [],
  squads: [],
  activeCommunityId: "comm-nudge",
});

test("a roster worth losing, with no export and no persistence, gets one nudge", async ({ page }) => {
  await gotoSeeded(page, world(6));
  // Chromium refuses persist() for an uninstalled origin, so this is the refused case.
  await expect(page.locator(".nudge")).toBeVisible({ timeout: 10000 });
  await expect(page.locator(".nudge")).toContainText("This browser can clear your data. Export a backup and it can't.");
});

test("dismissing the nudge is permanent", async ({ page }) => {
  await gotoSeeded(page, world(6));
  const nudge = page.locator(".nudge");
  await expect(nudge).toBeVisible({ timeout: 10000 });

  await nudge.getByRole("button", { name: "Dismiss" }).click();
  await expect(nudge).toHaveCount(0);

  await page.reload({ waitUntil: "load" });
  await expect(page.locator(".app")).toBeVisible({ timeout: 15000 });
  await expect(page.locator(".nudge")).toHaveCount(0);
});

test("a roster too small to lose never gets a nudge", async ({ page }) => {
  await gotoSeeded(page, world(2));
  await expect(page.locator(".app")).toBeVisible({ timeout: 15000 });
  await expect(page.locator(".nudge")).toHaveCount(0);
  // Give the effect time to settle before concluding the nudge is absent.
  await page.waitForTimeout(1000);
  await expect(page.locator(".nudge")).toHaveCount(0);
});

test("a recent export suppresses the nudge", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("tb-last-export", String(Date.now()));
  });
  await gotoSeeded(page, world(6));
  await expect(page.locator(".app")).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(1000);
  await expect(page.locator(".nudge")).toHaveCount(0);
});

test("the stat cards are untouched by the nudge", async ({ page }) => {
  await gotoSeeded(page, world(6));
  await expect(page.locator(".dashboard-stats")).toBeVisible({ timeout: 10000 });
  await expect(page.locator(".dashboard-stats .dashboard-stat")).toHaveCount(3);
  // The nudge sits between the stat cards and the teasers, so the cards keep their place.
  const nudgeY = await page.locator(".nudge").boundingBox();
  const statsY = await page.locator(".dashboard-stats").boundingBox();
  const teasersY = await page.locator(".dashboard-teasers").first().boundingBox();
  expect(nudgeY!.y).toBeGreaterThan(statsY!.y);
  expect(nudgeY!.y).toBeLessThan(teasersY!.y);
});

test("a browser with no storage API shows an unknown note and never errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, "storage", { get: () => undefined, configurable: true });
  });
  await gotoSeeded(page, world(6));
  await page.getByRole("button", { name: "Roster", exact: true }).click();
  await expect(page.locator(".durability-note")).toHaveText("Storage protection unknown in this browser. Keep a backup.");
  expect(errors).toEqual([]);
});
```

- [ ] **Step 2: Run the spec to verify it fails**

Run:
```bash
npx vite build && npx playwright test --config=e2e/playwright.config.ts tests/dashboard/nudge.spec.ts
```
Expected: FAIL — `.nudge` resolves to 0 elements in the first spec.

- [ ] **Step 3: Render the nudge on the Dashboard**

In `src/DashboardScreen.tsx`, add to the `Props` interface:

```tsx
  /** The durability nudge: shown only when the browser refused persistence and no
   *  recent backup exists. Null hides the row entirely. */
  nudge: { onDismiss: () => void } | null;
```

Add it to the destructured parameters, and render it between the stat cards and the first teaser. The `dashboard-stats` block ends at `:127` and `<section className="dashboard-teasers"` begins at `:128`; insert between them:

```tsx
          {nudge && (
            <div className="nudge" role="status">
              <span>
                This browser can clear your data. Export a backup and it can&apos;t.
              </span>
              <button type="button" className="link" onClick={nudge.onDismiss}>
                Dismiss
              </button>
            </div>
          )}
```

- [ ] **Step 4: Show the persisted outcome beside the Export control**

In `src/shell/RosterScreen.tsx`, add to its props:

```tsx
  /** The browser's persistence outcome: true granted, false refused, null unknown. */
  persisted: boolean | null;
```

and render the note inside `.roster-toolbar`, immediately before the `Export` button:

```tsx
                <span className="durability-note">
                  {persisted === true && "Storage protected. Eviction unlikely."}
                  {persisted === false && "Storage not protected. Keep a backup."}
                  {persisted === null && "Storage protection unknown in this browser. Keep a backup."}
                </span>
```

The `Export` button's markup and behaviour are unchanged.

- [ ] **Step 5: Wire it from `src/App.tsx` and record the export**

Add beside the other hook calls near the top of the component body:

```tsx
  const durability = useDurability({ playerCount: communityPlayers.length });
  const exportNudge = durability.shouldNudge ? { onDismiss: durability.dismissNudge } : null;
```

In `handleExport` (`:412-424`), record the timestamp on success. The function's body gains one line at the end:

```tsx
    URL.revokeObjectURL(url);
    // Recorded only after the download has been triggered, so the nudge is
    // suppressed by a real export and never by an attempt.
    durability.recordExport();
  };
```

Pass the two new props at the mounts:

```tsx
          <DashboardScreen
            …
            nudge={exportNudge}
          />
```

```tsx
          <RosterScreen
            …
            persisted={durability.persisted}
          />
```

Add the import:

```tsx
import { useDurability } from "./shell/useDurability";
```

- [ ] **Step 6: Run the spec to verify it passes**

Run:
```bash
npx vite build && npx playwright test --config=e2e/playwright.config.ts tests/dashboard/nudge.spec.ts
```
Expected: PASS — 6 passed.

- [ ] **Step 7: Confirm the dashboard spec is untouched, then commit**

Run:
```bash
npx playwright test --config=e2e/playwright.config.ts tests/dashboard/dashboard.spec.ts
```
Expected: PASS — the stat-card assertions at `:114-118` and `:221-224` unchanged.

Run: `npx vitest run && npx tsc -b`
Expected: exit 0 both.

```bash
git add src/shell/useDurability.ts src/DashboardScreen.tsx src/shell/RosterScreen.tsx src/App.tsx src/index.css e2e/tests/dashboard/nudge.spec.ts
git commit -m "feat(data): a proportionate export nudge and a visible storage outcome"
```

---

### Task 15: The CSV template and the column hint

**Files:**
- Create: `src/data/csv-template.ts`
- Test: `src/data/csv-template.test.ts`
- Modify: `src/shell/RosterScreen.tsx` (the `.roster-toolbar` from Task 14)
- Modify: `e2e/tests/roster/fast-entry.spec.ts` (create; Task 16 and 17 append)

**Interfaces:**
- Consumes: `parsePlayerCsv(text): { rows: CsvRow[]; skipped: ImportSkip[] }` from `src/data/player-import.ts` (A08); `SEED_DISCIPLINES` from `src/domain/seed.ts`.
- Produces: `CSV_TEMPLATE: string`; the `.import-hint` block; `data-testid="download-csv-template"`. Task 16 appends to the same spec file.

**The boundary, kept.** A08 owns `src/data/player-import.ts` and its semantics: quoted-field parsing, `MAX_IMPORT_BYTES`, `assertImportSize`, unknown discipline to `skipped`, never a capability-less player. **D36 renders A08's `ImportSkip[]` and matches its column order: name, discipline, strength. D36 does not edit the parser.** The template is a separate, D-owned file tied to the parser by a test rather than by co-location.

- [ ] **Step 1: Write the failing test**

Create `src/data/csv-template.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { CSV_TEMPLATE } from "./csv-template";
import { parsePlayerCsv } from "./player-import";
import { SEED_DISCIPLINES } from "../domain/seed";

describe("CSV_TEMPLATE", () => {
  it("states the parser's column order in its header", () => {
    expect(CSV_TEMPLATE.split(/\r?\n/)[0]).toBe("name,discipline,strength");
  });

  it("has a second line for each seed discipline, so both examples are usable", () => {
    expect(CSV_TEMPLATE.split(/\r?\n/).filter((l) => l.trim())).toHaveLength(3);
  });

  it("parses cleanly through A08's parser, with every row accounted for", () => {
    // The tie between this file and the parser is a test, not a shared directory.
    const { rows, skipped } = parsePlayerCsv(CSV_TEMPLATE);
    expect(skipped).toEqual([]);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.name)).toEqual(["Andi", "Budi"]);
    expect(rows.map((r) => r.discipline)).toEqual(["futsal", "mlbb"]);
    expect(rows.map((r) => r.strength)).toEqual([4, 3]);
    // Line numbers are 1-based and name the data row, not the header.
    expect(rows.map((r) => r.line)).toEqual([2, 3]);
  });

  it("names disciplines that exist in the catalog", () => {
    const short = SEED_DISCIPLINES.map((d) => d.shortName.toLowerCase());
    const { rows } = parsePlayerCsv(CSV_TEMPLATE);
    for (const row of rows) expect(short).toContain(row.discipline);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/data/csv-template.test.ts`
Expected: FAIL — `Failed to resolve import "./csv-template"`.

- [ ] **Step 3: Write the template**

Create `src/data/csv-template.ts`:

```ts
/**
 * The CSV an organizer downloads to start from. The column order is the parser's:
 * `parsePlayerCsv` reads name, discipline, strength, and the two are tied together
 * by src/data/csv-template.test.ts rather than by living in the same file, because
 * src/data/player-import.ts belongs to Phase A.
 *
 * The discipline names are the seed disciplines' short names, lower-cased, which is
 * what the parser matches on.
 */
export const CSV_TEMPLATE = ["name,discipline,strength", "Andi,futsal,4", "Budi,mlbb,3", ""].join("\n");
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/data/csv-template.test.ts`
Expected: PASS — 4 passed.

If the parser reports a stray blank row, drop the trailing `""` from the array; A08's parser filters blank lines, and this test is the authority on that.

- [ ] **Step 5: Add the template button and the column hint**

In `src/shell/RosterScreen.tsx`, add the import:

```tsx
import { CSV_TEMPLATE } from "../data/csv-template";
```

Add the handler beside the existing toolbar handlers:

```tsx
  const downloadCsvTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "comp3tive-players-template.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
```

Add the button inside `.roster-toolbar`, after the hidden file input and before the spacer:

```tsx
                <button
                  type="button"
                  className="btn btn-ghost"
                  title='An example CSV: name, discipline, strength'
                  data-testid="download-csv-template"
                  onClick={downloadCsvTemplate}
                >
                  Download CSV template
                </button>
```

Add the hint block directly after the `.roster-toolbar`'s closing `</div>`, and only when a community is active:

```tsx
              <p className="import-hint">CSV columns: name, discipline, strength.</p>
              <p className="import-hint">
                Names with a comma go in quotes: &quot;Smith, John&quot;, futsal, 4.
              </p>
```

- [ ] **Step 6: Append the e2e specs and run them**

Create `e2e/tests/roster/fast-entry.spec.ts`:

```ts
/**
 * Roster fast entry: a documented CSV path, a report of what was skipped, and
 * rating a set of players at once.
 */
import { test, expect } from "@playwright/test";
import { gotoHubSeeded, type SeedWorld } from "../../support/seed";

const world = (): SeedWorld => ({
  communities: [{ id: "comm-fast", name: "Fast Entry", createdAt: 100 }],
  players: [],
  sessions: [],
  tournaments: [],
  squads: [],
  activeCommunityId: "comm-fast",
});

test("the column order is stated in the app, and the template downloads", async ({ page }) => {
  await gotoHubSeeded(page, world(), "Roster");

  await expect(page.locator(".import-hint", { hasText: "CSV columns: name, discipline, strength." })).toBeVisible();
  await expect(page.locator(".import-hint", { hasText: 'Names with a comma go in quotes: "Smith, John", futsal, 4.' })).toBeVisible();

  const download = page.waitForEvent("download");
  await page.getByTestId("download-csv-template").click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("comp3tive-players-template.csv");
});
```

Run:
```bash
npx vite build && npx playwright test --config=e2e/playwright.config.ts tests/roster/fast-entry.spec.ts
```
Expected: PASS — 1 passed.

- [ ] **Step 7: Commit**

```bash
git add src/data/csv-template.ts src/data/csv-template.test.ts src/shell/RosterScreen.tsx e2e/tests/roster/fast-entry.spec.ts
git commit -m "feat(roster): a CSV template and the column order stated in the app"
```

---

### Task 16: The import report

**Files:**
- Modify: `src/shell/RosterScreen.tsx` (the report panel; the `lastReport` prop)
- Modify: `e2e/tests/roster/fast-entry.spec.ts` (append)
- Test: `e2e/tests/roster/fast-entry.spec.ts`

**Interfaces:**
- Consumes: `ImportReport` and `ImportSkip`, both exported from `src/shell/usePlayerImport.ts` (C27; `ImportReport` is `{ imported: number; skipped: ImportSkip[] }` and `ImportSkip` is re-exported from A08's `src/data/player-import.ts`).
- Produces: `.import-report` / `.import-skipped` / `.import-skipped-row`. No later task consumes them.

**Import from one place.** `import type { ImportReport } from "./usePlayerImport";` — C27 exports both named types, so D36 declares neither.

- [ ] **Step 1: Append the failing spec**

Append to `e2e/tests/roster/fast-entry.spec.ts`:

```ts
test("a partial import reports the success count and the skipped line, and keeps the good rows", async ({ page }) => {
  await gotoHubSeeded(page, world(), "Roster");

  // Row 2 is fine; row 3 names a discipline the catalog does not have.
  const csv = ["name,discipline,strength", "Andi,futsal,4", "Budi,quidditch,3", ""].join("\n");
  await page.setInputFiles('input[type="file"]', {
    name: "players.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv, "utf8"),
  });

  // Both halves of the outcome are shown: the panel is not a success-only count.
  const report = page.locator(".import-report");
  await expect(report).toBeVisible({ timeout: 5000 });
  await expect(report).toContainText("Imported 1 players.");
  const skipped = page.locator(".import-skipped-row");
  await expect(skipped).toHaveCount(1);
  await expect(skipped.first()).toContainText("Line 3:");
  // The row that parsed was created: a partial import never discards the good rows.
  await expect(page.locator(".roster .row", { hasText: "Andi" })).toBeVisible();
  // And the bad row did not become a capability-less player.
  await expect(page.locator(".roster .row", { hasText: "Budi" })).toHaveCount(0);

  // The panel persists across a subsequent render rather than flashing as a toast.
  await page.getByRole("button", { name: "History", exact: true }).click();
  await page.getByRole("button", { name: "Roster", exact: true }).click();
  await expect(page.locator(".import-report")).toContainText("Imported 1 players.");
});
```

- [ ] **Step 2: Run the spec to verify it fails**

Run:
```bash
npx vite build && npx playwright test --config=e2e/playwright.config.ts tests/roster/fast-entry.spec.ts
```
Expected: FAIL — `.import-report` resolves to 0 elements.

- [ ] **Step 3: Render the report**

In `src/shell/RosterScreen.tsx`, add to its props:

```tsx
  /** The last import's outcome, from usePlayerImport. Null before the first import. */
  lastReport: ImportReport | null;
```

and the type-only import:

```tsx
import type { ImportReport } from "./usePlayerImport";
```

Render the panel after the `.import-hint` lines added in Task 15:

```tsx
              {lastReport && (
                <div className="import-report">
                  <p>
                    Imported {lastReport.imported} player{lastReport.imported === 1 ? "" : "s"}.
                  </p>
                  {lastReport.skipped.length > 0 && (
                    <ul className="import-skipped">
                      {lastReport.skipped.map((skip, index) => (
                        <li key={`${skip.line}-${index}`} className="import-skipped-row">
                          Line {skip.line}: {skip.reason}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
```

- [ ] **Step 4: Pass the prop from `src/App.tsx`**

Where C27 destructures `usePlayerImport`, pass the report through. Add to the `<RosterScreen …>` mount:

```tsx
            lastReport={playerImport.lastReport}
```

using whatever binding C27's hook call assigned (C27's shape is
`{ pendingMerge, confirmMerge, cancelMerge, lastReport, importFile }`).

- [ ] **Step 5: Run the spec to verify it passes**

Run:
```bash
npx vite build && npx playwright test --config=e2e/playwright.config.ts tests/roster/fast-entry.spec.ts
```
Expected: PASS — 2 passed.

- [ ] **Step 6: Confirm the existing import specs are untouched, then commit**

Run:
```bash
npx playwright test --config=e2e/playwright.config.ts tests/squads/saved-squad.spec.ts tests/panel/no-overlap.spec.ts
```
Expected: PASS — `saved-squad.spec.ts:21-24` (players-only JSON through the toolbar input) and `no-overlap.spec.ts:4` (community created, players imported by file) unchanged.

```bash
git add src/shell/RosterScreen.tsx src/App.tsx e2e/tests/roster/fast-entry.spec.ts
git commit -m "feat(roster): report what an import skipped instead of dropping it silently"
```

---

### Task 17: Bulk rating

**Files:**
- Create: `src/roster/BulkRateModal.tsx`
- Modify: `src/shell/RosterScreen.tsx` (the `Rate selected` entry and the modal mount; the `notify` prop)
- Modify: `src/App.tsx` (pass `notify` to `RosterScreen`)
- Modify: `e2e/tests/roster/fast-entry.spec.ts` (append)
- Test: `e2e/tests/roster/fast-entry.spec.ts`

**Interfaces:**
- Consumes: `validatePlayer(player, disciplines): ValidationIssue[]` and `validateCapability(cap, discipline, path): ValidationIssue[]` from `src/domain/validation.ts` (`:14`, `:36`); `RosterScreenProps.onSavePlayer: (player: Player) => Promise<void>` (C26), which routes into `src/roster/useRoster.ts`'s `savePlayer` (`:28`) and therefore keeps the in-memory list in step; `Modal` from `src/ui/Modal.tsx` (C23); `notify` threaded as a prop (see Global Constraints).
- Produces: `BulkRateModal({ disciplines, players, defaultDisciplineId, onApply, onClose })`. No later task consumes it.

**Why the write goes through `onSavePlayer` and `validatePlayer`.** `.scratch/app-correctness/issues/03` claimed no production path calls `validatePlayer`; that is partially stale (`src/roster/PlayerEditModal.tsx:126` does). Only `parseBackup` and the JSON/CSV import paths still bypass it — which is precisely why this bulk write routes through it.

- [ ] **Step 1: Append the failing spec**

Append to `e2e/tests/roster/fast-entry.spec.ts`:

```ts
test("rates two filtered players at once, and cancelling writes nothing", async ({ page }) => {
  await gotoHubSeeded(page, world(), "Roster");

  const csv = ["name,discipline,strength", "Andi,futsal,2", "Budi,futsal,2", ""].join("\n");
  await page.setInputFiles('input[type="file"]', {
    name: "players.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv, "utf8"),
  });
  await expect(page.locator(".roster .row", { hasText: "Andi" })).toBeVisible({ timeout: 5000 });

  // Filter to futsal, then rate the visible set.
  await page.locator(".chips .chip", { hasText: "Futsal" }).click();
  await page.getByRole("button", { name: "Rate selected" }).click();

  const modal = page.locator(".modal-card");
  await expect(modal).toBeVisible();

  // Cancel first: nothing may change.
  await modal.getByRole("button", { name: "Cancel" }).click();
  await expect(modal).toHaveCount(0);
  await page.locator(".roster .row", { hasText: "Andi" }).click();
  await expect(page.locator("#player-name")).toHaveValue("Andi");
  // A rating of 2 from the import, untouched by the cancelled modal.
  await expect(page.locator(".rating-cell").first()).toContainText("2");
  await page.locator(".modal-close").click();

  // Now apply a rating of 5 to every attribute.
  await page.getByRole("button", { name: "Rate selected" }).click();
  const apply = page.locator(".modal-card");
  await expect(apply).toBeVisible();
  const attributeInputs = apply.locator('input[type="number"]');
  const count = await attributeInputs.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) await attributeInputs.nth(i).fill("5");
  await apply.getByRole("button", { name: /^Rate \d+ player/ }).click();
  await expect(apply).toHaveCount(0);

  // The message speaks through the app's own toast region, not a native dialog.
  await expect(page.locator(".toast-container")).toContainText("Rated 2 players in Futsal.");

  // The rows show the new values.
  await page.locator(".roster .row", { hasText: "Andi" }).click();
  await expect(page.locator("#player-name")).toHaveValue("Andi");
  await expect(page.locator(".rating-cell").first()).toContainText("5");
});
```

- [ ] **Step 2: Run the spec to verify it fails**

Run:
```bash
npx vite build && npx playwright test --config=e2e/playwright.config.ts tests/roster/fast-entry.spec.ts
```
Expected: FAIL — `getByRole("button", { name: "Rate selected" })` resolves to 0 elements.

- [ ] **Step 3: Write the modal**

Create `src/roster/BulkRateModal.tsx`:

```tsx
import { useState } from "react";
import type { Capability, Discipline, Id, Player } from "../domain/types";
import { validateCapability, validatePlayer } from "../domain/validation";
import { Modal } from "../ui/Modal";

interface Props {
  disciplines: Discipline[];
  /** The players the filter currently shows; the visible set is what gets rated. */
  players: Player[];
  /** The active filter's discipline, when there is one. */
  defaultDisciplineId: Id | null;
  onApply: (updated: Player[]) => Promise<void> | void;
  onClose: () => void;
}

/**
 * Rate a set of players in one discipline at once. Writes go through the caller's
 * save path, so the in-memory list updates exactly as the single-player editor does,
 * and every touched player is validated before it is written.
 */
export function BulkRateModal({ disciplines, players, defaultDisciplineId, onApply, onClose }: Props) {
  const [disciplineId, setDisciplineId] = useState<Id>(defaultDisciplineId ?? disciplines[0]?.id ?? "");
  const discipline = disciplines.find((d) => d.id === disciplineId);
  const [ratings, setRatings] = useState<Record<Id, number>>(() =>
    Object.fromEntries((discipline?.attributes ?? []).map((a) => [a.id, Math.round((a.min ?? 1) + ((a.max ?? 5) - (a.min ?? 1)) / 2)])),
  );
  const [issues, setIssues] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const pickDiscipline = (id: Id) => {
    const next = disciplines.find((d) => d.id === id);
    setDisciplineId(id);
    setIssues([]);
    setRatings(Object.fromEntries((next?.attributes ?? []).map((a) => [a.id, Math.round((a.min ?? 1) + ((a.max ?? 5) - (a.min ?? 1)) / 2)])));
  };

  const build = (): Player[] => {
    if (!discipline) return [];
    return players.map((player) => {
      const existing = player.capabilities.find((c) => c.disciplineId === discipline.id);
      const capability: Capability = existing
        ? // An existing capability keeps its roles; only its ratings change.
          { ...existing, attributeRatings: { ...existing.attributeRatings, ...ratings } }
        : // A player with none gains one: the discipline's full role list, no preference.
          {
            disciplineId: discipline.id,
            attributeRatings: { ...ratings },
            eligibleRoles: discipline.roles.map((r) => r.id),
            preferredRole: null,
          };
      const capabilities = existing
        ? player.capabilities.map((c) => (c.disciplineId === discipline.id ? capability : c))
        : [...player.capabilities, capability];
      return { ...player, capabilities };
    });
  };

  const apply = async () => {
    if (!discipline) return;
    const updated = build();
    // Validate before writing, not after: ratings stay inside each attribute's
    // range, at most one capability per discipline, eligibleRoles non-empty,
    // preferredRole inside eligibleRoles.
    const problems: string[] = [];
    for (const player of updated) {
      for (const issue of validatePlayer(player, disciplines)) problems.push(`${player.name}: ${issue.message}`);
      const cap = player.capabilities.find((c) => c.disciplineId === discipline.id);
      if (cap) {
        for (const issue of validateCapability(cap, discipline, cap.disciplineId)) {
          problems.push(`${player.name}: ${issue.message}`);
        }
      }
    }
    if (problems.length > 0) {
      setIssues(problems);
      return;
    }
    setIssues([]);
    setSaving(true);
    try {
      await onApply(updated);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose}>
      <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>
        &times;
      </button>
      <h1 className="modal-title">Rate players</h1>

      {issues.length > 0 && (
        <ul className="validation-errors" role="alert">
          {issues.map((issue, index) => (
            <li key={index}>{issue}</li>
          ))}
        </ul>
      )}

      <div className="modal-section">
        <div className="field-label">Discipline</div>
        <div className="chips">
          {disciplines.map((d) => (
            <button
              key={d.id}
              type="button"
              className="chip"
              aria-pressed={d.id === disciplineId}
              onClick={() => pickDiscipline(d.id)}
            >
              {d.shortName}
            </button>
          ))}
        </div>
      </div>

      {discipline && (
        <div className="modal-section">
          <div className="field-label">Ratings</div>
          {discipline.attributes.map((attribute) => (
            <label key={attribute.id} className="opt-row">
              <span>{attribute.name}</span>
              <input
                className="input"
                type="number"
                min={attribute.min ?? 1}
                max={attribute.max ?? 5}
                value={ratings[attribute.id] ?? attribute.min ?? 1}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  setIssues([]);
                  setRatings((prev) => ({ ...prev, [attribute.id]: value }));
                }}
              />
            </label>
          ))}
        </div>
      )}

      <div className="bar">
        <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={saving || players.length === 0 || !discipline}
          onClick={() => void apply()}
        >
          Rate {players.length} player{players.length === 1 ? "" : "s"}
        </button>
      </div>
    </Modal>
  );
}
```

- [ ] **Step 4: Wire the entry point and the `notify` prop**

In `src/shell/RosterScreen.tsx`, add the imports:

```tsx
import { BulkRateModal } from "../roster/BulkRateModal";
```

Add the two props:

```tsx
  /** The visible players; the bulk write applies to exactly this set. */
  visiblePlayers: Player[];
  /** Toast seam. Threaded as a prop because useToasts() is called once, in App. */
  notify: (text: string, type?: "success" | "error" | "info") => void;
```

(If C26's `RosterScreenProps` already carries `visiblePlayers`, do not add it a second time — reuse it.)

Add the state and handler:

```tsx
  const [bulkOpen, setBulkOpen] = useState(false);
```

```tsx
  const applyBulkRatings = async (updated: Player[]) => {
    for (const player of updated) await onSavePlayer(player);
    const discipline = disciplinesById.get(disciplineId) ?? disciplines.find((d) => d.id === filterIds[0]);
    notify(`Rated ${updated.length} player${updated.length === 1 ? "" : "s"} in ${discipline?.name ?? "this discipline"}.`, "success");
  };
```

Add the button after the `Download CSV template` button:

```tsx
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={visiblePlayers.length === 0 || disciplines.length === 0}
                  onClick={() => setBulkOpen(true)}
                >
                  Rate selected
                </button>
```

Add the mount beside the other modals:

```tsx
      {bulkOpen && (
        <BulkRateModal
          disciplines={disciplines}
          players={visiblePlayers}
          defaultDisciplineId={filterIds.length === 1 ? filterIds[0] : null}
          onApply={applyBulkRatings}
          onClose={() => setBulkOpen(false)}
        />
      )}
```

In `src/App.tsx`, pass the two props at the `<RosterScreen …>` mount:

```tsx
            notify={notify}
```

`visiblePlayers` is whatever C26 already computed for the list; pass that same value.

- [ ] **Step 5: Add the list styling**

In `src/index.css`, beside the `.roster-toolbar` rule at `:1343`, add the three small blocks this task and Task 15 need:

```css
.import-hint {
  font-size: 12px;
  color: var(--text-2);
  margin: 4px 0 0;
}
.import-report {
  margin-top: 10px;
  padding: 10px 12px;
  background: var(--surface-2);
  border: 1px solid var(--hairline);
  border-radius: var(--r-sm);
  font-size: 13px;
}
.import-skipped {
  list-style: none;
  margin-top: 6px;
  color: var(--text-2);
}
.import-skipped-row {
  font-size: 12px;
}
```

- [ ] **Step 6: Run the spec to verify it passes**

Run:
```bash
npx vite build && npx playwright test --config=e2e/playwright.config.ts tests/roster/fast-entry.spec.ts
```
Expected: PASS — 3 passed.

- [ ] **Step 7: Run the whole gate, then commit**

Run:
```bash
npx tsc -b
npx vitest run
npx vite build
npx playwright test --config=e2e/playwright.config.ts
```
Expected: `tsc` exit 0; vitest exit 0 with `src/share/share-text.test.ts`, `src/share/share-image.test.ts`, `src/share/fairness.test.ts`, `src/data/round-robin.test.ts`, `src/data/csv-template.test.ts`, `src/tournament/team-counts.test.ts` and `src/shell/useDurability.test.ts` all in the output; the build exits 0 with `sw.js  version …  precache … urls`; the full e2e suite passes, including the five new spec files.

```bash
git add src/roster/BulkRateModal.tsx src/shell/RosterScreen.tsx src/App.tsx src/index.css e2e/tests/roster/fast-entry.spec.ts
git commit -m "feat(roster): rate a set of players at once, validated before it is written"
```

---

## Self-Review

**Spec coverage.** Every acceptance criterion in `docs/superpowers/specs/2026-09-17-product-completion-design.md` maps to a step:

| Spec criterion | Task |
|---|---|
| 1. `npx tsc -b` exits 0 | every task's type-check step; 17's Step 7 as the phase gate |
| 2. `dist/` holds `sw.js`, `manifest.webmanifest`, `fonts/`, `icons/` | 11 Step 3, 12 Step 2 |
| 3. `vitest run` exits 0 with the five new unit files | 17 Step 7 |
| 4. `npm run e2e` exits 0 with the new specs | 17 Step 7 |
| 5. D31 proven, both clipboard cases | 2 Steps 1, 6 |
| 6. D32 proven, image and download fallback | 4 Steps 1, 4 |
| 7. D33 proven: no other host, offline both documents, deploy purge | 12 Steps 1, 2 |
| 8. D33's claim restored | 11 Steps 6, 7 |
| 9. D34 proven: nudge visible, dismiss persists, small roster quiet, 3 stat cards | 14 Steps 1, 6, 7 |
| 10. D35 proven: exhaustive schedule, `champion()` not null, existing tests unmodified | 6 Step 1, 7 Steps 1, 7, 8, 8 Step 7 |
| 11. D36 proven: skipped line, template download, bulk rating, both hint strings | 15 Step 6, 16 Step 1, 17 Step 1 |
| 12. D37 proven: `.fairness` visible, no banned substring, capture-hero passes | 5 Steps 6, 7 |
| 13. `git diff --stat src/tournament/bracket.ts` is round-robin only | 7 Step 8 |

**Placeholder scan.** No "TBD", "TODO", "implement later", "handle edge cases" or "similar to Task N" appears. Every code step carries runnable code. Every verification step names a command and an expected result.

**Type consistency.** `ShareTextInput` (Task 1) is the shape `ShareSheet` (Tasks 2, 4) and `teamsAsText` use. `DrawOp` and `LayoutShareImageInput` (Task 3) are what `renderShareImage` (Task 4) replays. `RoundRobinPairing` (Task 6) is what Task 7's `buildBracket` arm consumes, as `roundRobinSchedule`'s return. `ImportReport` (Task 16) comes from C27 and is not redeclared. `DurabilityDeps` (Task 13) is what Task 14 calls. `onSavePlayer` (Task 17) is C26's exact prop name, confirmed with Phase C rather than guessed.

**Three places the spec and the source disagreed, and what this plan follows.**

1. **`champion()` does not return `null` — it returns the wrong team.** The spec and ticket 35 say round robin "finds no final for round robin and returns `null` **silently**". Measured against `src/tournament/bracket.ts:317-326`: for a completed 4-team round robin whose standings leader finished on two wins, `champion()` returned the team that won round 1's first match (one win). It returns `null` only when that round-1 match is itself unrecorded. **This plan follows the source**: Task 7 asserts the champion equals the standings leader, and adds a second case whose winner differs from the round-1 winner precisely so the null-only test cannot pass on the buggy code.
2. **`requiredMatches` genuinely needs no arm**, as the spec says — confirmed by reading `bracket.ts:191-201` and by the passing status test in Task 7 Step 1, which drives a real tournament to `"active"` and then `"complete"`. Asserted, not assumed.
3. **Line anchors drift from the spec in three places**, because the spec's numbers were taken at audit baseline `d87ac7b` while these were read now: `src/domain/validation.ts` is `:14` and `:36` (spec says `:9`, `:35`); `src/session/flow.ts` is `:10` for `strengthOf` and `:16` for `teamName` (spec says `:29` and `:23`); `src/data/sample-data.ts`'s Blob precedent is `:40-54` (spec says `:52-60`). **This plan cites the numbers actually read.** The spec itself says to resolve the symbol, not the number, and every anchor here was confirmed by reading the line.

**Two implementation defects found and fixed while writing this plan, both by running the code rather than reading it.** The first draft of `layoutShareImage` overflowed the 1080 px canvas (a long player name reached x=1147) and collided the two column averages. Task 3's implementation clips labels with `fit()` and aligns each block's average to its own right edge; the spec's own "keeps every glyph inside the poster" test now pins that.

**Not verified, stated plainly.** `src/ui/Modal.tsx`, `src/shell/RosterScreen.tsx`, `src/shell/usePlayerImport.ts`, `src/shell/useSplitFlow.ts`, `src/shell/useToasts.ts` and `src/ui/constants.ts` do not exist yet — they are Phase C's deliverables. Every task that touches them names the exact interface `contracts.md` and C's spec freeze, and Tasks 2, 14, 15, 16 and 17 must re-read the landed file before editing it. If a name differs from the frozen contract, stop and report it rather than adapting silently.
