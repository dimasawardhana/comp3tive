/**
 * Who owns the ✚ form's visibility, asserted as a fact about the interface.
 *
 * ## The finding
 *
 * `AppChromeProps` declared `showAddCommunity: boolean` and passed a doc line
 * saying *the ✚ form lives in App's `<main>`, so its visibility is App's to
 * toggle*. `AppChrome` destructured six props and this was not one of them; the
 * word did not appear again in the file. The one production call site passed it,
 * and the one place it was read was `src/App.tsx:426`, thirty lines from the
 * element that owns the button.
 *
 * **The feature was never dead and the gate was never misplaced.** The defect is
 * narrower: the prop claimed a knowledge the chrome does not have. A reader who
 * trusted it would reasonably reach for `aria-expanded` on the ✚, and that change
 * would be wrong, because the chrome cannot know which state the form is in.
 * Nothing would fail. So the prop is removed and the truth it stated is kept, on
 * the prop the chrome really does read.
 *
 * ## What this file holds
 *
 * The absence, so the interface cannot quietly grow the lie back, and the
 * surviving doc's claim, so the *fact* that App owns the gate does not rot into a
 * forgotten design note. It does not test that the form toggles: that is App's
 * gate, and testing it here would mean testing `App`'s render through a props
 * interface that is the subject of the deletion.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { AppChromeProps } from "./AppChrome";

const source = (): string => readFileSync(new URL("./AppChrome.tsx", import.meta.url), "utf8");

describe("the shell's props, and the one the shell does not take", () => {
  it("does not declare showAddCommunity, because the chrome never reads it", () => {
    // The type is the assertion, and `tsc` enforces it rather than a test run:
    // an interface is erased, so there is nothing here to interrogate at
    // runtime. `keyof` is the check, and a returned prop fails the build.
    type _NoVisibilityProp = "showAddCommunity" extends keyof AppChromeProps ? never : true;
    const absent: _NoVisibilityProp = true;
    expect(absent).toBe(true);
  });

  it("names the prop nowhere in the file, so it cannot be half-removed", () => {
    // The residue check the contract leaves behind. A declaration deleted while a
    // use or a doc mention survives is worse than the original lie: it reads as
    // a half-finished migration rather than as a decision.
    expect(source()).not.toContain("showAddCommunity");
  });

  it("still takes the toggle, which is the half of the gate the chrome can hold", () => {
    // The removal took the visibility flag, not the control. The ✚ button reads
    // `onToggleAddCommunity` at its own `onClick`, so the chrome's half of the
    // gate is intact and App keeps the other.
    type _TakesTheToggle = "onToggleAddCommunity" extends keyof AppChromeProps ? true : never;
    const present: _TakesTheToggle = true;
    expect(present).toBe(true);
    expect(source()).toContain("props.onToggleAddCommunity()");
  });

  it("keeps the fact the removed doc stated, on the prop that survives", () => {
    // App does own the gate, and that is worth knowing: it is why the ✚ is a
    // plain button with no `aria-expanded`, and why the gate at
    // `src/App.tsx:426` is not going to move into the chrome. The doc moved with
    // the truth rather than being deleted along with the lie.
    expect(source()).toContain("The ✚ form lives in App's `<main>`, so its visibility is App's to toggle.");
    expect(source()).toContain("the chrome never learns the answer");
  });

  it("gives the ✚ no expanded state, because there is no state to report", () => {
    // The specific mistake the removed prop invited. An `aria-expanded` on the
    // ✚ would be a false claim told to a screen reader rather than merely a dead
    // prop, so it is worth a test rather than a reviewer's memory.
    //
    // Scoped to the ✚ and not to the file: the community menu and the settings
    // popover are menus **this** component owns the open state of, so their
    // `aria-expanded` is true and stays. The ✚ opens a form App renders outside
    // the chrome, and that asymmetry is exactly what the removed prop papered
    // over by pretending the chrome knew.
    const addButton = /<button\s+type="button"\s+className="icon-btn"\s+aria-label="New community"[\s\S]*?>/.exec(source());
    expect(addButton?.[0]).toBeDefined();
    expect(addButton?.[0]).not.toContain("aria-expanded");
    // And the one menu that does own its state still says so, so the fix is not
    // "strip every `aria-expanded` in the file". (The settings popover's trigger
    // carries none today; that is a pre-existing gap on a menu this component
    // *does* own, and it is not this amendment's business.)
    expect(source()).toContain("aria-expanded={showCommunityMenu}");
  });
});
