import type { Id } from "./domain/types";

export type CrumbGo = () => void;

export interface Crumb {
  label: string;
  go?: CrumbGo;
}

export function Breadcrumb({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <div className="breadcrumb">
      {crumbs.map((c, i) => {
        const last = i === crumbs.length - 1;
        return (
          <span key={i}>
            {i > 0 && <span className="sep">/</span>}
            {last ? (
              <span>{c.label}</span>
            ) : c.go ? (
              <a href="#" onClick={(e) => { e.preventDefault(); c.go!(); }}>
                {c.label}
              </a>
            ) : (
              <span>{c.label}</span>
            )}
          </span>
        );
      })}
    </div>
  );
}
