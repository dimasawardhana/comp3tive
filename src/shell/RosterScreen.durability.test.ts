import { describe, expect, it } from "vitest";
import { PREDICTS_LOSS, SAFETY_BAN } from "../test-support/safetyCopy";
import { renderRoster } from "../test-support/renderRoster";

/**
 * The storage note is the one place this app speaks about durability, and it
 * is spoken in the only tense that is true: what the browser reported, this
 * page load, with the standing instruction attached.
 *
 * The verdict is passed in as a prop rather than read through the hook, because
 * `renderToStaticMarkup` runs no effects: the hook would answer `null` for every
 * case here and the two live verdicts would go untested. The hook's own side of
 * this contract is `useDurability.test.ts`; the browser conversation is
 * `probePersistence` there too; what is left untestable in node is layout, and
 * e2e/tests/dashboard/nudge.spec.ts is where this is actually read on screen.
 */

const PERSISTED_COPY =
  "This browser reported persistent storage for this app on this visit. Keep a backup anyway.";
const REFUSED_COPY =
  "This browser reports this app's data is not stored persistently. Keep a backup.";
const UNKNOWN_COPY = "This app could not confirm persistent storage here. Keep a backup.";

/** RosterScreen renders nothing of the toolbar without a community. */
const screen = (persisted: boolean | null): string => renderRoster({ persisted });

/** The text inside the note element, so an assertion cannot be satisfied by the Export button. */
const noteText = (html: string): string => {
  const note = /<span class="durability-note">([\s\S]*?)<\/span>/.exec(html);
  if (note === null) throw new Error("the note did not render");
  return note[1].replace(/\s+/g, " ").replaceAll("&#x27;", "'").trim();
};

describe("the roster's storage note", () => {
  it("reports a granted verdict in the past tense, because that is all it is", () => {
    expect(noteText(screen(true))).toBe(PERSISTED_COPY);
    // "reported … on this visit" is the hedge: the reading happened, and
    // nothing re-checks it. The present-tense version of this same line reads
    // as a standing property of the browser, which is the defect.
    expect(PERSISTED_COPY).toMatch(/^This browser reported /);
  });

  it("promises nothing in any of the three verdicts", () => {
    for (const persisted of [true, false, null]) {
      // The whole failure this task exists to prevent: a reader who installs a
      // PWA to store a roster, reads a reassuring line, and stops backing up.
      expect(noteText(screen(persisted))).not.toMatch(SAFETY_BAN);
    }
  });

  it("reports a refused verdict as a statement about the browser, not a prediction of loss", () => {
    expect(noteText(screen(false))).toBe(REFUSED_COPY);
    // "not stored persistently" is what the browser answered. It does not say
    // the data is gone, and it does not say when it will be.
    expect(REFUSED_COPY).not.toMatch(PREDICTS_LOSS);
  });

  it("blames the app and not the browser for the unknown, because `null` is the first paint of every load", () => {
    expect(noteText(screen(null))).toBe(UNKNOWN_COPY);
    // `persisted` is null on the very first render of every load, so this is
    // the most-read branch in the app — and the app has not finished asking.
    // "This browser could not confirm…" would be false for the whole of that
    // window and false again for an origin with no Storage API at all.
    expect(UNKNOWN_COPY).toMatch(/^This app could not confirm /);
  });

  it("gives each of the three verdicts its own sentence", () => {
    const lines = [screen(true), screen(false), screen(null)].map(noteText);
    // A truthiness test would collapse two of these three onto one line, which
    // is how an unknown ends up rendered as bad news.
    expect(new Set(lines).size).toBe(3);
  });

  it("ends every verdict with an instruction rather than a reassurance", () => {
    for (const persisted of [true, false, null]) {
      // The granted case adds "anyway" on purpose: it is the one place a
      // reader could mistake the browser's answer for permission to stop.
      expect(noteText(screen(persisted))).toMatch(/Keep a backup\b/);
    }
  });

  it("cannot render an empty note: every verdict produces text", () => {
    for (const persisted of [true, false, null]) {
      expect(noteText(screen(persisted))).not.toBe("");
    }
  });

  it("sits between the toolbar's spacer and the Export button it talks about", () => {
    const html = screen(null);
    const spacer = html.indexOf("roster-toolbar-spacer");
    const note = html.indexOf("durability-note");
    const button = html.indexOf(">Export<");
    expect(spacer).toBeGreaterThan(-1);
    expect(note).toBeGreaterThan(spacer);
    expect(button).toBeGreaterThan(note);
  });

  it("leaves the Export control itself untouched", () => {
    const html = screen(false);
    expect(html).toContain('<button class="btn btn-ghost">Export</button>');
  });
});
