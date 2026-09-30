/**
 * The CSV an organizer downloads to start from, and the name it arrives under.
 *
 * This file and `parsePlayerCsv` are two ends of one contract. The tie between
 * them is `src/data/csv-template.test.ts` and not a shared directory or a
 * co-located comment, because `src/data/player-import.ts` is Phase A's and this
 * phase only reads it. A template the parser refuses is worse than no template:
 * the user fills every cell correctly, is handed a parse error, and concludes
 * the app cannot read their spreadsheet — so the test asserts the round trip
 * through the shipped parser, never that the strings look right.
 *
 * **What the file does not contain: instructions.** The parser has no comment
 * syntax, so a `#` or `//` line is a data row whose strength column is not a
 * number, and it would reach the user as a skipped line on an otherwise clean
 * file — the first thing this template teaches would be a failure. A blank line
 * is free but cannot carry text. The instructions therefore live in the app,
 * in `RosterScreen`'s `.import-hint`, where they are also readable by someone
 * who has not downloaded anything yet.
 *
 * **The two example rows are named so that leaving one behind is self-evident,
 * because the name is the only marker there is.** No rule distinguishes an
 * example from a real entry today: the row is a name, a discipline and a
 * number, and the app writes it exactly as it would write a teammate.
 *
 * That is a deferral with an owner, not a constraint of Phase A. An "is this an
 * example" column would need `parsePlayerCsv`, which this phase may not
 * change — but the parser is not the only place such a rule could live, and
 * saying otherwise would be a false limitation. `importFile` in
 * `src/shell/usePlayerImport.ts` is the app's CSV import path, it is listed in
 * `contracts.md`'s Phase D table as a C file this phase extends, and it holds
 * the parsed `rows` before it writes anything. With no parser change and no new
 * dependency it could drop these two rows, or push a synthetic
 * `ImportSkip({ line, reason: "Looks like a template example row — delete it if
 * you did not mean to import it." })` into the import report the next task
 * builds. That belongs to the task that builds the report, not to the one that
 * writes this file.
 *
 * Until it does, the marker has to live in the name itself, and it has to be a
 * string no one would give a person. "Andi" would not be — a leftover Andi is a
 * ghost the user has to notice and remember to delete, and worse, one they may
 * read as a real teammate. Every example name here starts with
 * `Example Player` and carries a number, so a roster that still holds one says
 * on its face that the file was not finished. That is the whole defence today,
 * and `csv-template.test.ts` holds it.
 *
 * **Row two is quoted on purpose.** It is the one piece of CSV syntax a user
 * cannot guess: an unquoted comma inside a name splits the record, the third
 * column stops being a number, and the row is refused. A template that showed
 * only unquoted rows would leave the rule to the hint alone, and the hint is not
 * where a user looks while editing the file.
 */
export const CSV_TEMPLATE = [
  // The header is the parser's header triple: `name` alone in column one, and a
  // third column that is not a rating. Matching it exactly is what makes the
  // parser read this line as a heading rather than as a player called "name".
  "name,discipline,strength",
  "Example Player 1,futsal,4",
  '"Example Player 2, delete me",mlbb,3',
  // A trailing newline, which is what a file that has been saved rather than
  // built by a string join looks like. The parser skips the blank line it makes.
  "",
].join("\n");

/**
 * The name the browser writes the file under, which is a decision rather than a
 * detail: a file's usefulness includes being findable in a Downloads folder
 * among the roster exports, and being recognisable as a blank form rather than
 * somebody's roster.
 *
 * `comp3tive-` matches the backup export's own prefix, so both downloads sort
 * together and neither is orphaned under a generic name. No date, unlike
 * `comp3tive-backup-<date>.json`: this file's bytes never change, so a date
 * would be a claim about freshness that is false the moment it is written, and
 * it would litter the folder with identical copies on every visit.
 */
export const CSV_TEMPLATE_FILE_NAME = "comp3tive-players-template.csv";
