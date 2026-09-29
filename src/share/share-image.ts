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
 * The app's own font stacks, byte-identical to `--font-display` and
 * `--font-body` in `src/tokens.css` — a `ctx.font` is a literal string and
 * cannot read a custom property, so this is the one place the lists are
 * repeated, and `src/share/share-image.test.ts` fails if they drift.
 *
 * A `ctx.font` naming only a webfont silently falls back to the user agent's
 * default when that face is missing, which is Times, not the app: the poster
 * would be a second design rather than the first one, and only on the machines
 * where the font had not arrived. The self-hosted faces are same-origin and
 * content-hashed now (`src/fonts.css`), so "not arrived" is a wrong path — and
 * a wrong path is a silent 404 rather than a slow one.
 */
const DISPLAY = '600 48px "Outfit", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const BODY = '500 34px "Familjen Grotesk", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const FIGURE = '700 64px "Outfit", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

/**
 * Real advance widths, in em, read out of the woff2 files this app now serves.
 *
 * The poster's geometry is computed in a pure function that has no canvas and
 * no `measureText`, so the widths have to be known rather than measured. Until
 * the faces were self-hosted they could not be known: the only way to get at
 * them was a font file the browser had not loaded yet, and a layout tuned
 * against a face that might not be there was a guess. They are now committed
 * to the repo, so the numbers below are not a guess either — they are the
 * `hmtx` advances of the exact files `src/fonts.css` points at, divided by
 * each font's own units per em (Outfit 1000, Familjen Grotesk 1200), read
 * after pinning the `wght` axis to the weight in the matching `ctx.font`.
 *
 * A single average was never good enough, and the gap is not subtle: in Outfit
 * at 600 a space is 0.195 em and a W is 0.992 em, five times the width. A
 * `0.52`-per-character estimate let a name of wide letters run to nearly twice
 * its true width, which is the failure the old comment warned about and the
 * one the poster actually had.
 *
 * Cover is printable ASCII plus the punctuation the poster itself emits (the
 * row bullet and the ellipsis `fit` clips with) and the typographic quotes and
 * dashes a pasted name arrives carrying. Anything else — an accented Latin
 * letter, a CJK name, an emoji — falls back to `MEAN_ADVANCE`, which is also
 * measured rather than assumed: the mean of the same table over the same
 * ASCII range.
 */
const OUTFIT_600: Readonly<Record<string, number>> = {
  " ": 0.195, "!": 0.274, '"': 0.441, "#": 0.652,
  $: 0.594, "%": 0.671, "&": 0.68, "'": 0.246,
  "(": 0.304, ")": 0.304, "*": 0.49, "+": 0.555,
  ",": 0.28, "-": 0.462, ".": 0.295, "/": 0.393,
  "0": 0.66, "1": 0.367, "2": 0.553, "3": 0.55,
  "4": 0.604, "5": 0.553, "6": 0.568, "7": 0.525,
  "8": 0.555, "9": 0.568, ":": 0.281, ";": 0.275,
  "<": 0.555, "=": 0.555, ">": 0.555, "?": 0.503,
  "@": 0.747, A: 0.715, B: 0.631, C: 0.686,
  D: 0.747, E: 0.602, F: 0.578, G: 0.778,
  H: 0.721, I: 0.28, J: 0.513, K: 0.688,
  L: 0.556, M: 0.85, N: 0.727, O: 0.8,
  P: 0.616, Q: 0.82, R: 0.64, S: 0.569,
  T: 0.629, U: 0.696, V: 0.705, W: 0.992,
  X: 0.707, Y: 0.679, Z: 0.598, "[": 0.345,
  "\\": 0.393, "]": 0.345, "^": 0.459, _: 0.493,
  "`": 0.308, a: 0.588, b: 0.588, c: 0.492,
  d: 0.588, e: 0.541, f: 0.419, g: 0.579,
  h: 0.562, i: 0.248, j: 0.257, k: 0.528,
  l: 0.247, m: 0.867, n: 0.562, o: 0.569,
  p: 0.588, q: 0.588, r: 0.434, s: 0.444,
  t: 0.389, u: 0.528, v: 0.523, w: 0.769,
  x: 0.523, y: 0.526, z: 0.466, "{": 0.334,
  "|": 0.291, "}": 0.334, "~": 0.555, " ": 0.195,
  "–": 0.561, "—": 0.864, "‘": 0.256, "’": 0.257,
  "“": 0.471, "”": 0.471, "•": 0.346, "…": 0.805,
};

const FAMILJEN_500: Readonly<Record<string, number>> = {
  " ": 0.2, "!": 0.2875, '"': 0.45, "#": 0.6,
  $: 0.5667, "%": 0.85, "&": 0.695, "'": 0.25,
  "(": 0.35, ")": 0.35, "*": 0.3875, "+": 0.5667,
  ",": 0.225, "-": 0.3, ".": 0.225, "/": 0.35,
  "0": 0.5667, "1": 0.5667, "2": 0.5667, "3": 0.5667,
  "4": 0.5667, "5": 0.5667, "6": 0.5667, "7": 0.5667,
  "8": 0.5667, "9": 0.5667, ":": 0.2875, ";": 0.2875,
  "<": 0.5667, "=": 0.5667, ">": 0.5667, "?": 0.4875,
  "@": 0.8375, A: 0.6125, B: 0.5958, C: 0.6208,
  D: 0.6458, E: 0.5458, F: 0.5167, G: 0.6542,
  H: 0.675, I: 0.2583, J: 0.2608, K: 0.6042,
  L: 0.5, M: 0.875, N: 0.7, O: 0.6625,
  P: 0.5875, Q: 0.6625, R: 0.5958, S: 0.575,
  T: 0.575, U: 0.6583, V: 0.6125, W: 0.9125,
  X: 0.6083, Y: 0.55, Z: 0.5917, "[": 0.35,
  "\\": 0.3417, "]": 0.35, "^": 0.5667, _: 0.6,
  "`": 0.5, a: 0.5625, b: 0.5625, c: 0.5042,
  d: 0.5625, e: 0.5167, f: 0.3125, g: 0.5542,
  h: 0.5542, i: 0.2458, j: 0.2458, k: 0.525,
  l: 0.2475, m: 0.8333, n: 0.5542, o: 0.5375,
  p: 0.5625, q: 0.5625, r: 0.3708, s: 0.4625,
  t: 0.3125, u: 0.5542, v: 0.4958, w: 0.7833,
  x: 0.4917, y: 0.4875, z: 0.4667, "{": 0.35,
  "|": 0.3, "}": 0.35, "~": 0.5667, " ": 0.2,
  "–": 0.6, "—": 0.9, "‘": 0.225, "’": 0.225,
  "“": 0.425, "”": 0.425, "•": 0.3125, "…": 0.6,
};

/**
 * Keyed by `"<family>@<weight>"` off the `ctx.font` shorthand, so a face the
 * tables do not cover degrades to its own measured mean rather than to
 * nothing. `FIGURE` has no table because nothing in the layout measures it.
 */
const ADVANCES: Readonly<Record<string, Readonly<Record<string, number>>>> = {
  "Outfit@600": OUTFIT_600,
  "Familjen Grotesk@500": FAMILJEN_500,
};

/** The mean of each table over its own ASCII range — the fall-back for a glyph it does not list. */
const MEAN_ADVANCE: Readonly<Record<string, number>> = { Outfit: 0.5327, "Familjen Grotesk": 0.5128 };

/**
 * The width a `ctx.font` gives a string, in px.
 *
 * Exported for the one test that has to ask it: "keeps every glyph inside the
 * poster" is only a claim about real ink if it measures with the same numbers
 * the layout measured with. A test that re-approximates them asserts nothing.
 */
export function textWidth(text: string, font: string): number {
  const px = Number(font.match(/(\d+)px/)?.[1] ?? 34);
  const family = font.match(/"([^"]+)"/)?.[1] ?? "";
  const advances = ADVANCES[`${family}@${font.match(/^(\d+)/)?.[1] ?? ""}`];
  const mean = MEAN_ADVANCE[family] ?? 0.52;
  return [...text].reduce((sum, char) => sum + (advances?.[char] ?? mean), 0) * px;
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
 *
 * A break leaves the last word of the finished line on its own, and a
 * one-character word there is the most conspicuous thing on a poster: "A" reads
 * as a mistake rather than as a line ending. The word moves down with the one
 * that follows it, and only when the pair fits — a break that fixes the orphan
 * by pushing a word past the column edge would trade one defect for another.
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
      const orphan = line.slice(line.lastIndexOf(" ") + 1);
      const head = line.slice(0, line.length - orphan.length - 1);
      if (orphan.length === 1 && head && textWidth(`${orphan} ${word}`, font) <= maxWidth) {
        lines.push(head);
        line = `${orphan} ${word}`;
      } else {
        lines.push(line);
        line = word;
      }
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
 * not yet set type in them `ready` would resolve instantly and the first
 * `fillText` would silently draw the fallback. The two explicit `load` calls
 * are what put the faces in the set; `ready` then waits for them.
 * `src/landingDeal.tsx:139` is not the precedent: it re-measures DOM text that
 * already requested them.
 *
 * Both faces are self-hosted (`src/fonts.css`), same-origin as the page and
 * cached hard, so a `fillText` issued before they land is a much narrower race
 * than a CDN round trip — but the wait is still there, because falling back is
 * not a smaller cost, it is a different design. And it stays best-effort by
 * design: a poster is worth sharing in the fallback face, and a font that never
 * arrives must not stop the organizer from sharing at all.
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
