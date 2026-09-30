/**
 * The contract of `sitOuts`, pinned next to the helper rather than inside one of
 * its callers.
 *
 * The failure this file exists for is a *silent* one. Every other case that
 * exercises the parse lives in `src/share/fairness.test.ts` or in
 * `src/session/SplitScreen.fairness.test.ts`, and a case that lived in a consumer
 * would be one deletion away from vanishing: with both consumers gone, nothing
 * would hold the guard, and the next parse to answer `[]` for a line it cannot
 * read would go out unnoticed. `safetyCopy.ts` needs no file of its own because a
 * regex has no behaviour to get wrong; this helper has one, and that is the whole
 * reason it is a module.
 */
import { describe, expect, it } from "vitest";
import { sitOuts } from "./sitOuts";

describe("sitOuts", () => {
  it("reads a comma-separated list and stops at the mark that closes it", () => {
    expect(sitOuts("Every team averages 3.5 to 4.0. Not playing: Dewi, Citra; Andi (5.0) is Team A's best;")).toEqual([
      "Dewi",
      "Citra",
    ]);
  });

  it("reads a list the line ends on, with no mark to stop at", () => {
    expect(sitOuts("Every team averages 4.0. Not playing: Dewi, Citra")).toEqual(["Dewi", "Citra"]);
  });

  it("reads the `?` an unknown id prints as a name, not as the end of the list", () => {
    expect(sitOuts("Every team averages 4.0. Not playing: ?")).toEqual(["?"]);
  });

  it("throws on a line with no label, and says which label and which line", () => {
    // The guard this module was corrected to hold. A line with no label is not a
    // line with no sit-outs; returning `[]` for it made every caller green while
    // they parsed nothing, which is the blindness the throw removes. Fails if the
    // missing label is answered with an empty list again, and fails if either
    // fact is dropped from the message, since the message is all a maintainer
    // has to go on.
    //
    // The line is the fairness line with its sit-out clause renamed away, which
    // is the shape a copy change would take.
    const renamed = "Every team averages 3.0 to 4.2. Sat out: Lina, Mira; Fajar (5.0) is Team B's best;";
    expect(() => sitOuts(renamed)).toThrow("Not playing:");
    expect(() => sitOuts(renamed)).toThrow(renamed);
  });
});
