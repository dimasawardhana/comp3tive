/**
 * Draw the PWA icons from the brand icon mark (brand/3-icon.svg) into public/icons/.
 *
 * The source SVG references a Google Fonts @font-face, which is unreachable offline;
 * this script swaps it for the self-hosted woff2 the app ships, so the glyph is the
 * real Outfit "3" and not a system fallback. It refuses to write a file whose face
 * failed to load, because a fallback glyph is the one failure a screenshot would hide.
 *
 * The maskable icon is not the same drawing with padding. A launcher may crop a
 * maskable icon to any shape it likes, and the only region it promises to keep is the
 * centred 80% circle; so what has to sit inside that circle is the mark's INK, not
 * the SVG's viewBox. The viewBox carries a wide empty margin, so the scale is solved
 * from the measured ink box rather than guessed, and the written file is re-measured
 * and refused if any ink lands outside the circle.
 *
 * Usage:
 *   node scripts/make-icons.mjs                     write public/icons/*.png
 *   node scripts/make-icons.mjs --masks <dir>       also write the icon under real
 *                                                    launch masks, to be looked at
 *                                                    (resolves public/fonts/outfit-latin-*.woff2 at run time)
 */
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

const ROOT = import.meta.dirname;
const MARK = resolve(ROOT, "../brand/3-icon.svg");
const FONT_DIR = resolve(ROOT, "../public/fonts");
const OUT = resolve(ROOT, "../public/icons");
/** Brand paper (`brand/README.md`); the tiles are opaque, so this is their own field. */
const PAPER = "#FAF8F5";
/** A render used only to measure the mark. Never written, never shipped. */
const PROBE = 1024;
/** The circle a maskable consumer is guaranteed to keep: 80% of the tile, centred. */
const SAFE_DIAMETER = 0.8;
/** …and this far inside it, so the thing at risk is never an antialiased edge. */
const SAFE_MARGIN = 0.95;
/** Channel distance from PAPER above which a pixel counts as ink. */
const INK_THRESHOLD = 24;

/** Masks a consumer might crop to. The 80% circle is the guarantee; the rest are harsher. */
const MASKS = [
  { file: "mask-80-circle.png", note: "the 80% circle the spec guarantees", css: "circle(40% at 50% 50%)" },
  { file: "mask-tile-rounded.png", note: "a full-bleed launcher tile", css: "inset(0% round 22.37%)" },
  { file: "mask-70-circle.png", note: "a launcher harsher than the spec", css: "circle(35% at 50% 50%)" },
];

/**
 * The squared icon variant, with the remote @font-face replaced by the shipped file.
 * NOT a glob: readFile takes a literal path, so the content-hashed name is resolved at
 * run time — the hash changes whenever the subset is re-downloaded.
 */
async function iconMarkup() {
  const svg = await readFile(MARK, "utf8");
  const [subset] = (await readdir(FONT_DIR))
    .filter((name) => name.startsWith("outfit-latin-") && name.endsWith(".woff2"))
    .sort();
  if (!subset) throw new Error("outfit-latin subset missing — run the Task 9 downloads");
  const face = (await readFile(resolve(FONT_DIR, subset))).toString("base64");
  const swapped = svg.replace(
    /@font-face\{[^}]*\}/,
    `@font-face{font-family:'Outfit';src:url(data:font/woff2;base64,${face}) format('woff2');` +
      `font-weight:100 900;font-display:block}`,
  );
  if (swapped === svg) throw new Error("the mark no longer carries an @font-face; this script has nothing to swap");
  if (swapped.includes("fonts.gstatic.com")) throw new Error("the remote @font-face survived the swap");
  return swapped;
}

/** Draw the mark centred in a `size`×`size` paper field, scaled to `box` pixels. */
async function render(browser, mark, size, box) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  try {
    const offset = Math.round((size - box) / 2);
    await page.setContent(
      `<!doctype html><html><head><meta charset="utf-8"></head>` +
        `<body style="margin:0;background:${PAPER};width:${size}px;height:${size}px;overflow:hidden">` +
        `<div style="position:absolute;left:${offset}px;top:${offset}px;width:${box}px;height:${box}px">` +
        mark.replace('width="128" height="128"', `width="${box}" height="${box}"`) +
        `</div></body></html>`,
      { waitUntil: "load" },
    );
    // `load()` resolves with an empty array when nothing in the document can serve the
    // request, so this is a hard proof the face is real and not a system fallback.
    const face = await page.evaluate(async () => {
      const faces = await document.fonts.load("600 88px Outfit", "3");
      return { loaded: faces.length, check: document.fonts.check("600 88px Outfit", "3") };
    });
    if (!face.loaded || !face.check) {
      throw new Error(`Outfit did not load (${face.loaded} faces); refusing to draw a fallback glyph`);
    }
    return await page.screenshot({ clip: { x: 0, y: 0, width: size, height: size } });
  } finally {
    await page.close();
  }
}

/** The bounding box of every pixel that is not paper, in pixels. */
async function inkBox(browser, png) {
  const page = await browser.newPage();
  try {
    return await page.evaluate(async ({ dataUrl, threshold }) => {
      const img = new Image();
      img.src = dataUrl;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0);
      const { data } = ctx.getImageData(0, 0, c.width, c.height);
      const paper = [0xfa, 0xf8, 0xf5];
      let x0 = c.width;
      let y0 = c.height;
      let x1 = -1;
      let y1 = -1;
      let count = 0;
      for (let y = 0; y < c.height; y++) {
        for (let x = 0; x < c.width; x++) {
          const i = (y * c.width + x) * 4;
          const d =
            Math.abs(data[i] - paper[0]) + Math.abs(data[i + 1] - paper[1]) + Math.abs(data[i + 2] - paper[2]);
          if (d > threshold) {
            count++;
            if (x < x0) x0 = x;
            if (y < y0) y0 = y;
            if (x > x1) x1 = x;
            if (y > y1) y1 = y;
          }
        }
      }
      return { w: c.width, h: c.height, x0, y0, x1, y1, count };
    }, { dataUrl: `data:image/png;base64,${png.toString("base64")}`, threshold: INK_THRESHOLD });
  } finally {
    await page.close();
  }
}

/** Corners of the ink box, as offsets from the tile's centre, in tile widths. */
function corners(box) {
  const mid = { x: box.w / 2, y: box.h / 2 };
  return [
    [box.x0, box.y0],
    [box.x1, box.y0],
    [box.x0, box.y1],
    [box.x1, box.y1],
  ].map(([x, y]) => [(x + 0.5 - mid.x) / box.w, (y + 0.5 - mid.y) / box.w]);
}

/** True when any corner of the ink box falls outside the centred circle of `diameter`. */
function escapesSafeCircle(box, diameter) {
  const radius = (box.w * diameter) / 2;
  return corners(box).some(([dx, dy]) => Math.hypot(dx * box.w, dy * box.h) > radius);
}

const maskIndex = process.argv.indexOf("--masks");
const maskDir = maskIndex === -1 ? null : resolve(process.argv[maskIndex + 1] ?? "public/icons/masks");

await mkdir(OUT, { recursive: true });
const mark = await iconMarkup();
const browser = await chromium.launch();
try {
  // ---- measure the mark once, so the maskable scale is solved rather than guessed.
  const probe = await inkBox(browser, await render(browser, mark, PROBE, PROBE));
  if (probe.count === 0) throw new Error("the mark rendered no ink at all; the SVG or the face is wrong");
  const reach = Math.max(...corners(probe).map(([dx, dy]) => Math.hypot(dx, dy)));
  const edge = Math.max(...corners(probe).map(([dx, dy]) => Math.max(Math.abs(dx), Math.abs(dy))));
  // Two ceilings, and the smaller one wins: the safe circle, and the viewBox edge that
  // would clip the glyph outright.
  const safeScale = (SAFE_DIAMETER / 2) * SAFE_MARGIN / reach;
  const clipScale = 0.5 / edge;
  const maskableScale = Math.min(safeScale, clipScale);
  console.log(
    `probe  ${PROBE}px  ink ${probe.x1 - probe.x0 + 1}x${probe.y1 - probe.y0 + 1}` +
      `  reach ${(reach * 100).toFixed(1)}%  maskable scale ${maskableScale.toFixed(3)}` +
      `  (safe ${safeScale.toFixed(3)}, clip ${clipScale.toFixed(3)})`,
  );
  if (clipScale < safeScale) console.warn("  the viewBox edge, not the safe circle, is what limits the maskable mark");

  const targets = [
    { file: "icon-192.png", size: 192, scale: 1, maskable: false },
    { file: "icon-512.png", size: 512, scale: 1, maskable: false },
    // Ink fitted to the safe circle, which is a different drawing from "the same with padding".
    { file: "maskable-512.png", size: 512, scale: maskableScale, maskable: true },
  ];

  for (const target of targets) {
    const box = Math.round(target.size * target.scale);
    const png = await render(browser, mark, target.size, box);
    const ink = await inkBox(browser, png);
    if (ink.count === 0) throw new Error(`${target.file} is blank`);
    if (target.maskable && escapesSafeCircle(ink, SAFE_DIAMETER)) {
      throw new Error(
        `${target.file}: ink reaches the tile edge (${ink.x0},${ink.y0})-(${ink.x1},${ink.y1}); ` +
          `it must sit inside the ${SAFE_DIAMETER * 100}% safe circle`,
      );
    }
    await writeFile(resolve(OUT, target.file), png);
    const reachPct = (Math.max(...corners(ink).map(([dx, dy]) => Math.hypot(dx, dy))) * 100).toFixed(1);
    console.log(
      `${target.file}  ${target.size}x${target.size}  ${png.length} bytes  ` +
        `ink ${ink.x1 - ink.x0 + 1}x${ink.y1 - ink.y0 + 1} at (${ink.x0},${ink.y0})  reach ${reachPct}%` +
        (target.maskable ? `  (safe circle ${SAFE_DIAMETER * 100}%)` : ""),
    );
  }

  // ---- the same tile under real launch masks, for a human to look at.
  if (maskDir) {
    await mkdir(maskDir, { recursive: true });
    const png = await readFile(resolve(OUT, "maskable-512.png"));
    for (const mask of MASKS) {
      const page = await browser.newPage({ viewport: { width: 512, height: 512 } });
      try {
        await page.setContent(
          `<!doctype html><html><body style="margin:0;width:512px;height:512px;background:#8a8a8a">` +
            `<div style="width:512px;height:512px;clip-path:${mask.css}">` +
            `<img src="data:image/png;base64,${png.toString("base64")}" width="512" height="512" /></div>` +
            `</body></html>`,
          { waitUntil: "load" },
        );
        const shot = await page.screenshot({ clip: { x: 0, y: 0, width: 512, height: 512 } });
        await writeFile(resolve(maskDir, mask.file), shot);
        console.log(`${mask.file}  ${shot.length} bytes  ${mask.note}`);
      } finally {
        await page.close();
      }
    }
  }
} finally {
  await browser.close();
}
