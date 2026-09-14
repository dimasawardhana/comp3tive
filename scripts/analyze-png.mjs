/**
 * Diagnostic: render a PNG as an ASCII luminance map + colour histograms.
 * Exists because this environment has no vision model configured, so a captured
 * screenshot still has to be verified objectively. Pair with capture-hero.mjs.
 *
 * Usage: node scripts/analyze-png.mjs <png> [cols]
 */
import { readFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const [, , pngPath, colsArg] = process.argv;
const cols = Number(colsArg ?? 56);
const dataUrl = `data:image/png;base64,${(await readFile(pngPath)).toString("base64")}`;
const browser = await chromium.launch();
const page = await browser.newPage();

const result = await page.evaluate(
  async ({ dataUrl, cols }) => {
    const img = new Image();
    img.src = dataUrl;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const { data } = ctx.getImageData(0, 0, c.width, c.height);
    const W = c.width;
    const H = c.height;
    const hex = (n) => "#" + n.toString(16).padStart(6, "0");

    // ---- colour histograms: grouped (16 levels) and exact ----
    const grouped = new Map();
    const exact = new Map();
    let sampled = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (i % 8 !== 0) continue;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      sampled++;
      const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
      grouped.set(key, (grouped.get(key) ?? 0) + 1);
      const ex = (r << 16) | (g << 8) | b;
      exact.set(ex, (exact.get(ex) ?? 0) + 1);
    }
    const top = (map, n, toHex) =>
      [...map.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, n)
        .map(([k, count]) => ({ hex: toHex(k), pct: +((count / sampled) * 100).toFixed(1) }));
    const toGroupedHex = (key) =>
      "#" +
      [(key >> 8) & 15, (key >> 4) & 15, key & 15].map((v) => (v * 17).toString(16).padStart(2, "0")).join("");

    // ---- ASCII luminance map ----
    const rows = Math.max(1, Math.round((cols * H) / W / 2.1));
    const ramp = " .:-=+*#%@";
    const grid = [];
    for (let r = 0; r < rows; r++) {
      let line = "";
      for (let cc = 0; cc < cols; cc++) {
        const x0 = Math.floor((cc * W) / cols);
        const x1 = Math.max(x0 + 1, Math.floor(((cc + 1) * W) / cols));
        const y0 = Math.floor((r * H) / rows);
        const y1 = Math.max(y0 + 1, Math.floor(((r + 1) * H) / rows));
        let sum = 0;
        let n = 0;
        for (let y = y0; y < y1; y += 2) {
          for (let x = x0; x < x1; x += 2) {
            const i = (y * W + x) * 4;
            sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            n++;
          }
        }
        const lum = n ? sum / n : 255;
        const idx = Math.min(ramp.length - 1, Math.round(((255 - lum) / 255) * (ramp.length - 1)));
        line += ramp[idx];
      }
      grid.push(line);
    }

    // ---- horizontal scanline: exact colour at a few x positions, mid-height ----
    const y = Math.floor(H / 2);
    const scan = [];
    for (let x = 0; x < W; x += Math.max(1, Math.floor(W / 40))) {
      const i = (y * W + x) * 4;
      scan.push(`${x}:${(data[i] << 16 | data[i + 1] << 8 | data[i + 2]).toString(16).padStart(6, "0")}`);
    }
    return {
      W,
      H,
      sampled,
      grouped: top(grouped, 10, toGroupedHex),
      exact: top(exact, 12, hex),
      grid,
      scanlineY: y,
      scan,
    };
  },
  { dataUrl, cols },
);

await browser.close();
console.log(`${pngPath}  ${result.W}x${result.H}`);
console.log("exact top colours:", result.exact.map((t) => `${t.hex}(${t.pct}%)`).join(" "));
console.log("grouped (16-level):", result.grouped.map((t) => `${t.hex}(${t.pct}%)`).join(" "));
console.log(`scanline y=${result.scanlineY}: ${result.scan.join(" ")}`);
console.log("luminance map (darker = denser glyph):");
console.log(result.grid.join("\n"));
