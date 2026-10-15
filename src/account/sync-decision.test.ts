import { describe, expect, it } from "vitest";
import { decideSync } from "./sync-decision";

/**
 * All four outcomes, pinned. The function's failure mode is data loss, so each
 * branch is an observable contract, not an implementation detail.
 */
describe("decideSync", () => {
  it("rejects a push based on a version the server has moved past", () => {
    // The silent-loss case: another device wrote first.
    expect(decideSync({ local: "doc", lastKnownVersion: 3, serverVersion: 4 })).toBe("reject-stale");
  });

  it("pushes when the version is unchanged", () => {
    expect(decideSync({ local: "doc", lastKnownVersion: 4, serverVersion: 4 })).toBe("push");
  });

  it("is a no-op when the payload is already what the server holds", () => {
    expect(decideSync({ local: "doc", lastKnownVersion: 4, serverVersion: 4, identical: true })).toBe("no-op");
  });

  it("adopts when the server has nothing and this device has data", () => {
    expect(decideSync({ local: "doc", lastKnownVersion: null, serverVersion: null })).toBe("push-and-adopt");
  });

  it("does nothing when nothing local is pending, whatever the server holds", () => {
    expect(decideSync({ local: null, lastKnownVersion: 4, serverVersion: 4 })).toBe("no-op");
    expect(decideSync({ local: null, lastKnownVersion: 4, serverVersion: 9 })).toBe("no-op");
  });

  it("refuses when this device has never synced but the server is not empty", () => {
    // Another device created the document; this one has no basis to push over it.
    expect(decideSync({ local: "doc", lastKnownVersion: null, serverVersion: 2 })).toBe("reject-stale");
  });
});
