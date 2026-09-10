import type { ReactNode } from "react";

interface Props {
  /** Small label above the title. Omit when the title already says it. */
  kicker?: string;
  title: string;
  /** One line of context. Omit when the screen has nothing useful to add. */
  lede?: ReactNode;
  /** Breadcrumb rendered above the title for drill-down screens. */
  crumbs?: ReactNode;
}

/**
 * The masthead every screen shares. Screens previously hand-rolled this
 * four different ways (kicker+h1+lede, h1+lede, breadcrumb+h1+subtitle), which
 * is why headings drifted in size and spacing between pages.
 */
export function PageHeader({ kicker, title, lede, crumbs }: Props) {
  return (
    <header className="page-header">
      {crumbs}
      {kicker && <div className="kicker">{kicker}</div>}
      <h1>{title}</h1>
      {lede && <div className="lede">{lede}</div>}
    </header>
  );
}
