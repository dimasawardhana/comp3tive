import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Extra modifier classes for screens with a bespoke layout. */
  className?: string;
}

/**
 * The content column every screen sits in. Previously three screens got this
 * wrapper from App and six rendered their own, which made the gap and padding
 * inconsistent between pages.
 */
export function Screen({ children, className }: Props) {
  return <div className={className ? `screen ${className}` : "screen"}>{children}</div>;
}
