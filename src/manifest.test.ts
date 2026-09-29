import { existsSync, readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";

/**
 * The web app manifest, asserted rather than assumed.
 *
 * A manifest is not configuration, it is a set of claims about a program the OS
 * will draw a home screen, a splash screen and a status bar around — and it is
 * the one file in this repo that is read by something we do not test. Nothing
 * here fails if `start_url` points at the Landing Page, if `theme_color` is a
 * colour no surface ever paints, or if an icon's `sizes` is a number the PNG
 * does not have: the file stays valid JSON, the install succeeds, and the wrong
 * thing is on somebody's phone. So every field that makes a promise is pinned
 * to a value, and each pinned value is then checked against the thing that
 * makes it true — the tokens, the two documents, and the PNG headers on disk.
 *
 * The companion checks that are not "claims" are here too, because they are the
 * ones that catch a later edit: a renamed tile, a drifted `lang`, a new field
 * nobody reasoned about.
 */
const root = new URL("../", import.meta.url);
const read = (relative: string) => readFileSync(new URL(relative, root), "utf8");
const bytes = (relative: string) => readFileSync(new URL(relative, root));

const MANIFEST_FILE = "public/manifest.webmanifest";
const manifest: Record<string, unknown> = JSON.parse(read(MANIFEST_FILE));
/** The two documents a manifest is linked from, and therefore the two it speaks for. */
const DOCUMENTS = { landing: read("index.html"), app: read("app/index.html") };
const TOKENS = read("src/tokens.css");

interface Icon {
  src: string;
  sizes: string;
  type: string;
  purpose: string;
}
const icons = manifest.icons as Icon[];

/** Every colour the design system actually declares, lowercased. */
const tokenColours = new Set(
  [...TOKENS.matchAll(/--[\w-]+:\s*(#[0-9a-fA-F]{3,8})\s*;/g)].map((m) => (m[1] as string).toLowerCase()),
);

/** Width and height out of a PNG's IHDR, which is the only claim about size a file can back. */
function pngSize(relative: string): { width: number; height: number } {
  const buf = bytes(relative);
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (!signature.every((byte, i) => buf[i] === byte)) throw new Error(`${relative} is not a PNG`);
  if (buf.readUInt32BE(12) !== 0x49484452) throw new Error(`${relative} has no IHDR as its first chunk`);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

/**
 * The mark's ink, measured from the committed bytes.
 *
 * `scripts/make-icons.mjs` already refuses to write a tile whose ink leaves the
 * safe circle, and that is the only guard the choice has — a script a human has to
 * remember to re-run. Replacing `maskable-512.png` with `icon-512.png` passes
 * every other case in this file, because the IHDR is identical and a manifest
 * cannot tell two tiles apart. So the pixels are read here instead: a truecolour
 * PNG's IDAT is a zlib stream of filtered scanlines, `node:zlib` inflates it, and
 * nothing has to be added to read it.
 */
const PAPER_RGB = [0xfa, 0xf8, 0xf5];
/** The circle a maskable consumer is guaranteed to keep, as a fraction of the tile. */
const SAFE_RADIUS = 0.4;

interface Ink {
  width: number;
  height: number;
  count: number;
  /** The ink's bounding box, inclusive. */
  box: { x0: number; y0: number; x1: number; y1: number };
  /** The farthest ink pixel from the tile's centre, as a fraction of the tile. */
  reach: number;
}

function ink(relative: string): Ink {
  const buf = bytes(relative);
  const size = pngSize(relative);
  if (buf.readUInt8(24) !== 8 || buf.readUInt8(25) !== 2) {
    throw new Error(`${relative}: expected 8-bit truecolour, found depth ${buf.readUInt8(24)} type ${buf.readUInt8(25)}`);
  }
  if (buf.readUInt8(28) !== 0) throw new Error(`${relative} is interlaced, and nothing here de-interlaces`);
  const idat: Buffer[] = [];
  for (let at = 8; at < buf.length; ) {
    const length = buf.readUInt32BE(at);
    if (buf.toString("latin1", at + 4, at + 8) === "IDAT") idat.push(buf.subarray(at + 8, at + 8 + length));
    at += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = size.width * 3;
  const flat = Buffer.alloc(stride * size.height);
  // The five PNG scanline filters, which have to be undone in order because each
 // one refers to the pixels already reconstructed to its left and above.
  for (let y = 0; y < size.height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    for (let x = 0; x < stride; x++) {
      const left = x >= 3 ? flat[y * stride + x - 3] : 0;
      const above = y > 0 ? flat[(y - 1) * stride + x] : 0;
      const corner = x >= 3 && y > 0 ? flat[(y - 1) * stride + x - 3] : 0;
      const guess = left + above - corner;
      const distance = [Math.abs(guess - left), Math.abs(guess - above), Math.abs(guess - corner)];
      const paeth = [left, above, corner][distance.indexOf(Math.min(...distance))];
      const add =
        filter === 0 ? 0 : filter === 1 ? left : filter === 2 ? above : filter === 3 ? Math.floor((left + above) / 2) : paeth;
      flat[y * stride + x] = (line[x] + add) & 0xff;
    }
  }
  let count = 0;
  let reach = 0;
  const box = { x0: size.width, y0: size.height, x1: -1, y1: -1 };
  for (let y = 0; y < size.height; y++) {
    for (let x = 0; x < size.width; x++) {
      const i = (y * size.width + x) * 3;
      const paper =
        Math.abs(flat[i] - PAPER_RGB[0]) + Math.abs(flat[i + 1] - PAPER_RGB[1]) + Math.abs(flat[i + 2] - PAPER_RGB[2]);
      if (paper <= 24) continue;
      count++;
      if (x < box.x0) box.x0 = x;
      if (y < box.y0) box.y0 = y;
      if (x > box.x1) box.x1 = x;
      if (y > box.y1) box.y1 = y;
      const distance = Math.hypot(x + 0.5 - size.width / 2, y + 0.5 - size.height / 2) / size.width;
      if (distance > reach) reach = distance;
    }
  }
  return { ...size, count, box, reach };
}

describe("the web app manifest", () => {
  it("carries exactly the fields it reasons about, and no others", () => {
    // A field that is present is a claim the OS will trust, so adding one is an
    // act with a reason attached. This fails on an added field on purpose: the
    // fix is a line in Task 10's report, not a cast.
    expect(Object.keys(manifest).sort()).toEqual([
      "background_color",
      "description",
      "display",
      "icons",
      "lang",
      "name",
      "scope",
      "short_name",
      "start_url",
      "theme_color",
    ]);
    for (const icon of icons) {
      expect(Object.keys(icon).sort()).toEqual(["purpose", "sizes", "src", "type"]);
    }
  });

  it("says which program the launcher opens", () => {
    // `/` is the Landing Page and `/app/` is the app. An installed app that opens
    // on the pitch is reported as "it doesn't work", so the launcher opens the
    // tool; the app's own Dashboard renders a guided first-run state, so an
    // installer with no roster yet still gets a working screen.
    expect(manifest.start_url).toBe("/app/");
    // One installation has to cover both documents, or a link out to the Landing
    // Page would leave the standalone window for a browser tab. Scope must also be
    // a prefix of start_url or the launcher's own navigation leaves the app.
    expect(manifest.scope).toBe("/");
    expect((manifest.start_url as string).startsWith(manifest.scope as string)).toBe(true);
    // The trailing slash is the canonical URL of the document; `/app` only exists
    // as a 307 from `html_handling: auto-trailing-slash` in wrangler.jsonc.
    expect(manifest.start_url).toBe("/app/");
  });

  it("names the program the way the brand does, in the language it ships", () => {
    expect(manifest.name).toBe("comp3tive");
    // short_name is what sits under the home-screen icon. The wordmark is nine
    // characters; padding it into a sentence would put a claim on the home screen
    // that the brand never makes anywhere else.
    expect(manifest.short_name).toBe("comp3tive");
    // Deliberately the plan's sentence and not the Landing Page's stronger one:
    // "the smallest gap it can prove" is provable for a two-team split only, and a
    // manifest description has nowhere to qualify it.
    expect(manifest.description).toBe("Split a roster into balanced teams, then run the tournament.");
    // Both documents open <html lang="en">; without this the OS guesses, and a
    // guess is a claim too.
    expect(manifest.lang).toBe("en");
    for (const [name, html] of Object.entries(DOCUMENTS)) {
      expect(html, name).toMatch(/<html lang="en">/);
    }
  });

  it("asks for standalone, which is the only display this app can honour", () => {
    // The app paints its own sticky topbar, so the browser chrome is a second
    // header. `fullscreen` would also hide the status bar, and the clock is useful
    // on a match night; `standalone` is the claim the app actually keeps.
    expect(manifest.display).toBe("standalone");
  });

  it("paints the OS chrome in a colour the design system declares", () => {
    // The icons are opaque truecolour PNGs (no alpha channel), so the launch
    // splash is this colour with the tile on it. Any other value shows a hard
    // paper square floating in a differently coloured field.
    expect(manifest.background_color).toBe("#FAF8F5");
    // One static value, so it is the light theme's --surface: the paper
    // `.topbar-wrap` paints, which leaves no seam between the status strip and
    // the app's own bar. Not --accent: amber is this design's "do this now"
    // colour (--whistle and --danger share it) and the OS strip is permanent.
    expect(manifest.theme_color).toBe("#FAF8F5");
    for (const field of ["theme_color", "background_color"]) {
      expect(tokenColours.has((manifest[field] as string).toLowerCase()), field).toBe(true);
    }
    // The paper the tiles are drawn on is the same colour, or the splash would
    // show a seam at the tile's own edge.
    expect(manifest.background_color).toBe(manifest.theme_color);
  });

  it("names three tiles, and every one of them is on disk at the size it claims", () => {
    expect(icons.map((icon) => icon.src)).toEqual([
      "/icons/icon-192.png",
      "/icons/icon-512.png",
      "/icons/maskable-512.png",
    ]);
    for (const icon of icons) {
      // Every src is a root-absolute path under the scope, so one precache and one
      // installed window cover it. A relative or off-scope src resolves differently
      // depending on which document the OS read the manifest from.
      expect(icon.src.startsWith("/"), icon.src).toBe(true);
      expect(icon.src.startsWith(manifest.scope as string), icon.src).toBe(true);
      expect(icon.type).toBe("image/png");
      const [width, height] = icon.sizes.split("x");
      const file = `public${icon.src}`;
      expect(existsSync(new URL(file, root)), file).toBe(true);
      // The one claim about a file that a file can disprove.
      expect(pngSize(file), icon.src).toEqual({ width: Number(width), height: Number(height) });
    }
  });

  it("declares one maskable tile, and it is the one whose ink was fitted to the safe zone", () => {
    // `purpose` is how the OS knows to crop. Omitting it means "any" on both of
    // the plain tiles; a launcher offered the wrong one crops a glyph that was
    // never drawn to survive it. Exactly one maskable entry, so there is no second
    // candidate to disagree with.
    expect(icons.filter((icon) => icon.purpose === "maskable").map((icon) => icon.src)).toEqual([
      "/icons/maskable-512.png",
    ]);
    expect(icons.map((icon) => icon.purpose)).toEqual(["any", "any", "maskable"]);
  });

  it("draws every tile it ships inside the safe circle, measured from the pixels", () => {
    // The maskable fit is the one decision in this task with no other guard: a
    // launcher picks between the `any` and `maskable` entries on its own, and all
    // three files carry the same ink extent, so a swapped or re-shrunk tile
    // satisfies every other case in this file — the IHDR cannot tell them apart.
    // The pixels are the contract. All three, not just the maskable one: they are
    // drawn alike on purpose, so a glyph that changes size on any of them is one
    // regression, and `scripts/make-icons.mjs` solves one scale for all three.
    for (const icon of icons) {
      const measured = ink(`public${icon.src}`);
      expect(measured.count, `${icon.src} is blank`).toBeGreaterThan(0);
      const reach = measured.reach * 100;
      expect(reach, `${icon.src} ink reaches ${reach.toFixed(2)}% of the tile`).toBeLessThanOrEqual(SAFE_RADIUS * 100);
      // …and a floor, because a tile that is merely safe is not the same as a tile
      // that is an icon. Half the tile's height is well under where the mark sits
      // today, so this does not pin a font metric; it fails a SAFE_MARGIN cut far
      // enough to leave a mark floating in a field of paper.
      const height = (measured.box.y1 - measured.box.y0 + 1) / measured.height;
      expect(height, `${icon.src} ink is only ${(height * 100).toFixed(1)}% of the tile tall`).toBeGreaterThan(0.5);
    }
  });

  it("hands iOS the tile it pinned, because iOS reads no manifest theme colour", () => {
    // `apple-touch-icon` is the only mechanism that puts an icon on an iOS home
    // screen, so the href is pinned rather than left as "some declared icon". Both
    // tiles carry the same ink, so the choice is a name — which is exactly why it
    // needs a test rather than a comment.
    for (const [name, html] of Object.entries(DOCUMENTS)) {
      expect(html.match(/<link rel="apple-touch-icon" href="([^"]+)"/)?.[1], name).toBe("/icons/maskable-512.png");
    }
  });

  it("is linked from both documents, and both agree with the manifest's own theme colour", () => {
    for (const [name, html] of Object.entries(DOCUMENTS)) {
      expect(html, name).toContain('<link rel="manifest" href="/manifest.webmanifest" />');
      // The two must agree, or the OS chrome and the manifest's own claim differ
      // on every browser that reads both.
      expect(html, name).toContain(`<meta name="theme-color" content="${manifest.theme_color}" />`);
    }
  });

  it("leaves the Landing Page's copy alone, because the claim is not true yet", () => {
    // Phase B deleted the offline promise because nothing backed it, and Task 12
    // puts it back when the worker does. This task adds a manifest, which is the
    // other half of that promise, and must not drag the copy forward with it.
    // Comments are stripped because a comment is not something a reader sees.
    for (const [name, html] of Object.entries(DOCUMENTS)) {
      const spoken = html.replace(/<!--[\s\S]*?-->/g, "");
      for (const claim of [/works offline/i, /no signal/i, /install the app/i, /add to home screen/i]) {
        expect(spoken, `${name} must not claim ${claim}`).not.toMatch(claim);
      }
    }
    const described = DOCUMENTS.landing.match(/name="description"\s+content="([^"]*)"/)?.[1] ?? "";
    expect(described).not.toMatch(/works offline/i);
  });
});
