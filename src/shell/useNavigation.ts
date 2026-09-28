import { useState } from "react";
import type { Id } from "../domain/types";
import type { SplitSource } from "./useSplitFlow";

export type View =
  | { mode: "roster" }
  | { mode: "dashboard" }
  | { mode: "games" }
  | { mode: "history" }
  | { mode: "disciplines" }
  | { mode: "squads" }
  | { mode: "tournament"; id: Id }
  | { mode: "match"; source: SplitSource }
  | { mode: "split"; source: SplitSource };

export type HubMode = "dashboard" | "roster" | "games" | "history" | "squads";

/** `[...stack, v]` — what `pushView` did inline. */
export function pushStack(stack: View[], v: View): View[] {
  return [...stack, v];
}

/** One level down, never empty — the `s.length > 1` guard `goBack` had inline.
 *  A root Back is a no-op, so the app never renders a view-less shell. */
export function popStack(stack: View[]): View[] {
  return stack.length > 1 ? stack.slice(0, -1) : stack;
}

/** A hub replaces the stack — what `gotoHub` did inline. */
export function hubStack(mode: HubMode): View[] {
  return [{ mode }];
}

export function currentView(stack: View[]): View {
  return stack[stack.length - 1];
}

export function useNavigation(initial: View) {
  const [viewStack, setViewStack] = useState<View[]>([initial]);
  const view = currentView(viewStack);

  const pushView = (v: View) => setViewStack((s) => pushStack(s, v));
  const goBack = () => setViewStack((s) => popStack(s));
  const resetTo = (v: View) => setViewStack([v]);
  const gotoHub = (mode: HubMode) => setViewStack(hubStack(mode));

  return { view, viewStack, pushView, goBack, gotoHub, resetTo };
}
