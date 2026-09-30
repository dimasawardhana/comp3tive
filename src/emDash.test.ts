import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as ts from "typescript";

/**
 * The rule, next to the guard that holds it. `DESIGN.md:200`:
 *
 * > **No em-dashes in new visible copy.** Periods and commas carry the pauses.
 * > The em-dash is the AI tell, so it is out of UI strings.
 *
 * and the scope note at `DESIGN.md:202`, which is the half that makes this file
 * possible at all:
 *
 * > the tally is of **visible copy**, and em-dashes in *code comments* are not
 * > in scope.
 *
 * The two guards that already existed for this rule are per-module and
 * hand-picked: `src/share/fairness.test.ts:344` and
 * `src/session/gapProvenance.test.ts:53`, and each sees only the two strings its
 * own module returns. Nothing swept the shipped surface for the character, so
 * four em-dashes landed in new visible copy and no test went red. One of them
 * was written `&mdash;` — entity-encoded, which is why three separate greps for
 * the character passed it. A grep cannot be the guard here: the character is
 * only one of the ways to write it.
 *
 * ## What this scans
 *
 * Every `.ts`/`.tsx` under `src/` that is not itself a test, plus every HTML
 * document this repository tracks. Both halves read **string literals and JSX
 * text nodes only**, found by parsing with `ts.createSourceFile` rather than by
 * matching text, so a comment can never be counted. That exclusion is the whole
 * design: this repository has hundreds of legitimate em-dashes in comments, and a
 * text scan would be noisy enough that the next person would delete the guard
 * rather than fix the copy. The proof that comments are skipped is a test below
 * that feeds this scanner a file whose *only* em-dashes are in comments and asks
 * it for zero.
 *
 * ## What this does NOT cover — read this before trusting a green run
 *
 * - **Nothing inside a `.test.ts` file.** Tests ship nothing. The cost is that a
 *   copy string duplicated into a test is unchecked here; what pins those is the
 *   assertion comparing the duplicate to the shipped string
 *   (`RosterScreen.csv-hint.test.ts`, `RosterScreen.import-report.test.ts`).
 * - **No stylesheet.** `src/*.css` is not parsed. A `content:` property that
 *   ships an em-dash would pass. No `content:` in this repository carries the
 *   character today, but nothing here would notice one being added.
 * - **HTML is not parsed, it is stripped.** `<script>` and `<style>` bodies and
 *   `<!-- -->` comments are blanked out, then what is left is scanned. An
 *   em-dash inside a script string in a document is therefore not seen, and a
 *   *malformed* comment that swallowed real copy would hide it too.
 * - **A JavaScript string literal inside an HTML document is seen as raw text**,
 *   so it is scanned by the HTML half but would be classified by the TypeScript
 *   half. The asymmetry is deliberate: the document is the unit here, not its code.
 * - **Regular expression literals in `.ts` are not string literals**, so a
 *   matcher like `/^—/` is not scanned. No such literal carries the character today.
 * - **`ENDORSED` is a ledger of what is knowingly still shipped**, not a list of
 *   things the rule does not apply to. A second test fails if any entry is no
 *   longer on disk, so a reworded sentence has to be struck out rather than left
 *   behind as dead cover.
 */

const root = new URL("../", import.meta.url);
const read = (relative: string) => readFileSync(new URL(relative, root), "utf8");

const EM_DASH = "—";

/**
 * HTML named character references, by lowercase name. `mdash` is the only one
 * that decodes to U+2014; it is matched case-insensitively and with or without
 * its semicolon, because a browser accepts both. Every other name is
 * deliberately absent — a name that decoded to an em-dash under some other
 * spelling would be a gap this table would be pretending not to have.
 */
const NAMED_REFERENCES: Record<string, string> = { mdash: EM_DASH };

/** `&mdash;`, `&#8212;`, `&#x2014;`, and the semicolon-less and uppercase forms. */
const REFERENCE = /&(?:#[xX][\da-fA-F]+|#\d+|[a-zA-Z][\da-zA-Z]*);?/g;

/** Decode one reference to the character it means, or `null` if it means none. */
const decodeReference = (reference: string): string | null => {
  const body = reference.slice(1, reference.endsWith(";") ? -1 : undefined);
  if (body.startsWith("#")) {
    const hexadecimal = body[1] === "x" || body[1] === "X";
    const digits = hexadecimal ? body.slice(2) : body.slice(1);
    const code = Number.parseInt(digits, hexadecimal ? 16 : 10);
    if (!Number.isFinite(code) || code === 0) return null;
    return String.fromCodePoint(code);
  }
  return NAMED_REFERENCES[body.toLowerCase()] ?? null;
};

/**
 * Every form of the character in one piece of copy: the character itself, then
 * every reference that decodes to it. `&mdash;` is the case that earns the second
 * loop, so the two are reported separately rather than folded into one "found".
 * `at` is the offset inside the piece, because a JSX text node starts on the
 * line after its opening tag and a character three lines into it is not on the
 * line the node starts on.
 */
const dashesIn = (copy: string): { form: string; at: number }[] => {
  const forms: { form: string; at: number }[] = [];
  for (const match of copy.matchAll(/—/g)) forms.push({ form: EM_DASH, at: match.index });
  for (const match of copy.matchAll(REFERENCE)) {
    if (decodeReference(match[0]) === EM_DASH) forms.push({ form: match[0], at: match.index });
  }
  return forms;
};

/** One line, so a ledger entry can be written the way a person reads the copy. */
const oneLine = (copy: string): string => copy.replace(/\s+/g, " ").trim();

/** Each line of a document with its 1-based number, so a report can name it. */
function lines(source: string): { line: number; text: string }[] {
  return source.split("\n").map((text, at) => ({ line: at + 1, text }));
}

function walk(node: ts.Node, visit: (node: ts.Node) => void): void {
  visit(node);
  ts.forEachChild(node, (child) => walk(child, visit));
}

/**
 * Every piece of visible copy in one source file: each quoted string, each run
 * of JSX text, and each template literal as a whole. Comments are reached by
 * neither branch — `ts.forEachChild` does not descend into trivia — which is the
 * entire reason this file parses rather than greps.
 *
 * A template is joined rather than reported piece by piece, because a piece is
 * where the character landed and the *sentence* is what somebody has to reword.
 * `head` and every `templateSpan` literal, with `${…}` between them, is that
 * sentence: readable, stable across rewrapping, and enough for the ledger to
 * name it and for a failure message to quote it.
 */
function visibleCopy(path: string, source: string): { line: number; copy: string }[] {
  const file = ts.createSourceFile(
    path,
    source,
    ts.ScriptTarget.ESNext,
    true,
    path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const found: { line: number; copy: string }[] = [];
  // Where `copy` actually starts in the source, which the AST reports two ways:
  // a JSX text node's `pos` is the character after its opening tag's `>`, so its
  // text starts there, while a string or template's `pos` is the end of the
  // *previous* token and `getStart` is its own quote. Offsets into `copy` are
  // counted from the first of those, so they mean a line number.
  const textStart = (node: ts.Node) =>
    ts.isJsxText(node) ? node.pos : node.getStart(file) + 1;
  const at = (node: ts.Node) => file.getLineAndCharacterOfPosition(textStart(node)).line + 1;
  walk(file, (node) => {
    if (ts.isTemplateExpression(node)) {
      const pieces = [node.head, ...node.templateSpans.map((span) => span.literal)];
      found.push({ line: at(node), copy: pieces.map((piece) => piece.text).join("${…}") });
      return;
    }
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isJsxText(node)) {
      found.push({ line: at(node), copy: node.text });
    }
  });
  return found;
}

type Dash = { file: string; line: number; form: string; copy: string };

/**
 * One ledger entry against one place on disk. `at` exists for the degenerate
 * case: `src/share/share-image.ts` keys a glyph-advance table by the character
 * itself, so the matched text is one character long and would otherwise endorse
 * that file wholesale. Pinning those two entries to a line keeps an endorsement
 * from being wider than the thing it endorses, and if the table ever moves the
 * next test says so out loud instead of the guard quietly widening.
 */
type Endorsed = { file: string; copy: string; at?: number; because: string };

const endorses = (entries: readonly Endorsed[], hit: Dash): boolean =>
  entries.some(
    (entry) =>
      entry.file === hit.file && entry.copy === hit.copy && (entry.at === undefined || entry.at === hit.line),
  );

/** Every `.ts`/`.tsx` under `src/` that is not a test file. */
const sourceFiles = (): string[] =>
  readdirSync(new URL("src/", root), { recursive: true, encoding: "utf8" })
    .filter((name) => /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name))
    .map((name) => `src/${name}`)
    .sort();

/**
 * The HTML documents this repository tracks. `index.html` and `app/index.html`
 * are the two the build emits, `public/404.html` is the one the worker precaches
 * for an unmatched path, and `prototype/index.html` is the design prototype. All
 * four are listed rather than only the three that ship, because a guard whose
 * scope is narrower than its reader assumes is how the ledger in `DESIGN.md`
 * grew a dozen entries in the first place.
 */
const documents = ["index.html", "app/index.html", "public/404.html", "prototype/index.html"];

/** Replace with spaces, keeping every newline, so a line number still means one. */
const blankOut = (text: string): string => text.replace(/[^\n]/g, " ");

/**
 * The parts of an HTML document that are not visible copy: its comments and the
 * bodies of its `<script>` and `<style>` elements. Blanked rather than deleted so
 * the reported line is the line the character is on.
 */
const visibleMarkup = (source: string): string =>
  source
    .replace(/<!--[\s\S]*?-->/g, blankOut)
    .replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, blankOut);

const sweep = (): Dash[] => {
  const found: Dash[] = [];
  for (const path of sourceFiles()) {
    for (const { line, copy } of visibleCopy(path, read(path))) {
      for (const { form, at } of dashesIn(copy)) {
        found.push({
          file: path,
          line: line + (copy.slice(0, at).match(/\n/g)?.length ?? 0),
          form,
          copy: oneLine(copy),
        });
      }
    }
  }
  // A document has already been split into its lines, and blanking kept them
  // aligned, so here the number is the line itself.
  for (const path of documents) {
    for (const { line, text } of lines(visibleMarkup(read(path)))) {
      for (const { form } of dashesIn(text)) {
        found.push({ file: path, line, form, copy: oneLine(text) });
      }
    }
  }
  return found;
};

/**
 * The em-dashes this repository knowingly still ships, each with the reason it is
 * still there. This is the ledger `DESIGN.md:202` measured, plus the two entries
 * that ledger could not have listed because they are not visible copy at all.
 */
const ENDORSED: readonly Endorsed[] = [
  {
    file: "src/landing.tsx",
    copy: "Indoor football on a smaller pitch — fast, technical, and built around tight spaces.",
    because: "one of the three DISCIPLINES desc strings; the set moves together (DESIGN.md:206)",
  },
  {
    file: "src/landing.tsx",
    copy: "5v5 MOBA — roles define your lane, and the strength model accounts for every attribute.",
    because: "one of the three DISCIPLINES desc strings; the set moves together (DESIGN.md:206)",
  },
  {
    file: "src/landing.tsx",
    copy: "Doubles on a badminton court — pairs balanced by strength, one at the front and one at the back.",
    because: "one of the three DISCIPLINES desc strings; the set moves together (DESIGN.md:206)",
  },
  {
    file: "src/domain/DisciplineEditModal.tsx",
    copy: "Built-in discipline — review only, not editable.",
    because: "the only visible line in the modal (DESIGN.md:202)",
  },
  {
    file: "src/roster/PlayerEditModal.tsx",
    copy: "— None —",
    because: "the empty option of a strength select; a paired dash, both ends visible (DESIGN.md:202)",
  },
  {
    file: "src/shell/AppChrome.tsx",
    copy: "— No community —",
    because: "the squad switcher's empty value; a paired dash, both ends visible (DESIGN.md:202)",
  },
  {
    file: "src/ErrorBoundary.tsx",
    copy: "Your saved data is safe on this device — nothing was changed. Reload to continue.",
    because: "the recovery copy the whole boundary exists to show (DESIGN.md:202)",
  },
  {
    file: "src/session/MatchScreen.tsx",
    copy:
      "Need ${…} eligible players for ${…} team${…} — have ${…}",
    because: "the refusal's two counts on one line (DESIGN.md:202)",
  },
  {
    file: "src/shell/usePlayerImport.ts",
    copy: "Skipped ${…} player${…}. First: \"${…}\" — ${…}",
    because: "the toast that names the first skipped row (DESIGN.md:202)",
  },
  {
    file: "src/share/share-image.ts",
    copy: "—",
    at: 148,
    because: "not copy at all: a glyph advance width, so the poster can lay out a pasted name",
  },
  {
    file: "src/share/share-image.ts",
    copy: "—",
    at: 177,
    because: "not copy at all: the same table at a larger size",
  },
  {
    file: "index.html",
    copy: "gap between the teams — the needle in the live split screen below.",
    because: "visible body copy on the Landing Page (DESIGN.md:202)",
  },
  {
    file: "index.html",
    copy: "Series, single elimination, Swiss, or round robin — recorded as you play, on the same",
    because: "visible body copy on the Landing Page (DESIGN.md:202)",
  },
  {
    file: "public/404.html",
    copy: "<title>comp3tive — page not found</title>",
    because: "the document title, and the one part of this page a reader sees before the body",
  },
  {
    file: "public/404.html",
    copy: "Your data is untouched — it lives in this browser, not on a server. Only the address was",
    because: "visible body copy on the 404 (DESIGN.md:202)",
  },
];

describe("the em-dash rule, held against the whole shipped surface", () => {
  it("finds no em-dash in visible copy that the ledger has not already named", () => {
    // The guard. Every string and every JSX text node in every non-test source
    // file under `src/`, and the visible part of every tracked document, checked
    // for the character and for every reference that decodes to it. The failure
    // names the file, the line and the form, because "an em-dash is somewhere in
    // the app" is not something anybody can act on.
    const unendorsed = sweep().filter((hit) => !endorses(ENDORSED, hit));
    expect(unendorsed.map((hit) => `${hit.file}:${hit.line}  ${hit.form}  ${hit.copy}`)).toEqual([]);
  });

  it("uses every ledger entry, so a reworded sentence cannot hide behind a dead one", () => {
    // A suppression list that is never pruned is how a sweep quietly becomes a
    // no-op: six rewrites later the list still says those strings are shipped,
    // and the next em-dash arrives into a file the guard has stopped reading.
    // An entry here has to point at a character that is still on disk.
    const found = sweep();
    expect(ENDORSED.filter((entry) => !found.some((hit) => endorses([entry], hit))).map(
      (entry) => `${entry.file}${entry.at === undefined ? "" : `:${entry.at}`}  ${entry.copy}  (${entry.because})`,
    )).toEqual([]);
  });

  it("visits JSX text, not only strings, so a sentence typed straight into the markup is covered", () => {
    // The file the four were fixed in writes its hint as JSX text, and the one
    // that was entity-encoded was written that way. If the scanner only read
    // quoted strings it would see neither form of that sentence and this whole
    // file would be theatre.
    const hint = visibleCopy("RosterScreen.tsx", read("src/shell/RosterScreen.tsx")).find((piece) =>
      piece.copy.includes("CSV columns, in this order"),
    );
    expect(hint).toBeDefined();
    expect(hint!.copy).not.toContain("&mdash;");
    expect(oneLine(hint!.copy)).toBe(
      "CSV columns, in this order: name, discipline, strength. Any value with a comma in it goes in quotes. The last example row in the template shows one in the name column.",
    );
  });

  it("does not count an em-dash that is only in a comment", () => {
    // The scope note (DESIGN.md:202) puts comments out of scope, and this
    // repository has hundreds of legitimate ones. This is the case that proves
    // the exclusion is real and not a promise: the same dashes, the only
    // difference being whether they sit in a string or in a comment.
    const commented = [
      "/** A doc comment, with an em-dash — which is out of scope. */",
      "// A line comment, with an em-dash — also out of scope.",
      "/* A block comment, with &mdash; — in a form nothing decodes either. */",
      'export const clean = "no dash here";',
    ].join("\n");
    expect(visibleCopy("commented.ts", commented).flatMap((piece) => dashesIn(piece.copy))).toEqual([]);

    const spoken = 'export const said = "an em-dash — in a string is in scope.";';
    expect(visibleCopy("spoken.ts", spoken).flatMap((piece) => dashesIn(piece.copy)).map((d) => d.form)).toEqual([
      EM_DASH,
    ]);
  });

  it("sees the em-dash in every form a person can write it in", () => {
    // `&mdash;` is the reason this file exists rather than a grep: it reached
    // visible copy in `RosterScreen.tsx` and three sweeps for the character
    // passed it. Every reference that decodes to U+2014 has to be caught, and the
    // numeric ones by value, so `&#x2014;` is as visible here as `&#8212;` is.
    for (const written of [EM_DASH, "&mdash;", "&MDASH;", "&mdash", "&#8212;", "&#x2014;", "&#X2014;", "&#8212"]) {
      expect(dashesIn(`before ${written} after`).map((d) => d.form), written).toEqual([written]);
    }
    // And a reference to some other character is not an em-dash. A guard that
    // flagged every `&` would be deleted, which is the outcome this case exists
    // to prevent.
    for (const other of ["&ndash;", "&#8211;", "&#x2013;", "a & b", "&mdashier;"]) {
      expect(dashesIn(`before ${other} after`), other).toEqual([]);
    }
  });

  it("blanks an HTML comment and a style body, and keeps the line a character is on", () => {
    // The HTML half of the sweep has the same comment boundary to solve and no
    // parser to solve it with, so it blanks rather than parses. The reported line
    // has to survive that, or a hit on a document names the wrong line.
    const document = [
      "<html>", // one — two — not visible
      "<style>/* three — not visible */</style>",
      "<p>four — visible</p>",
      "<!-- five — not visible -->",
      "</html>",
    ].join("\n");
    const spoken = lines(visibleMarkup(document)).filter(({ text }) => dashesIn(text).length > 0);
    expect(spoken.map(({ text }) => text.trim())).toEqual(["<p>four — visible</p>"]);
    expect(spoken.map(({ line }) => line)).toEqual([3]);
  });

  it("keeps sweeping a surface that has something to sweep", () => {
    // The empty sweep is the state every broken version of this file is in: a
    // path that does not resolve, a filter that matches nothing, a glob that
    // returns no files. All of them are green. So the sweep's own size is
    // asserted, and so is one file it is known to read.
    const found = sweep();
    expect(found.length).toBeGreaterThan(0);
    expect(found.map((hit) => hit.file)).toContain("index.html");
    expect(sourceFiles().length).toBeGreaterThan(50);
    for (const document of documents) expect(read(document)).not.toBe("");
  });
});