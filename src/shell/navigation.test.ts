import { describe, expect, it } from "vitest";
import { currentView, hubStack, popStack, pushStack, type View } from "./useNavigation";

const dashboard: View = { mode: "dashboard" };
const games: View = { mode: "games" };
const tournament: View = { mode: "tournament", id: "t1" };
const match: View = { mode: "match", source: "tournament" };

describe("pushStack", () => {
  it("appends without mutating the input", () => {
    const stack: View[] = [dashboard];
    expect(pushStack(stack, match)).toEqual([dashboard, match]);
    expect(stack).toEqual([dashboard]);
  });
});

describe("popStack", () => {
  it("round-trips a push", () => {
    expect(popStack(pushStack([dashboard], match))).toEqual([dashboard]);
  });

  it("never returns an empty stack at the root", () => {
    const root: View[] = [dashboard];
    expect(popStack(root)).toEqual([dashboard]);
    expect(currentView(popStack(root))).toEqual(dashboard);
    // The property, not one input: every stack the app can hold pops to a stack
    // that still has a current view. Both navs read `viewStack[0].mode` unguarded,
    // so a zero-length stack is a TypeError, not a blank screen.
    const spine: View[] = [dashboard, match, tournament, { mode: "split", source: "session" }];
    const hubs: View[] = [
      { mode: "dashboard" }, { mode: "roster" }, games, { mode: "history" }, { mode: "squads" },
    ];
    for (let depth = 1; depth <= spine.length; depth++) {
      for (const bottom of hubs) {
        const stack = [...spine.slice(0, depth - 1), bottom];
        expect(stack).toHaveLength(depth);
        expect(popStack(stack).length).toBeGreaterThanOrEqual(1);
        expect(currentView(popStack(stack))).toBeDefined();
      }
    }
  });

  it("pops one level from a depth-3 stack", () => {
    expect(popStack([dashboard, match, tournament])).toEqual([dashboard, match]);
  });
});

describe("hubStack", () => {
  it("collapses a depth-3 stack to a single hub view", () => {
    expect(hubStack("games")).toEqual([games]);
  });
});

describe("currentView", () => {
  it("is the last pushed view", () => {
    const stack = pushStack(hubStack("games"), tournament);
    expect(currentView(stack)).toEqual(tournament);
  });
});

describe("the tournament-create sequence", () => {
  it("leaves Games beneath the new tournament, so Back returns to Games", () => {
    const stack = pushStack(hubStack("games"), { mode: "tournament", id: "built-1" });
    expect(stack).toEqual([games, { mode: "tournament", id: "built-1" }]);
    expect(currentView(stack)).toEqual({ mode: "tournament", id: "built-1" });
    expect(currentView(popStack(stack))).toEqual(games);
  });
});
