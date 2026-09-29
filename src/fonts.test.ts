import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The self-hosted font pack, asserted rather than assumed.
 *
 * Every one of these is a failure mode that no compiler and no other test in
 * this repo can see. A `@font-face` naming a path nothing serves is valid CSS;
 * the browser accepts it, the app renders, and the only symptom is that the
 * type is quietly not the type. So the bytes, the names, the URLs the documents
 * preload, the cache headers, and the licences are all pinned here — and each
 * case below says what would make it fail.
 */
const root = new URL("../", import.meta.url);
const read = (relative: string) => readFileSync(new URL(relative, root), "utf8");
const bytes = (relative: string) => readFileSync(new URL(relative, root));

const FONTS_CSS = read("src/fonts.css");
const TOKENS_CSS = read("src/tokens.css");
const HEADERS = read("public/_headers");

/** Everything that ships and can fetch a font: the two documents, the page Cloudflare serves for a miss, the standalone wordmark, and the sheets that name the families. */
const SHIPPING = [
  "index.html",
  "app/index.html",
  "public/404.html",
  "public/comp3tive.svg",
  "src/fonts.css",
  "src/tokens.css",
  "src/index.css",
  "src/landing.css",
  "src/split.css",
  "src/share/share-image.ts",
];

/** The two third-party font hosts this app used to reach for, kept out of the source on purpose. Written as patterns so that this file does not itself contain the strings it forbids. */
const THIRD_PARTY = [/fonts\s*\.\s*googleapis/i, /fonts\s*\.\s*gstatic/i];

/** Every `/fonts/…` URL a `@font-face` declares, deduplicated. */
const declared = [...new Set([...FONTS_CSS.matchAll(/url\("(\/fonts\/[^"]+)"\)/g)].map((m) => m[1] as string))];
/** Every font file actually committed, as the URL the stylesheet would use for it. */
const committed = readdirSync(new URL("public/fonts", root))
  .filter((name) => name.endsWith(".woff2"))
  .map((name) => `/fonts/${name}`)
  .sort();

/** One `path` + indented `Header: value` block, which is the shape of a `_headers` rule. */
function headerRule(path: string): Record<string, string> {
  const lines = HEADERS.split("\n");
  const start = lines.indexOf(path);
  const body: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (line === "" || !line.startsWith(" ")) break;
    body.push(line.trim());
  }
  return Object.fromEntries(
    body
      .filter((line) => line.includes(":"))
      .map((line) => {
        const at = line.indexOf(":");
        return [line.slice(0, at).trim(), line.slice(at + 1).trim()] as [string, string];
      }),
  );
}

describe("the self-hosted font pack", () => {
  it("declares every committed file, and every declared file is committed", () => {
    // The gap in either direction is the whole bug class: a face with no file
    // renders in the fall-back forever, and a file with no face is dead weight
    // that looks like coverage. Fails if a font is downloaded without a rule,
    // if a rule is written for a path the pack does not hold, or if a family
    // gains a subset whose file never landed.
    expect(declared.slice().sort()).toEqual(committed);
    // Five is the count the CDN actually served this app: latin and latin-ext
    // for both families, plus Familjen Grotesk's vietnamese. Fails if a subset
    // is dropped to make the number tidier, which would move those codepoints
    // onto whatever the fall-back stack finds.
    expect(committed).toHaveLength(5);
  });

  it("names each file after its own bytes, so a swapped font is a new URL", () => {
    // The stale-font bug this naming exists to prevent is unobservable from the
    // page and total for a returning visitor: the same URL, a year of
    // `immutable`, a different face, and nothing to report it. Fails the moment
    // a woff2 is replaced in place, or renamed without being re-hashed.
    for (const url of committed) {
      const name = url.slice("/fonts/".length);
      const expected = createHash("sha256").update(bytes(`public/fonts/${name}`)).digest("hex").slice(0, 8);
      expect(name, `${name} is not named after its own sha256`).toContain(`-${expected}.woff2`);
    }
  });

  it("serves the fonts with a type and a cache that cannot go stale", () => {
    // `public/_headers` is the only place the deploy's caching is decided, and
    // dropping the rule is not a build failure — the fonts keep working,
    // revalidated on every load. A cache without a `Content-Type` is the worse
    // half: Pages sends `nosniff`, and a font refused for its type falls back
    // silently, with no error to trace.
    const rule = headerRule("/fonts/*.woff2");
    expect(rule["Content-Type"]).toBe("font/woff2");
    const cache = rule["Cache-Control"] ?? "";
    expect(cache, "the long cache is what makes the content hash load-bearing").toContain("immutable");
    expect(Number(cache.match(/max-age=(\d+)/)?.[1] ?? 0)).toBeGreaterThanOrEqual(31_536_000);
  });

  it("reaches no third party for type, from anything that ships", () => {
    // The grep a reviewer runs by hand, kept honest by the suite. Fails if a
    // connection hint or a remote stylesheet link comes back in either
    // document, in the 404 page, in the standalone wordmark — which is the one
    // most work never opens — or in a stylesheet.
    for (const file of SHIPPING) {
      for (const host of THIRD_PARTY) {
        expect(read(file), `${file} still names ${host.source}`).not.toMatch(host);
      }
    }
  });

  it("points every document at fonts the stylesheet declares, and both real documents preload", () => {
    // The trap of two entry points: `app/index.html` is a second document that
    // a change to `index.html` never touches, and the app is what a returning
    // organizer actually loads. A preload of an undeclared path is a wasted
    // request and a sign the two documents disagree about the pack; the second
    // assertion fails if a document keeps the faces but drops the preload, or if
    // the hint-to-preload swap is undone outright.
    const preloaded = (file: string) => [...read(file).matchAll(/rel="preload"[^>]*?href="([^"]+)"/g)].map((m) => m[1] as string);
    for (const file of ["index.html", "app/index.html", "public/404.html"]) {
      for (const href of preloaded(file)) {
        expect(declared, `${file} preloads ${href}, which src/fonts.css does not declare`).toContain(href);
      }
    }
    for (const file of ["index.html", "app/index.html"]) {
      expect(preloaded(file), `${file} preloads no font`).toHaveLength(2);
    }
    // The wordmark is a standalone document, so its `@font-face` carries a
    // relative URL and there is no cascade to give it a variable.
    const mark = read("public/comp3tive.svg").match(/url\('(fonts\/[^']+)'\)/)?.[1];
    expect(mark).toBeTruthy();
    expect(declared).toContain(`/${mark}`);
  });

  it("names the two families the stylesheets ask for, and nothing else", () => {
    // The names are a contract in both directions: `e2e/tests/community/
    // community.spec.ts` asserts the computed family of a heading, and the
    // poster's `ctx.font` asks for these two by name. A rename on one side
    // only is a silent fall-back, so a one-sided rename is rejected here.
    const faces = new Set([...FONTS_CSS.matchAll(/font-family:\s*"([^"]+)"/g)].map((m) => m[1] as string));
    expect([...faces].sort()).toEqual(["Familjen Grotesk", "Outfit"]);
    expect(TOKENS_CSS).toMatch(/--font-display:\s*"Outfit"/);
    expect(TOKENS_CSS).toMatch(/--font-body:\s*"Familjen Grotesk"/);
  });

  it("keeps a deliberate fall-back behind each face", () => {
    // Same-origin, a wrong path is a silent 404: no error, no console line, and
    // the app renders in the fall-back for good. The fall-back is therefore
    // load-bearing and is written out — `sans-serif` alone hands the browser
    // whatever it has, which on some Linux builds is a serif under a geometric
    // headline. Fails if a stack is trimmed to a bare generic, or reordered so
    // the generic wins over `system-ui`.
    for (const token of ["--font-display", "--font-body"]) {
      const stack = TOKENS_CSS.match(new RegExp(`${token}:\\s*([^;]+);`))?.[1]?.split(",").map((face) => face.trim().replace(/^"|"$/g, "")) ?? [];
      expect(stack.length, `${token} names no fall-back at all`).toBeGreaterThanOrEqual(4);
      expect(stack.at(-1), `${token} does not end in a generic`).toBe("sans-serif");
      expect(stack, `${token} leaves the platform's own UI font out`).toContain("system-ui");
    }
  });

  it("ships the licence for every family it serves", () => {
    // OFL 1.1 is a condition, not a courtesy: the copyright notice and the
    // licence have to travel with the Font Software. A family added without
    // one is redistribution with no grant behind it. Fails on a new family with
    // no licence file, on a licence carrying no copyright line, on the blank SIL
    // template, and on a Reserved Font Name appearing in one of these headers —
    // which would bar distributing a modified file under the original name.
    const packed = readdirSync(new URL("public/fonts", root));
    for (const [family, holder] of [["Outfit", "The Outfit Project Authors"], ["Familjen Grotesk", "The Familjen Grotesk Project Authors"]]) {
      const slug = family.toLowerCase().replace(/ /g, "-");
      const licence = packed.find((name) => name.startsWith(`${slug}-OFL`));
      expect(licence, `${family} is served with no licence beside it`).toBeTruthy();
      const text = read(`public/fonts/${licence as string}`);
      expect(text.split("\n")[0], `${licence} carries no copyright line`).toContain(holder);
      expect(text).toMatch(/SIL Open Font License, Version 1\.1/);
      expect(text.split("\n")[0], `${licence} reserves a font name, which changes what a modified copy may be called`).not.toMatch(/Reserved Font Name/);
    }
  });
});
