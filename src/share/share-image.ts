import type { Discipline, Player, SplitResult } from "../domain/types";
import { strengthOf, teamName } from "../session/flow";
import { BIB } from "../ui/constants";
import { closingLine, orderedSlots } from "./share-text";

/**
 * The poster's geometry as pure data, so the layout is testable in node and the
 * canvas replay is a thin loop. No canvas import here on purpose: the unit suite
 * runs with `environment: "node"` (`vite.config.ts:21`) and no jsdom, so
 * `layoutShareImage` is the half that can be proved, and `renderShareImage` —
 * which needs a real 2D context and a real font — is the half that is not.
 */
export type DrawOp =
  | { kind: "rect"; x: number; y: number; w: number; h: number; fill: string }
  | { kind: "roundRect"; x: number; y: number; w: number; h: number; r: number; fill: string }
  | { kind: "text"; x: number; y: number; text: string; font: string; fill: string; align: "left" | "right" };

export interface LayoutShareImageInput {
  disciplineName: string;
  /** Supplies every player's Strength. `disciplineName` is only ever the label. */
  discipline: Discipline;
  result: SplitResult;
  roster: Player[];
}

/**
 * The brand tokens as literal hexes, copied from the light block of
 * `src/tokens.css`. A canvas cannot resolve `var(--accent)`, so the values have
 * to be written out; the file is the source of truth and
 * `share-image.test.ts` re-reads it and fails if a hex here stops being a token.
 *
 * The poster is the **light** theme in both the app's themes, on purpose. It is
 * a file, not a view: it is dropped into a chat, a print queue, or a gallery,
 * and none of those can answer a media query, so "one image for both themes"
 * means one fixed palette rather than a runtime read. Light is that palette
 * because it is the one the sheet declares first (`:9`) and the one the word in
 * the app's own markup is drawn in (`index.html:58`). Reading the sheet's first
 * block is not the same as reading the right one: `:42-48` re-declares the
 * whole surface set for dark, and `:47` moves `--accent` to `#ea580c`, so a
 * poster built from the wrong block ships the wrong amber.
 */
const PAPER = "#FAF8F5"; // --surface
const INK = "#1C1917"; // --text
const SLATE = "#57534E"; // --text-2
const AMBER = "#C2410C"; // --accent
const HAIRLINE = "#E7E3DC"; // --hairline

/**
 * The bib hexes, keyed by `BIB`'s own keys rather than by position, so the order
 * stays the one `src/ui/constants.ts` froze and a sixth bib fails to compile
 * here until it has a colour of its own.
 */
const BIB_HEX: Record<(typeof BIB)[number], string> = {
  a: "#FFC400", // --bib-a
  b: "#FF4F9A", // --bib-b
  c: "#4E8FDB", // --bib-c
  d: "#6FAF8E", // --bib-d
  e: "#C9A227", // --bib-e
};

const WIDTH = 1080;
const MARGIN = 64;
const HEADER_HEIGHT = 240;
const ROW_HEIGHT = 56;
const BLOCK_BASE = 96;
const BLOCK_PADDING = 32;
const BLOCK_GAP = 24;
const COLUMN_GAP = 32;
/**
 * The space a label leaves before its block's right edge. Half the column gap,
 * so a two-column poster keeps the same breathing room between a name and the
 * edge that a stacked one does.
 */
const BLOCK_GUTTER = COLUMN_GAP / 2;
const INSET = 36;
const FOOTER_PAD = 24;
/** Where a baseline sits inside its row: the row box, less half the descender. */
const BASELINE = 12;

/**
 * The app's own font stacks, taken from `src/index.css:14` and from the wordmark
 * in `index.html:58` — the sheet's one other place that draws text outside the
 * DOM. A `ctx.font` naming only a webfont silently falls back to the user
 * agent's default when that face is missing, which is Times, not the app: the
 * poster would be a second design rather than the first one, and only on the
 * machines where the font had not arrived.
 */
const DISPLAY = '600 48px "Outfit", "Segoe UI", system-ui, sans-serif';
const BODY = '500 34px "Familjen Grotesk", system-ui, sans-serif';
const FIGURE = '700 64px "Outfit", "Segoe UI", system-ui, sans-serif';

/**
 * Glyph widths are approximated, because there is no canvas and no `measureText`
 * in a pure layout. 0.52 is the average advance ratio of these two faces
 * relative to their em, so a name is measured generously rather than tightly: an
 * over-estimate clips a few characters early, an under-estimate runs off the
 * paper.
 */
const CHAR_WIDTH = 0.52;

/** The px size a font shorthand declares, which is what a row's height is built from. */
function pxOf(font: string): number {
  return Number(font.match(/(\d+)px/)?.[1] ?? 34);
}

function textWidth(text: string, font: string): number {
  return text.length * pxOf(font) * CHAR_WIDTH;
}

/**
 * Clip a one-line label to the room it has. Used for names only, and only where
 * dropping the tail is honest: a row is a row, and a row that wrapped would stop
 * being scannable down a column.
 */
function fit(text: string, font: string, maxWidth: number): string {
  if (textWidth(text, font) <= maxWidth) return text;
  let out = text;
  while (out.length > 1 && textWidth(`${out}…`, font) > maxWidth) out = out.slice(0, -1);
  return `${out}…`;
}

/**
 * Greedy line breaking, for the footer's prose.
 *
 * The footer is where the closing sentence lives, and that sentence's whole job
 * is its last clause — "A smaller one may exist." Clipping it to fit would
 * leave an unhedged poster, so the footer wraps and never truncates. A single
 * word too wide for the column (a long name in the not-playing line) is cut at
 * the glyph, because the invariant under test is that ink stays on the paper.
 */
function wrap(text: string, font: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  const flush = () => {
    if (line) {
      lines.push(line);
      line = "";
    }
  };
  for (const word of text.split(" ")) {
    if (textWidth(word, font) > maxWidth) {
      flush();
      let chunk = "";
      for (const glyph of word) {
        if (chunk && textWidth(chunk + glyph, font) > maxWidth) {
          lines.push(chunk);
          chunk = glyph;
        } else {
          chunk += glyph;
        }
      }
      line = chunk;
      continue;
    }
    const candidate = line ? `${line} ${word}` : word;
    if (line && textWidth(candidate, font) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  flush();
  return lines;
}

export function blockHeight(playerCount: number): number {
  return BLOCK_BASE + playerCount * ROW_HEIGHT + BLOCK_PADDING;
}

export function layoutShareImage(input: LayoutShareImageInput): { width: number; height: number; ops: DrawOp[] } {
  const { disciplineName, discipline, result, roster } = input;
  const teams = result.teams;
  /** Two teams read side by side; three or more stack, because a third column is unreadable at 1080. */
  const columns = teams.length === 2;
  const column = WIDTH - MARGIN * 2;

  /**
   * The footer is measured before the height, because it is prose and prose
   * decides its own line count: the closing sentence is wrapped, never clipped,
   * and the not-playing line only exists when somebody sat out.
   */
  const notPlaying = result.unassigned.length > 0 ? `Not playing: ${result.unassigned.map((id) => roster.find((p) => p.id === id)?.name ?? "?").join(", ")}` : null;
  const footerLines = [...wrap(closingLine(result), BODY, column), ...(notPlaying ? wrap(notPlaying, BODY, column) : [])];
  const footerHeight = FOOTER_PAD * 2 + footerLines.length * ROW_HEIGHT;

  const heights = teams.map((team) => blockHeight(team.slots.length));
  const body = columns
    ? Math.max(0, ...heights)
    : heights.reduce((sum, h) => sum + h, 0) + BLOCK_GAP * Math.max(0, teams.length - 1);
  const rounded = Math.ceil((HEADER_HEIGHT + body + footerHeight) / 8) * 8;

  const ops: DrawOp[] = [{ kind: "rect", x: 0, y: 0, w: WIDTH, h: rounded, fill: PAPER }];
  ops.push({ kind: "text", x: MARGIN, y: 96, text: fit(disciplineName, DISPLAY, WIDTH / 2), font: DISPLAY, fill: INK, align: "left" });
  ops.push({ kind: "text", x: WIDTH - MARGIN, y: 88, text: "GAP", font: BODY, fill: SLATE, align: "right" });
  ops.push({ kind: "text", x: WIDTH - MARGIN, y: 168, text: result.gap.toFixed(1), font: FIGURE, fill: AMBER, align: "right" });
  ops.push({ kind: "rect", x: MARGIN, y: HEADER_HEIGHT - 24, w: column, h: 1, fill: HAIRLINE });

  const blockWidth = columns ? (column - COLUMN_GAP) / 2 : column;
  /** What a name may use: the block, less the stripe, less the gutter at its right edge. */
  const labelRoom = blockWidth - INSET - BLOCK_GUTTER;
  let y = HEADER_HEIGHT;
  teams.forEach((team, index) => {
    const x = columns ? MARGIN + index * (blockWidth + COLUMN_GAP) : MARGIN;
    const bib = BIB[team.index % BIB.length] ?? "a";
    const average = `avg ${team.avgStrength.toFixed(1)}`;
    ops.push({ kind: "roundRect", x, y: y + BLOCK_GAP, w: 12, h: heights[index] - BLOCK_GAP * 2, r: 6, fill: BIB_HEX[bib] });
    ops.push({
      kind: "text",
      x: x + INSET,
      y: y + 64,
      text: fit(teamName(team.index), DISPLAY, blockWidth - INSET - textWidth(average, BODY) - BLOCK_GUTTER),
      font: DISPLAY,
      fill: INK,
      align: "left",
    });
    // The average sits at the block's own right edge, not the poster's, so two
    // columns cannot collide.
    ops.push({ kind: "text", x: x + blockWidth, y: y + 64, text: average, font: BODY, fill: SLATE, align: "right" });
    const bullet = "• ";
    orderedSlots(team.slots, roster, discipline).forEach(({ player }, row) => {
      const strength = strengthOf(player, discipline);
      // No parenthesis for a player with no capability here: there is no number
      // for them, and printing a zero would be a rating nobody gave.
      const label = strength === null ? player.name : `${player.name} (${strength.toFixed(1)})`;
      ops.push({
        kind: "text",
        x: x + INSET,
        y: y + 128 + row * ROW_HEIGHT,
        text: bullet + fit(label, BODY, labelRoom - textWidth(bullet, BODY)),
        font: BODY,
        fill: SLATE,
        align: "left",
      });
    });
    if (!columns) y += heights[index] + BLOCK_GAP;
  });

  const footerTop = HEADER_HEIGHT + body;
  ops.push({ kind: "rect", x: MARGIN, y: footerTop, w: column, h: 1, fill: HAIRLINE });
  footerLines.forEach((line, index) => {
    ops.push({ kind: "text", x: MARGIN, y: footerTop + FOOTER_PAD + (index + 1) * ROW_HEIGHT - BASELINE, text: line, font: BODY, fill: SLATE, align: "left" });
  });

  return { width: WIDTH, height: rounded, ops };
}

/**
 * Replay the layout onto a canvas and hand back a PNG.
 *
 * Not unit-tested, and deliberately so: it needs a real 2D context, a real font
 * and a real encoder, none of which exist in the `node` environment the suite
 * runs in (`vite.config.ts:21`). Faking them would assert the fake. The half
 * that carries the decisions — every coordinate, colour and string — is
 * `layoutShareImage`, and that is what the tests pin.
 *
 * The fonts are loaded, not merely waited on. `document.fonts.ready` resolves as
 * soon as nothing is *pending*, and nothing requests these two faces on the
 * poster's behalf: a canvas `fillText` triggers no load, so on a page that had
 * not yet set type in them — or one where the CDN is slow — `ready` would
 * resolve instantly and the first `fillText` would silently draw the fallback.
 * The two explicit `load` calls are what put the faces in the set; `ready` then
 * waits for them. `src/landingDeal.tsx:139` is not the precedent: it re-measures
 * DOM text that already requested them.
 *
 * Both faces are variable woff2 the app fetches from a CDN today
 * (`index.html:28`, `app/index.html:10`; self-hosting is Task 9), and a
 * `fillText` issued before they land draws the fallback stack instead — a
 * poster that looks like a different product. The wait is best-effort by
 * design: a poster is worth sharing in the fallback face, and an offline CDN
 * must not stop the organizer from sharing at all.
 */
export async function renderShareImage(input: LayoutShareImageInput): Promise<Blob> {
  const { width, height, ops } = layoutShareImage(input);
  if (typeof document !== "undefined") {
    await Promise.all([document.fonts?.load(DISPLAY), document.fonts?.load(BODY)]).catch(() => {});
    await document.fonts?.ready.catch(() => {});
  }

  const canvas: OffscreenCanvas | HTMLCanvasElement =
    typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(width, height)
      : Object.assign(document.createElement("canvas"), { width, height });
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  if (!ctx) throw new Error("Could not get a 2D context to draw the poster on.");
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
