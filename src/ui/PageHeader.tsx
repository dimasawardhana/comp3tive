import type { ReactNode } from "react";

interface Props {
  title: string;
  /** One line of context. Omit when the screen has nothing useful to add. */
  lede?: ReactNode;
  /** Breadcrumb rendered above the title for drill-down screens. */
  crumbs?: ReactNode;
  /** The screen's most frequent job, rendered beside the title. */
  action?: ReactNode;
}

/**
 * The masthead every screen shares: an `h1` and, optionally, crumbs, one lede
 * line and the screen's primary action.
 *
 * There is deliberately no kicker. A small label above a heading either repeats
 * the heading or carries a category the heading should have said itself, and
 * both are how a screen ends up with an eyebrow that means nothing. If a screen
 * needs context, it goes in the `lede`.
 */
export function PageHeader({ title, lede, crumbs, action }: Props) {
  return (
    <header className={action ? "page-header page-header--with-action" : "page-header"}>
      {crumbs}
      <div className="page-header-main">
        <h1>{title}</h1>
        {lede && <p className="lede">{lede}</p>}
      </div>
      {action && <div className="page-header-action">{action}</div>}
    </header>
  );
}
