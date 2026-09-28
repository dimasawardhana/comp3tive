import { describe, expect, it } from "vitest";
import { createElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Breadcrumb, type Crumb } from "./nav";

/**
 * The shared breadcrumb's contract, in the only form a node-environment test can
 * check: what it puts in the document, and what its anchor does when fired.
 *
 * Rendered with `createElement` rather than JSX because the suite collects
 * `.test.ts` only — a `.tsx` test would not be run.
 */
const render = (crumbs: Crumb[]) => renderToStaticMarkup(createElement(Breadcrumb, { crumbs }));

type HostProps = Record<string, unknown>;

/** Host elements in document order, flattened through the per-crumb Fragments. */
function hosts(node: ReactNode, out: ReactElement[] = []): ReactElement[] {
  if (Array.isArray(node)) {
    for (const child of node) hosts(child, out);
    return out;
  }
  if (!isValidElement(node)) return out;
  const el = node as ReactElement<HostProps>;
  if (typeof el.type === "string") out.push(el);
  return hosts(el.props.children as ReactNode, out);
}

/** The props of a host element, so a test can fire its handler. */
const propsOf = (el: ReactElement) => el.props as HostProps;

describe("Breadcrumb", () => {
  it("emits the flat markup the three hand-rolled copies emitted", () => {
    // Byte for byte what MatchScreen, TournamentScreen and SplitScreen rendered
    // before they adopted this component: three children under the flex row, so
    // `.breadcrumb`'s 6px gap falls around the separator rather than around a
    // wrapper.
    expect(render([{ label: "Roster", go: () => {} }, { label: "Match setup" }])).toBe(
      '<div class="breadcrumb"><a href="#">Roster</a><span class="sep">/</span><span>Match setup</span></div>',
    );
    expect(render([{ label: "Games", go: () => {} }, { label: "Weekly Cup" }])).toBe(
      '<div class="breadcrumb"><a href="#">Games</a><span class="sep">/</span><span>Weekly Cup</span></div>',
    );
    expect(render([{ label: "Match setup", go: () => {} }, { label: "Split result" }])).toBe(
      '<div class="breadcrumb"><a href="#">Match setup</a><span class="sep">/</span><span>Split result</span></div>',
    );
  });

  it("renders a crumb as a link exactly when it has somewhere to go", () => {
    // The Landing Page mounts SplitScreen with no onBack: the first crumb has no
    // destination, so it must read as text — and the current crumb never links
    // back to itself.
    expect(render([{ label: "Match setup" }, { label: "Split result" }])).toBe(
      '<div class="breadcrumb"><span>Match setup</span><span class="sep">/</span><span>Split result</span></div>',
    );
    // A destination on the final crumb is honoured rather than dropped: the old
    // positional rule made the last crumb text whatever it was given.
    expect(render([{ label: "Split result", go: () => {} }])).toContain('<a href="#">Split result</a>');
    expect(render([{ label: "Split result" }])).not.toContain("<a");
  });

  it("calls the crumb's destination when the link is clicked", () => {
    let went = 0;
    let defaulted = 0;
    const [root, first] = hosts(Breadcrumb({ crumbs: [{ label: "Roster", go: () => went++ }, { label: "Match setup" }] }));
    expect(propsOf(root).className).toBe("breadcrumb");

    const onClick = propsOf(first).onClick as (e: { preventDefault: () => void }) => void;
    onClick({ preventDefault: () => defaulted++ });
    expect(went).toBe(1);
    // `href="#"` would otherwise scroll the document to the top.
    expect(defaulted).toBe(1);
  });

  it("keys two crumbs of the same label distinctly", () => {
    // A tournament may legitimately be named "Games", which is also the hub
    // crumb above it — React would warn on duplicate keys in one list.
    const [root] = hosts(Breadcrumb({ crumbs: [{ label: "Games", go: () => {} }, { label: "Games" }] }));
    const keys = (propsOf(root).children as ReactElement[]).map((frag) => frag.key);
    expect(keys).toHaveLength(2);
    expect(new Set(keys).size).toBe(2);
  });
});
