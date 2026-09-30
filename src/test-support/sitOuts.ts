/**
 * The reader's count of the not-playing list, in one place.
 *
 * **Why this is a module and not a constant beside either test — do not collapse
 * it.** The same parse is wanted by `src/share/fairness.test.ts` and by
 * `src/session/SplitScreen.fairness.test.ts`, and those are two `.test.ts` files.
 * Importing one of them into the other executes the donor's `describe` and `it`
 * calls in the importer's module graph, so vitest collects its cases a second time
 * and the suite doubles; `safetyCopy.ts` was made a module for exactly that reason
 * and the silence of it is the reason the rule is written down here. A parse
 * duplicated across two files is also two parses: one of them drifts, and the copy
 * that drifts is the one nobody re-reads.
 *
 * The vitest include glob matches only `.test.ts` under `src`, so this file is
 * never collected as a test.
 */

/**
 * The label the three shipped surfaces anchor a sit-out list on
 * (`fairness.ts`, `share-text.ts`, `share-image.ts`). It is not a parameter
 * because the three print the same one, and a parameter would let a test assert
 * against a label the app never emits.
 */
const NOT_PLAYING = "Not playing: ";

/**
 * A character that can be part of a name as the app prints one: a letter, a
 * digit, an apostrophe, a comma between two names, a space inside a name, or the
 * `?` that an id no roster holds falls back to. Anything else ends the list.
 */
const NAME_CHAR = /[^'\p{L}\p{N}, ?]/u;

/**
 * The sit-outs as a reader counts them: the run after the label, read forward as
 * comma-separated names and stopped at the first character that cannot be part of
 * a name or of the comma between two.
 *
 * The stop is the whole claim. A reader ends the list on a mark, and a list that
 * never ends goes on eating the sentence after it, so any mark satisfies this and
 * none is named. Naming one would make a caller a restatement of the fix instead
 * of a statement about the line.
 *
 * `?` is inside the name class on purpose. The module prints it as the name of an
 * id the roster no longer holds, so a reader reads an entry, and a parse that
 * stopped at the `?` would report that entry as empty: on the line where the
 * unknown id is the whole list, it returns `[""]` and a maintainer debugging the
 * composed line is sent after an entry that was never empty.
 */
export function sitOuts(line: string): string[] {
  const at = line.indexOf(NOT_PLAYING);
  if (at < 0) return [];
  const run = line.slice(at + NOT_PLAYING.length);
  const end = run.search(NAME_CHAR);
  return run
    .slice(0, end < 0 ? run.length : end)
    .split(", ")
    .map((piece) => piece.trim());
}
