import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ConfirmButton } from "./ConfirmButton";

/**
 * The two-step's contract, in the only form a node-environment test can check:
 * what the idle state puts in the document. The click is what turns it into the
 * confirm, and the e2e specs' second click depends on the confirm copy not being
 * there before it.
 *
 * Rendered with `createElement` rather than JSX because the suite collects
 * `.test.ts` only — a `.tsx` test would not be run.
 */
type Props = Parameters<typeof ConfirmButton>[0];
const render = (props: Omit<Props, "onConfirm">) =>
  renderToStaticMarkup(createElement(ConfirmButton, { onConfirm: () => {}, ...props }));

describe("ConfirmButton", () => {
  it("is the caller's control, and holds the warning back until asked", () => {
    const html = render({ label: "Delete", confirmLabel: "Delete player", message: 'Delete player "P"?' });
    expect(html).toContain('class="btn btn-ghost"');
    expect(html).toContain(">Delete</button>");
    // The whole point of the two-step: none of the confirm is addressable yet.
    expect(html).not.toContain("Delete player");
    expect(html).not.toContain("Cancel");
    expect(html).not.toContain("status-msg");
  });

  it("keeps a repeated row's unique accessible name and its own class", () => {
    const html = render({
      label: "Delete",
      className: "link danger",
      ariaLabel: "Delete session",
      confirmLabel: "Delete session",
      message: "Delete this session?",
    });
    expect(html).toContain('class="link danger"');
    expect(html).toContain('aria-label="Delete session"');
    // The name is the caller's, so it stays unique among repeated rows.
    expect(html).not.toContain("Delete this session?");
  });
});
