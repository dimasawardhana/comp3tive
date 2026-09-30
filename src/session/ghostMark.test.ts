/**
 * The ghost placeholder, and the one rule about it: a sentence mark may not
 * follow one.
 *
 * `nameOf` (`src/session/flow.ts:44`) prints `?` for an id the roster no longer
 * holds. That `?` is a name-shaped hole, so a mark straight after it prints `?.`
 * and reads as a typo. `fairness.ts` closes its sit-out list with a semicolon
 * for exactly that reason, and this file is what holds every other surface to
 * the same rule. The one violation it found was the swap prompt.
 *
 * ## Why half of this file reads source rather than rendered output
 *
 * The swap prompt is at `src/session/SplitScreen.tsx:397`, and it cannot be
 * reached. `setSwapMode` is called from `toggleSwapMode` and from nowhere else,
 * and `toggleSwapMode` is bound to the "Done swapping" button, which renders
 * only once swap mode is already on, so `swapMode` is `false` for the life of
 * the screen and the banner never appears. (`e2e/tests/split/action-bar.spec.ts`
 * records the same finding against the action bar.) No prop reaches it and no
 * click can, so `renderToStaticMarkup` cannot see it and a rendered-output test
 * would pass whether the line ends in a full stop or not.
 *
 * That leaves the source scan below as the only guard this line can have, and it
 * is a real one: it fails the day somebody types `${nameOf(...)}.`, whether that
 * copy is reachable yet or not. It is the same shape as `src/emDash.test.ts`,
 * and for the same reason: a grep is not a guard, because a comment in this
 * repository is full of `?.` written out in prose to explain this very rule. The
 * scan parses with `ts.createSourceFile` and reads only expressions and the copy
 * that follows them, so a comment cannot be counted.
 *
 * ## What it does not cover
 *
 * Nothing inside a `*.test.ts` file, for the reason `emDash.test.ts` gives: tests
 * ship nothing. What holds a duplicated copy string in a test is the assertion
 * comparing it to the shipped one, which is the first case below.
 */
import { readFileSync, readdirSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import * as ts from "typescript";
import { MLBB_DISCIPLINE } from "../domain/seed";
import { SplitScreen } from "./SplitScreen";
import { recomputeResult } from "./edit";
import type { Player, Session } from "../domain/types";

/** A mark that would follow a name, and so would follow a hole shaped like one. */
const SENTENCE_MARK = /^[.!?]/;

function walk(node: ts.Node, visit: (node: ts.Node) => void): void {
  visit(node);
  ts.forEachChild(node, (child) => walk(child, visit));
}

/**
 * Whether the whole of `node` renders a name the roster may not hold: the `?? "?"`
 * fallback written out, or a call to the one resolver that prints it. Only the
 * wrappers that leave the name last are unwrapped, so `${nameOf(...)}` and
 * `${maybe ? nameOf(...) : ""}` both count. A conditional is not unwrapped,
 * because there the name is a branch rather than the end of the expression, and
 * a mark after such a conditional is a mark after whatever it chose.
 */
const endsOnGhost = (node: ts.Node): boolean => {
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken) {
    const right = node.right;
    return (
      (ts.isStringLiteral(right) || ts.isNoSubstitutionTemplateLiteral(right)) && right.text === "?"
    );
  }
  if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
    return node.expression.text === "nameOf" || node.expression.text === "namesOf";
  }
  if (ts.isParenthesizedExpression(node)) return endsOnGhost(node.expression);
  if (ts.isConditionalExpression(node)) return endsOnGhost(node.whenTrue) || endsOnGhost(node.whenFalse);
  return false;
};

type Marked = { line: number; copy: string };

/**
 * Every place a sentence mark is written straight after a ghost, as a line
 * number and the copy a reader would see. Template spans and JSX children are
 * the two shapes a mark can follow an expression in; a bare `a ?? "?" + "."`
 * cannot be one without a `+` that is no more visible here than it is on screen.
 */
function markedGhosts(path: string, source: string): Marked[] {
  const file = ts.createSourceFile(
    path,
    source,
    ts.ScriptTarget.ESNext,
    true,
    path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const found: Marked[] = [];
  const record = (node: ts.Node, copy: string) => {
    found.push({
      line: file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1,
      copy: copy.replace(/\s+/g, " ").trim(),
    });
  };
  walk(file, (node) => {
    if (ts.isTemplateExpression(node)) {
      const pieces = [node.head, ...node.templateSpans.map((span) => span.literal)];
      for (const span of node.templateSpans) {
        if (endsOnGhost(span.expression) && SENTENCE_MARK.test(span.literal.text)) {
          record(node, pieces.map((piece) => piece.text).join("${…}"));
        }
      }
      return;
    }
    if (ts.isJsxElement(node) || ts.isJsxFragment(node)) {
      const children = node.children;
      for (let i = 0; i < children.length - 1; i += 1) {
        const child = children[i];
        const next = children[i + 1];
        if (
          child &&
          next &&
          ts.isJsxExpression(child) &&
          child.expression &&
          endsOnGhost(child.expression) &&
          ts.isJsxText(next) &&
          SENTENCE_MARK.test(next.text)
        ) {
          record(child, next.text.trim());
        }
      }
    }
  });
  return found;
}


describe("a sentence mark may not follow a ghost", () => {
  it("names nobody after a mark, on the one surface that renders a ghost today", () => {
    // A saved squad stores its result verbatim and is re-split against whatever
    // the roster holds now, so a player deleted since the save leaves a slot
    // whose id resolves to nobody (`reSplitSquad`, `src/shell/useSplitFlow.ts`).
    // The row is the reachable half of the swap prompt's lookup: it is the same
    // `roster.find(...)?` for the same id, and it is what a person actually sees
    // when a squad lost somebody.
    const roster: Player[] = ["Andi", "Budi", "Citra", "Dewi"].map((name, i) => ({
      id: `p${i + 1}`,
      communityId: "c1",
      name,
      capabilities: [
        {
          disciplineId: MLBB_DISCIPLINE.id,
          attributeRatings: { mechanics: 3, "game-sense": 3, "hero-pool": 3, teamwork: 3 },
          eligibleRoles: MLBB_DISCIPLINE.roles.map((r) => r.id),
          preferredRole: null,
        },
      ],
    }));
    const rated = (id: string) => ({
      playerId: id,
      roleId: null,
    });
    const result = recomputeResult(
      [
        { index: 0, slots: [rated("p1"), rated("gone")], totalStrength: 0, avgStrength: 0 },
        { index: 1, slots: [rated("p2"), rated("p3")], totalStrength: 0, avgStrength: 0 },
      ],
      MLBB_DISCIPLINE,
      [],
      roster,
    );
    const html = renderToStaticMarkup(
      createElement(SplitScreen, {
        session: {
          id: "s1",
          communityId: "c1",
          disciplineId: MLBB_DISCIPLINE.id,
          createdAt: 0,
          poolPlayerIds: roster.map((p) => p.id),
          settings: { teamCount: 2 },
          result,
        } satisfies Session,
        discipline: MLBB_DISCIPLINE,
        roster,
        onPersistResult: async () => {},
        source: "squad",
      }),
    );
    // The ghost is really on the screen, so the next assertion is about the mark
    // and not about a row that failed to render.
    expect(html).toContain('<span class="player-name">?</span>');
    expect(html).not.toContain("?.");
  });

  it("finds nothing in any file this repository ships", () => {
    const root = new URL("../../", import.meta.url);
    const paths = readdirSync(new URL("src/", root), { recursive: true, encoding: "utf8" })
      .filter((name) => /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name))
      .map((name) => `src/${name}`)
      .sort();
    const found = paths.flatMap((path) =>
      markedGhosts(path, readFileSync(new URL(path, root), "utf8")).map((hit) => ({ path, ...hit })),
    );
    expect(
      found,
      found.map((hit) => `${hit.path}:${hit.line} — ${hit.copy}`).join("\n"),
    ).toEqual([]);
  });

  it("would have found the swap prompt's full stop", () => {
    // The control. Without it the case above is a green light wired to nothing,
    // and a guard that cannot fail is the first thing deleted the next time a
    // copy string is unwelcome.
    const before = "const s = `swap with ${nameOf(roster, id)}.`;";
    const after = "const s = `swap with ${nameOf(roster, id)}`;";
    expect(markedGhosts("probe.ts", before)).toHaveLength(1);
    expect(markedGhosts("probe.ts", after)).toHaveLength(0);
  });

  it("does not count a comment, and does count a JSX text mark", () => {
    // The other half of the control: this repository writes `?.` in prose to
    // explain the rule, so a text scan would report the explanation as the
    // offence, and a guard that cries wolf is a guard that gets deleted.
    const explained = [
      "/** A full stop here prints `?.` for an id the roster no longer holds. */",
      "export const a = 1;",
    ].join("\n");
    expect(markedGhosts("probe.ts", explained)).toEqual([]);
    const jsx = "const el = <p>{player?.name ?? \"?\"}.</p>;";
    expect(markedGhosts("probe.tsx", jsx)).toHaveLength(1);
    expect(markedGhosts("probe.tsx", "const el = <p>{player?.name ?? \"?\"}</p>;")).toEqual([]);
  });
});
