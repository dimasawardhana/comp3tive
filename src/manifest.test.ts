import { existsSync, readFileSync } from "node:fs";
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

  it("is linked from both documents, with the theme colour and an apple-touch icon", () => {
    for (const [name, html] of Object.entries(DOCUMENTS)) {
      expect(html, name).toContain('<link rel="manifest" href="/manifest.webmanifest" />');
      // The two must agree, or the OS chrome and the manifest's own claim differ
      // on every browser that reads both.
      expect(html, name).toContain(`<meta name="theme-color" content="${manifest.theme_color}" />`);
      // iOS does not read the manifest for the home-screen icon at all. Without
      // this the install works on Android and screenshots the page on iOS.
      expect(html, name).toMatch(/<link rel="apple-touch-icon" href="\/icons\/[^"]+\.png" \/>/);
      // Whatever they point at must be a tile this manifest declares.
      const icon = html.match(/<link rel="apple-touch-icon" href="([^"]+)"/)?.[1] ?? "";
      expect(icons.map((entry) => entry.src), name).toContain(icon);
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
