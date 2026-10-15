import { describe, expect, it } from "vitest";
import { decideSignInAction } from "./useAccount";

/**
 * The sign-in decision, pinned branch by branch.
 *
 * The decision is the one place a sign-in chooses between destroying nothing,
 * adopting, and replacing the device; every branch below is an observable
 * contract of ticket 05, and the runner that acts on the answer is exercised
 * end to end by the deployed app (the confirm branch needs a real dialog).
 */
describe("decideSignInAction", () => {
  it("adopts when the Account has no data, even from an empty device", () => {
    // A fresh device founding an Account is ordinary: its default community
    // becomes the Account's first document.
    expect(decideSignInAction(false, false)).toBe("adopt");
    expect(decideSignInAction(true, false)).toBe("adopt");
  });

  it("pulls without a prompt when the device has nothing to lose", () => {
    expect(decideSignInAction(false, true)).toBe("pull");
  });

  it("asks before replacing a non-empty device with the Account's data", () => {
    expect(decideSignInAction(true, true)).toBe("confirm-pull");
  });
});
