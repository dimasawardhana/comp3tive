import { Fragment } from "react";

export type CrumbGo = () => void;

export interface Crumb {
  label: string;
  go?: CrumbGo;
}

/**
 * One breadcrumb shape for the three screens that hand-rolled it: flat children,
 * one separator between segments, no wrapper element. A crumb renders as a link
 * if and only if it has somewhere to go — a link that goes nowhere is worse than
 * no link (docs/FLOW.md §3).
 */
export function Breadcrumb({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <div className="breadcrumb">
      {crumbs.map((c, i) => (
        <Fragment key={`${i}-${c.label}`}>
          {i > 0 && <span className="sep">/</span>}
          {c.go ? (
            <a href="#" onClick={(e) => { e.preventDefault(); c.go!(); }}>{c.label}</a>
          ) : (
            <span>{c.label}</span>
          )}
        </Fragment>
      ))}
    </div>
  );
}
