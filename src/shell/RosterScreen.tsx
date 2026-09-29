import { useState } from "react";
import type { Community, Discipline, Id, Player } from "../domain/types";
import { PageHeader } from "../ui/PageHeader";
import { Screen } from "../ui/Screen";
import { PlayerEditModal } from "../roster/PlayerEditModal";
import { BulkRateModal, rateConfirmation } from "../roster/BulkRateModal";
import type { ImportReport, ImportSkip, PendingMerge } from "./usePlayerImport";
import { TEMPLATE_EXAMPLE_REASON_MARKER } from "./usePlayerImport";
import type { ToastType } from "./useToasts";
import { formatError } from "../ui/format";
import { CSV_TEMPLATE, CSV_TEMPLATE_FILE_NAME } from "../data/csv-template";

export interface RosterScreenProps {
  activeCommunity: Community | null;
  disciplines: Discipline[];
  players: Player[];                 // scoped
  visiblePlayers: Player[];
  filterIds: Id[];
  disciplinesById: Map<Id, Discipline>;
  editingPlayer: Player | null | "new";
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onToggleFilter: (disciplineId: Id) => void;
  onClearFilters: () => void;
  onAddPlayer: () => void;
  onOpenPlayer: (player: Player) => void;
  /** The backup merge's two-step. Null until a backup names something new. */
  pendingMerge: PendingMerge | null;
  onConfirmMerge: () => void;
  onCancelMerge: () => void;
  importFile: (file: File) => Promise<void>;
  onExport: () => void;
  onSplitMatch: () => void;
  onSavePlayer: (player: Player) => Promise<void>;
  onDeletePlayer: (id: Id) => Promise<void>;
  onCloseEditor: () => void;
  /**
   * The browser's persistence verdict for this origin, forwarded from
   * `useDurability`. Tri-state on purpose, and the three cases are three
   * different policies:
   *
   *  - `true` — the only basis for saying anything reassuring, and only in the
   *    past tense and attributed to the browser, because the whole claim is one
   *    reading that happened on this visit. "Reported … on this visit" is not
   *    decoration: `persisted` is a measurement taken once, nothing re-checks
   *    it, and the user can still clear site data. The tense is the hedge.
   *  - `false` — the only basis for saying the data is not stored persistently,
   *    and the only thing that raises the export nudge. Present tense, because
   *    the condition is the state of the world and not an event that has
   *    happened to it.
   *  - `null` — nobody has answered, which is this app's fact and not the
   *    browser's: the probe has not settled, or there is no API to ask. An
   *    unknown is not a refusal, so it is never rendered as bad news — and the
   *    sentence never names the browser as the cause, because it is the app
   *    that has no answer. `null` is the state of the very first render of
   *    every load, so this is the most-read branch in the app.
   *
   * The note is written as three explicit comparisons rather than a truthiness
   * test, on purpose: `!persisted` folds `null` into the refusal branch, and
   * `persisted && …` renders nothing at all for both unknown and refused. One
   * control, two policies, one of them a lie.
   */
  persisted: boolean | null;
  /**
   * The most recent CSV import's outcome, or null before the first one.
   *
   * C27's shape and not a local one, per `contracts.md`: the hook decides what
   * an import's outcome *is*, and the screen only renders it. It is `null` for
   * every import that was not a CSV — a players-only JSON roster and a backup
   * merge report themselves through toasts and the merge banner, and widening
   * this prop to carry those would mean inventing skip reasons this screen has
   * no way to group.
   */
  lastReport: ImportReport | null;
  /**
   * The toast seam. `useToasts()` is called once, in `App.tsx`, and threaded
   * down: a second call here would build a list of messages nothing renders
   * (`src/shell/useToasts.ts:14-22`). The bulk rate is the second write on this
   * screen that reports itself through a toast rather than a panel, and
   * `lastReport` is deliberately typed to CSV verdicts, so it cannot carry it.
   */
  notify: (text: string, type?: ToastType) => void;
}

/* ------------------------------------------------------------------ *
 * The import report: what an import did with the rows it was given.
 *
 * Everything below is a reading of `ImportReport`, which is two numbers' worth
 * of shape: a count and a list of `{ line, reason }`. The two questions this
 * module answers are the two a user has when the panel appears.
 * ------------------------------------------------------------------ */

/**
 * One cause of a skipped row, and the sentence that tells the user what to do
 * about it. The `id` is a React key and nothing else.
 */
interface SkipGroup {
  id: string;
  title: string;
  /**
   * The next action. A group's title says which rows; its note says what to do
   * about them, and it is where the panel earns its place — a bare list of
   * reasons is a log, and reading a log to find out what to change is the work
   * the panel was built to take back.
   */
  note: (hasCatalog: boolean) => string;
  matches: (reason: string) => boolean;
}

/**
 * The groups, in the order they are read.
 *
 * **Ordered by the scope of the fix, outside in: the row's shape, then one
 * cell's content, then a word measured against a list that lives somewhere
 * else, and last the rows that need no fix at all.** A user works outward in,
 * and an outer fix can retire an inner one — if a row's columns are wrong, its
 * strength cell is not a strength cell yet, so a report that led with the
 * cell would send the user to edit a value that is going to move. The fourth
 * group is last because its action may be "nothing": a user with 200 real rows
 * wrong and two example rows left in should read about the 200 first, and must
 * not come away thinking they have a third problem.
 *
 * **Not chronological.** The parser's own output order is line order, and line
 * order is what the file looks like — which makes the user read all 8 skips to
 * discover that they are 3 different problems with 3 different fixes. The
 * chronology is kept *inside* each group, where it is what the user needs: a
 * spreadsheet is walked top to bottom.
 *
 * **Not alphabetical.** Sorting the reasons alphabetically sorts them by the
 * parser's wording, which is a sentence written for a log: it files "Expected
 * 3 columns" under E and "The name column is empty" under T, puts "Unknown
 * discipline" beside "Unclosed quoted field" because both begin with U, and
 * re-shuffles if the parser's copy is ever reworded. An order that changes
 * when a string is reworded is not an order a user can navigate by.
 *
 * The last group is a floor, not a design. Every reason this app can produce
 * has a home above, and `RosterScreen.import-report.test.ts` fails if the
 * parser grows a sixth — but a reason that arrives unclassified must still be
 * shown, in full and in the file's order, because a report that silently drops
 * the one row it does not recognise is the defect this whole surface exists to
 * end. Two kinds of row land there, and neither can be given a fix here: a
 * reason this app has never seen, and a row the parser read perfectly well
 * whose player this app then **failed to save**.
 */
const CAUSE_GROUPS: readonly SkipGroup[] = [
  {
    id: "shape",
    title: "Fix the shape of these rows",
    note: () =>
      "A row has to be name, discipline, strength, in that order, and a comma inside any value has to be inside quotes. A row whose quote is opened and never closed is read together with the line after it, so that quote has to be closed or taken out.",
    matches: (reason) =>
      /^Expected 3 columns \(name, discipline, strength\), found \d+\.$/.test(reason) ||
      reason === "Unclosed quoted field; this record was not imported.",
  },
  {
    id: "value",
    title: "Correct what one cell says in these rows",
    note: () =>
      "The row has its three columns; one of them is not a value this app can read as that column. Put a name in the name column — a row with an empty one has no player in it — and a number from 1 to 5 in the strength column, or leave that blank and it is read as 3.",
    matches: (reason) =>
      reason === "The name column is empty." || /^Strength ".*" is not a number\.$/.test(reason),
  },
  {
    id: "vocabulary",
    title: "Spell the discipline as one this community has",
    note: (hasCatalog) =>
      hasCatalog
        ? "The list above is every discipline in this community. Spell the row as one of them, or add the sport on the Disciplines screen."
        : "This community has no disciplines yet, so no row can name one. Add a sport on the Disciplines screen, then import the file again.",
    matches: (reason) => /^Unknown discipline ".*"\.$/.test(reason),
  },
  {
    id: "example",
    title: "Check these example-looking rows",
    note: () =>
      "The template marks its own example rows by name, and this app left out any row whose name starts the same way. Delete them from the file, or rename them if you meant them as real players.",
    matches: (reason) => reason.includes(TEMPLATE_EXAMPLE_REASON_MARKER),
  },
];

/**
 * The groups, in reading order: the four causes, then the floor.
 *
 * The floor matches **only what nothing above claimed.** It was written as
 * `() => true` first, which is a quieter way of showing every row twice — once
 * under its cause and once under "rows this app did not import" — and a report
 * that lists the same eight rows in two places is worse than no report, because
 * the second list is a claim the first one contradicts. So the floor is
 * defined as the *complement* of the causes rather than as a catch-all, and
 * `groupSkips` takes the first group that claims a row.
 */
const SKIP_GROUPS: readonly SkipGroup[] = [
  ...CAUSE_GROUPS,
  {
    id: "other",
    title: "Rows this app did not import",
    note: () => "This app does not group this reason yet, so the rows are shown as they were recorded.",
    matches: (reason) => !CAUSE_GROUPS.some((group) => group.matches(reason)),
  },
];

/** `1 row` / `3 rows`. */
const rowNoun = (n: number): string => `${n} row${n === 1 ? "" : "s"}`;

/** `1 player row` / `3 player rows`, so no sentence in the panel miscounts. */
const rowWord = (n: number): string => `${n} player row${n === 1 ? "" : "s"}`;

/**
 * "was not imported, and is" / "were not imported, and are", so the headline
 * agrees with its own count. A one-row shortfall is the case a first-time
 * organizer hits — the template's single example row, or one mistyped cell —
 * and "The other 1 were not imported" is the sort of thing that makes a reader
 * distrust the number beside it.
 */
const notImportedClause = (n: number): string =>
  n === 1 ? "was not imported, and is" : "were not imported, and are";

/**
 * One line saying what the import did, in the app's house shape: a fact, an
 * attribution, and a next action — with the third part present only when there
 * is one.
 *
 * **The attribution is "this app", and it is what keeps the sentence from
 * lying in both directions.** "Imported 12 players." credits nobody and blames
 * nobody, which on a 200-row file with 3 skips reads as a complete success; the
 * count alone is the understatement this app's copy has been fought over for.
 * "3 rows failed." is the other half of the same failure: it makes three
 * spreadsheet cells sound like a broken file. So the line is what happened and
 * who decided it, and the *cause* is left to the groups underneath, where each
 * cause can be given its own remedy.
 *
 * **The verb for the rows that were not imported is "were not imported", never
 * "failed" and never "were refused".** Both of those are verdicts on the user's
 * file, and the report is not entitled to one: the same sentence covers a row
 * the app could not parse and a row the app chose to leave out, and only the
 * groups below can tell those apart honestly.
 *
 * **A clean import gets no next action at all.** "There is nothing to fix" is
 * itself a claim — it says the file is complete, and a file whose rows carry a
 * fourth column *is* incomplete to this app, whatever the panel can see. So the
 * line stops at the fact, and the absence of anything to do is left as the
 * absence.
 */
const importHeadline = (report: ImportReport): string => {
  const imported = report.imported;
  const skipped = report.skipped.length;
  const total = imported + skipped;
  if (total === 0) return "This app found no player rows in the file.";
  if (skipped === 0) return `This app imported all ${rowWord(total)} in the file.`;
  if (imported === 0)
    return `This app imported no players. All ${rowWord(skipped)} in the file ${notImportedClause(skipped)} grouped below by what to change.`;
  return `This app imported ${imported} of the ${rowWord(total)} in the file. The other ${skipped} ${notImportedClause(skipped)} grouped below by what to change.`;
};

/**
 * The skipped rows, in group order and in line order within each group.
 *
 * Every group's rows come out in the order they arrived, and the hook sorts
 * the whole list by line before it gets here, so a group is a filtered run of
 * a sorted list and needs no sort of its own.
 */
const groupSkips = (skipped: ImportSkip[]): Array<SkipGroup & { rows: ImportSkip[] }> => {
  // Bucketed by group id, which is a small fixed set of strings, so this is a
  // lookup table rather than a Map: the keys are known, and a group that has
  // claimed nothing simply has no key.
  const claimed: Record<string, ImportSkip[]> = {};
  for (const skip of skipped) {
    // The first group that claims a row, which is what makes the floor a floor
    // rather than a second opinion.
    const group = SKIP_GROUPS.find((g) => g.matches(skip.reason)) ?? SKIP_GROUPS[SKIP_GROUPS.length - 1];
    (claimed[group.id] ??= []).push(skip);
  }
  return SKIP_GROUPS.filter((group) => claimed[group.id] !== undefined).map((group) => ({
    ...group,
    rows: claimed[group.id] ?? [],
  }));
};

/**
 * How to read the line numbers, said once rather than on every row.
 *
 * "Line 7" is a fact about the file the user chose, and `parsePlayerCsv`
 * numbers it by **physical line, 1-based, from the top of the file** — so the
 * heading is line 1 and the first player is line 2, and that is what a
 * spreadsheet shows in its own row gutter. A quoted newline does not break
 * this: a record that spans two lines is reported against the line it starts
 * on, and the lines it swallowed are counted, so the next record's number is
 * still the row the user's sheet is displaying. `RosterScreen.import-report.test.ts`
 * — case "reports a row that spans two lines against the line it starts on" —
 * pins that against the parser rather than against this sentence.
 *
 * The sentence is here because the one thing that genuinely can differ is the
 * reader: a user counting "players" rather than "lines" calls the first
 * player row 1 and the report's line 2, and concludes the report is off by
 * one. Saying that the heading counts is the whole correction.
 */
const LINE_COUNT_NOTE = "Lines count the file as you saved it, heading included.";

/**
 * The fourth column, named as a fact about this import.
 *
 * `parsePlayerCsv` checks `fields.length` only for `< 3`, so a row with a
 * fourth column is imported from its first three and the rest is discarded
 * with no skip recorded. This is a parser behaviour and this phase may not
 * change the parser, so the report is the only place a user can learn it
 * happened.
 *
 * **The tense is the load-bearing part of this sentence.** "If your file has a
 * fourth column, that column was not imported" is a claim about one import
 * that has already happened. "Any column after the third is ignored" would be
 * a claim about code this task does not own and cannot hold open, and it would
 * be a promise: a future `parsePlayerCsv` that learned a fourth column would
 * break it silently, with a test somewhere in `src/data` and nothing here.
 *
 * **It is conditional on purpose.** A flat "a fourth column was not imported"
 * asserts that the file has one, and a user with three columns would go
 * looking for a column that is not there. The conditional makes the sentence
 * true for every file and leaves the check with the person who has the file.
 *
 * **It appears only when the panel already has skips to report.** This is the
 * cost of that choice, recorded: a clean import of a file that *does* carry a
 * fourth column shows a clean report, because the report cannot see one and
 * the alternative is a standing warning on every import about a column most
 * files do not have — which is how a real note becomes noise people learn to
 * skip. The moment the app is telling someone that rows were lost is the moment
 * it is worth also saying that something else may have been lost.
 */
const EXTRA_COLUMN_NOTE =
  "Only a row's first three columns are read. If your file has a fourth column, that column was not imported.";

/**
 * What the selection is, and what the button beside it is about to do to it.
 * Two sentences in the app's house shape: a count, then a fact about scope.
 *
 * **The second sentence is the whole reason this line exists.** A user who ticks
 * 40 of 60 and presses the button is really asking what happens to the other
 * 20, and the answer — they are not touched — is invisible from a button whose
 * name is two words. It is true by construction rather than by promise: the
 * dialog is handed the ticked rows, so "the other 20 keep the ratings they
 * have" is what the code does and not what the copy wishes it did.
 *
 * At zero there is no set to describe, so the second sentence is a way in
 * instead, and when every row is ticked there is no "other" to account for, so
 * the sentence says that rather than announcing "the other 0 keep the ratings
 * they have". Nothing here is dressed up: the count agrees with the button's
 * disabled state, which is the same number.
 *
 * Exported for the same reason as `selectedIn`: the sentences it writes are
 * claims about a write, and this is the only way a test can reach them.
 */
export const selectionNote = (selected: number, total: number): string => {
  if (total === 0) return "";
  if (selected === 0)
    return `0 of ${total} selected. Choose players here, or press Select all, to rate them together in one discipline.`;
  if (selected === 1)
    return `1 of ${total} selected. Rating writes to that one player; the other ${total - 1} keep the ratings they have.`;
  if (selected === total)
    return `${selected} of ${total} selected. Rating writes to all ${total} of them.`;
  return `${selected} of ${total} selected. Rating writes to those ${selected}; the other ${total - selected} keep the ratings they have.`;
};

/**
 * A selection, kept against the community that made it.
 *
 * **It is a mode, and a mode that outlives the thing that started it is a bug.**
 * The community id is part of the state for exactly that reason: switching
 * community re-renders this screen with a different `activeCommunity` and a
 * selection of ids the new community's roster may not even contain, which would
 * otherwise read as "3 selected" over rows that are not there. The ids are
 * intersected with `visiblePlayers` on every render as well, so a filter change
 * cannot leave a ticked row hiding in a filtered-out set. Nothing is persisted:
 * a reload, a navigation and a community switch all start from nothing.
 */
interface Selection {
  communityId: Id;
  ids: Id[];
}

/**
 * Nothing is selected, and the same object every time, so clearing a selection
 * that is already empty re-renders nothing.
 */
const NO_SELECTION: Selection = { communityId: "", ids: [] };

/** Ids that belong to `communityId` at all, and the empty list when none do. */
const EMPTY_IDS: Id[] = [];
const idsIn = (selection: Selection, communityId: Id | null | undefined): Id[] =>
  selection.communityId === (communityId ?? "") ? selection.ids : EMPTY_IDS;

/**
 * The rows a selection actually means, on the screen as it stands: ticked, in
 * this community, and visible under the current filter.
 *
 * Exported because it is the rule the whole mode rests on and no prop reaches
 * it — the copy beside the button claims the other rows are untouched, and
 * this is where that claim is either true or not. A node test can drive it with
 * a selection, a community and a list; it cannot drive a click.
 */
export function selectedIn(
  selection: Selection,
  communityId: Id | null | undefined,
  visible: Player[],
): Player[] {
  const ids = idsIn(selection, communityId);
  return visible.filter((p) => ids.includes(p.id));
}

/**
 * The roster hub's screen. Its markup moved out of App verbatim; what changed
 * is only which handler each binding names — every `setEditingPlayer`,
 * `filtersByDiscipline`, `clearFilters` and `handleExport` reference became the
 * prop App passes in, and `communityPlayers` became the `players` prop. The
 * Split entry arrives as `onSplitMatch`, bound to App's single ad-hoc handler.
 *
 * `onDelete` is A04's already-catching `deletePlayer` passed straight through:
 * `PlayerEditModal.remove` calls `onClose()` itself, so no try/catch is added
 * here — A04's toast is the error path, and rethrowing would escape `void
 * remove()` as an unhandled rejection.
 */
export function RosterScreen(props: RosterScreenProps) {
  const { activeCommunity, disciplines, players, visiblePlayers, filterIds, disciplinesById, editingPlayer, fileInputRef } = props;
  /**
   * How one discipline is written in the hint: its short name, with the full
   * name beside it when the two differ. `csvRowsToPlayers` matches a row's
   * discipline against every discipline's short name *and* full name, case
   * insensitively (`src/data/player-import.ts:193`), so the parenthetical is not
   * a courtesy — it is the second string the parser would accept, and a hint
   * reading "MLBB" alone would be false for a user who typed "Mobile Legends".
   *
   * These are rendered as one element each, in a list, and not joined into a
   * sentence, because a discipline name is free text: `DisciplineEditModal`
   * takes whatever a person types, and a custom discipline called
   * "Volleyball, Indoor" inside a comma-joined list reads as two sports. That
   * would make the one sentence on this screen which claims to be exhaustive
   * quietly wrong, on exactly the kind of name the app's own UI can produce.
   */
  const disciplineSpelling = (d: Discipline): string =>
    d.name.toLowerCase() === d.shortName.toLowerCase() ? d.shortName : `${d.shortName} (${d.name})`;

  /**
   * The template download.
   *
   * It follows `ShareSheet.downloadImage`'s shape — anchor appended, clicked,
   * removed, and the object URL revoked on the next task — rather than
   * `App.tsx`'s `handleExport`, which revokes in the same tick as the click.
   * The browser reads the object URL as the click is dispatched, so that revoke
   * is a race; it was noted and accepted in Task 4's review, and it is not worth
   * copying into a third path. Unlike `downloadSampleData` in
   * `src/data/sample-data.ts`, this one revokes at all.
   *
   * It is not wrapped in a try/catch. Every call in it is one the browser either
   * has or has not, and a refusal here — a document with no object-URL support,
   * a sandboxed frame — throws into a click handler where it lands in the
   * console. That is the better outcome: a catch with nowhere to report would
   * make a failed download indistinguishable from a browser that quietly
   * blocked one, and nothing on this screen reports downloads: the report
   * panel is typed to CSV verdicts, and a browser's own refusal already goes
   * to the console.
   */
  const downloadCsvTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = CSV_TEMPLATE_FILE_NAME;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  /**
   * The bulk-rating mode: which rows are ticked, and the dialog it opens.
   *
   * `selectedIds` is derived on every render rather than stored, so it can only
   * ever be ids the current community's current filter actually shows. A row
   * that is filtered out, or belongs to another community, is not selected no
   * matter what is in the state — which is what makes "Rating writes to those
   * 3; the other 9 keep the ratings they have" a fact about the write instead of
   * a claim about the interface.
   */
  const [selection, setSelection] = useState<Selection>(NO_SELECTION);
  const [rateOpen, setRateOpen] = useState(false);
  const selectedIds = idsIn(selection, activeCommunity?.id);
  const selectedPlayers = selectedIn(selection, activeCommunity?.id, visiblePlayers);
  const allSelected = visiblePlayers.length > 0 && selectedPlayers.length === visiblePlayers.length;

  const remember = (ids: Id[]): void =>
    setSelection({ communityId: activeCommunity?.id ?? "", ids });

  const toggleSelected = (id: Id): void =>
    remember(
      selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id],
    );

  /** The header-level toggle: all the rows the filter shows, or none of them. */
  const toggleSelectAll = (): void =>
    remember(allSelected ? [] : visiblePlayers.map((p) => p.id));

  /**
   * Changing the filter takes the selection with it. A ticked row that is no
   * longer on screen is not offered to the dialog anyway, and clearing here
   * means the count beside the button never describes rows the user cannot see.
   */
  const toggleFilter = (id: Id): void => {
    setSelection(NO_SELECTION);
    props.onToggleFilter(id);
  };
  const clearFilters = (): void => {
    setSelection(NO_SELECTION);
    props.onClearFilters();
  };

  /**
   * Write the rated set, then say what was written.
   *
   * Every player goes through `onSavePlayer`, so the in-memory list, the store
   * and the single-player editor all see the write the same way; this screen
   * holds no roster of its own to fall out of step. The writes are one at a
   * time and can stop half way, so a failure counts what landed and says so —
   * a toast claiming all 12 were written when 7 were would be the worst thing
   * this screen could do.
   *
   * The selection is cleared only here, on the success path. Cancelling the
   * dialog writes nothing and keeps the ticks, because a user who pressed
   * Cancel has not changed their mind about *which* players, only about the
   * numbers they were about to give them.
   */
  const applyBulkRatings = async (
    updated: Player[],
    discipline: Discipline,
    ratings: Record<Id, number>,
  ): Promise<void> => {
    let saved = 0;
    try {
      for (const player of updated) {
        await props.onSavePlayer(player);
        saved += 1;
      }
    } catch (err) {
      props.notify(
        saved === 0
          ? `Could not rate any of the ${updated.length} selected players: ${formatError(err)}`
          : `Could not rate all ${updated.length} selected players: ${formatError(err)}. ${saved} of them are saved.`,
        "error",
      );
      throw err;
    }
    setSelection(NO_SELECTION);
    props.notify(rateConfirmation(discipline, ratings, updated.length), "success");
  };

  return (
    <Screen>
      <PageHeader
        kicker="Match sheet"
        title="comp3tive"
        lede={
          activeCommunity && (
            <>
              <strong>{activeCommunity.name}</strong> · {players.length} player
              {players.length === 1 ? "" : "s"} on the roster
            </>
          )
        }
      />
          
      {activeCommunity && (
        <>
          {/* Discipline filter chips */}
          {disciplines.length > 0 && (
            <div className="chips">
              {disciplines.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className="chip"
                  aria-pressed={filterIds.includes(d.id)}
                  onClick={() => toggleFilter(d.id)}
                >
                  {d.shortName}
                </button>
              ))}
            </div>
          )}
          {filterIds.length > 0 && (
            <button className="btn btn-ghost" onClick={clearFilters}>Clear filters</button>
          )}
          {props.pendingMerge && (
            <div className="status-banner">
              <span className="status-msg">
                Import {props.pendingMerge.counts.communities} new communit{props.pendingMerge.counts.communities === 1 ? "y" : "ies"},{" "}
                {props.pendingMerge.counts.players} new player{props.pendingMerge.counts.players === 1 ? "" : "s"},{" "}
                {props.pendingMerge.counts.sessions} session{props.pendingMerge.counts.sessions === 1 ? "" : "s"},{" "}
                {props.pendingMerge.counts.tournaments} tournament{props.pendingMerge.counts.tournaments === 1 ? "" : "s"} and{" "}
                {props.pendingMerge.counts.squads} saved squad{props.pendingMerge.counts.squads === 1 ? "" : "s"}? (Existing records with the
                same id are kept.)
              </span>
              <button type="button" className="btn btn-ghost" onClick={props.onCancelMerge}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={props.onConfirmMerge}>Import</button>
            </div>
          )}
              
          {/* Player actions */}
          <div className="roster-toolbar">
            <button
              className="btn btn-primary"
              onClick={props.onAddPlayer}
            >
              + Add Player
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => fileInputRef.current?.click()}
            >
              Import players
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.csv,.txt"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void props.importFile(f);
              }}
              style={{ display: "none" }}
            />
            {/*
             * Beside the import control and not beside the export control,
             * because this is the other half of that pair: one hands the file
             * out, the other reads it back. It sits after the hidden input
             * rather than before "Import players" so the control that reads a
             * file comes first in the reading order of a screen whose left-hand
             * cluster is: add one by hand, or add many from a file.
             */}
            <button
              type="button"
              className="btn btn-ghost"
              data-testid="download-csv-template"
              onClick={downloadCsvTemplate}
            >
              Download CSV template
            </button>
            <div className="roster-toolbar-spacer" />
            <span className="durability-note">
              {props.persisted === true && "This browser reported persistent storage for this app on this visit. Keep a backup anyway."}
              {props.persisted === false && "This browser reports this app's data is not stored persistently. Keep a backup."}
              {props.persisted === null && "This app could not confirm persistent storage here. Keep a backup."}
            </span>
            <button className="btn btn-ghost" onClick={props.onExport}>
              Export
            </button>
          </div>

          {/*
           * The CSV contract, in the app rather than in the file. It cannot go in
           * the file: the parser has no comment syntax, so an instruction line
           * there is a data row whose strength is not a number, and it would
           * reach the user as a skipped line on an otherwise clean import. It
           * lives here because a user reads it before deciding to download
           * anything, and the user who never downloads has to write the file by
           * hand. Every claim these sentences make is checked against the parser
           * in RosterScreen.csv-hint.test.ts, which is the only thing standing
           * between this copy and a parser that changes under it.
           *
           * The quoting sentence names a row, and the row it names is counted
           * from the end of the file. It used to say "the second row", which is
           * wrong twice over: the quoted example is the file's third line, and a
           * spreadsheet counts the heading as row 1, so the row a reader would
           * go and look at demonstrated nothing. A pointer into a file can also
           * go stale, so the test names the row the same way this sentence does
           * and fails when the two disagree — the two cannot now drift apart
           * quietly, which is how the wrong row survived a passing test.
           */}
          <p className="import-hint">
            Fill the template in and save it, then press Import players and pick that file. Nothing
            here is read until you choose it.
          </p>
          <p className="import-hint">
            CSV columns, in this order: name, discipline, strength. Any value with a comma in it goes
            in quotes &mdash; the last example row in the template shows one in the name column.
          </p>
          <p className="import-hint">
            Strength is a number from 1 to 5. Leave it blank and it is read as 3; text there skips
            the row.
          </p>
          {disciplines.length > 0 && (
            <>
              <p className="import-hint">Discipline must be one of:</p>
              <ul className="import-hint-list">
                {disciplines.map((d) => (
                  <li key={d.id}>{disciplineSpelling(d)}</li>
                ))}
              </ul>
            </>
          )}

          {/*
           * The import report, inline and directly under the hint it corrects.
           *
           * **Inline, not a modal.** A modal would cover the roster, and the
           * roster is the report's own evidence: "Andi is on the list and Budi
           * is not" is how a user checks that the panel is telling the truth,
           * and a dialog forbids exactly that comparison. The panel's size also
           * swings from one sentence to two hundred lines, and a modal sized
           * for the second case would put a dismiss button in front of the
           * first — which trains people to dismiss a report without reading
           * it, the opposite of what this surface is for. The share sheet's
           * modal exists because the user is about to *send* something, which
           * is an interruption by design; an import is not.
           *
           * **It is replaced, not stacked, by the next import** — the hook sets
           * `lastReport` on every CSV import, so a second file's verdict is the
           * only one on the page. Stacking was the alternative and it is the
           * worse one: two lists of line numbers, one about a file the user is
           * no longer looking at, side by side, and nothing on the panel to say
           * which file a given line came from. `ImportReport` carries no file
           * name, so the user could not tell them apart. A stale report is a
           * small lie; two stale reports are a small lie with a lookup table.
           * The title names the panel's scope instead — the *most recent* CSV
           * import — which is what makes the replacement true rather than
           * merely convenient.
           *
           * **Both notes live under the groups, not above them.** The line-count
           * note is a reading instruction and the fourth-column note is a
           * possible further loss, so both belong after the thing they qualify.
           *
           * **`h2` and `h3`, not `h3` and `h4`.** `PageHeader` renders the
           * page's only `h1`, and this panel is a section *inside* that page: a
           * heading level that skips one is a broken outline for anyone
           * navigating by heading, and the group's heading is a level under
           * this one.
           */}
          {props.lastReport && (
            <section className="import-report" aria-label="Most recent CSV import">
              <h2 className="import-report-title">Most recent CSV import</h2>
              <p className="import-report-headline">{importHeadline(props.lastReport)}</p>
              {props.lastReport.skipped.length > 0 && (
                <>
                  <p className="import-report-note">{LINE_COUNT_NOTE}</p>
                  {groupSkips(props.lastReport.skipped).map((group) => (
                    <div className="import-report-group" key={group.id}>
                      <h3 className="import-report-group-title">
                        {group.title} <span className="import-report-group-count">· {rowNoun(group.rows.length)}</span>
                      </h3>
                      <p className="import-report-group-note">{group.note(disciplines.length > 0)}</p>
                      <ul className="import-skipped">
                        {group.rows.map((skip, index) => (
                          <li key={`${skip.line}-${index}`} className="import-skipped-row">
                            <span className="import-skipped-line">Line {skip.line}:</span>{" "}
                            <span className="import-skipped-reason">{skip.reason}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                  <p className="import-report-note">{EXTRA_COLUMN_NOTE}</p>
                </>
              )}
            </section>
          )}

          {editingPlayer !== null && activeCommunity && (
            <PlayerEditModal
              player={editingPlayer === "new" ? null : editingPlayer}
              disciplines={disciplines}
              communityId={activeCommunity.id}
              onClose={props.onCloseEditor}
              onSave={props.onSavePlayer}
              onDelete={props.onDeletePlayer}
            />
          )}

          {rateOpen && (
            <BulkRateModal
              disciplines={disciplines}
              players={selectedPlayers}
              defaultDisciplineId={filterIds.length === 1 ? filterIds[0] : null}
              onApply={applyBulkRatings}
              onClose={() => setRateOpen(false)}
            />
          )}

          {/*
           * The selection bar sits directly above the rows it is about, and
           * holds the rate button rather than the toolbar holding it: a button
           * that is disabled until rows are ticked belongs with the rows and
           * with the count that disables it, not four blocks higher up beside
           * controls that add a player. `Select all` is the header-level
           * toggle and changes its own name to match what it will do.
           */}
          {visiblePlayers.length > 0 && (
            <div className="roster-select-bar">
              <p className="roster-select-note">{selectionNote(selectedPlayers.length, visiblePlayers.length)}</p>
              <button
                type="button"
                className="btn btn-ghost small"
                onClick={toggleSelectAll}
                data-testid="select-all-players"
              >
                {allSelected ? "Clear selection" : "Select all"}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={selectedPlayers.length === 0}
                onClick={() => setRateOpen(true)}
              >
                Rate selected
              </button>
            </div>
          )}
              
          {/* Player list */}
          {players.length === 0 ? (
            <div className="empty">
              <div className="kicker">Empty bench</div>
              <div className="big">No players in this community</div>
              <p>Add the first player manually, or import a JSON / CSV roster.</p>
              <button
                className="btn btn-primary"
                style={{ marginTop: 14 }}
                onClick={props.onAddPlayer}
              >
                + Add the first player
              </button>
            </div>
          ) : (
            <div className="roster">
              {visiblePlayers.map((player, i) => {
                const primaryCap = player.capabilities[0];
                const primaryDiscipline = primaryCap ? disciplinesById.get(primaryCap.disciplineId) : null;
                const bibVar = primaryDiscipline?.shortName
                  ? `var(--bib-${primaryDiscipline.shortName.toLowerCase().charAt(0)})`
                  : "var(--text-2)";
                const selected = selectedIds.includes(player.id);
                return (
                  <div
                    key={player.id}
                    className="row row-clickable row-has-select"
                    style={{ "--stripe": bibVar } as React.CSSProperties}
                  >
                    {/*
                     * The checkbox is a *sibling* of the row's button, not a
                     * child of it. A `role="button"` element's contents are
                     * presentational, so a checkbox nested inside this row
                     * would be flattened out of the accessibility tree and
                     * become a tick a sighted mouse user can do and a keyboard
                     * user cannot. The stripe, the padding and the hover all
                     * stay on the outer row, so it still looks like one row.
                     */}
                    <input
                      type="checkbox"
                      className="row-select"
                      checked={selected}
                      onChange={() => toggleSelected(player.id)}
                      aria-label={`Select ${player.name}`}
                    />
                    <div
                      className="row-open"
                      role="button"
                      tabIndex={0}
                      aria-label={`Edit ${player.name}`}
                      onClick={() => props.onOpenPlayer(player)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          props.onOpenPlayer(player);
                        }
                      }}
                    >
                      <span className="lineup-no">{String(i + 1).padStart(2, "0")}</span>
                      <div className="who">
                        <div className="name">{player.name}</div>
                        {player.notes && (
                          <div className="note">{player.notes}</div>
                        )}
                        <div className="badges">
                          {player.capabilities.map(cap => {
                            const discipline = disciplinesById.get(cap.disciplineId);
                            if (!discipline) return null;
                            const bibClass = `badge--${discipline.shortName.toLowerCase().charAt(0)}`;
                            return (
                              <span key={cap.disciplineId} className={`badge ${bibClass}`}>
                                {discipline.shortName}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                      <span className="row-edit" aria-hidden="true">›</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="cta-bar">
            <div className="cta-label">
              Ready to play? <strong>Split the roster</strong> and check the balance.
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={props.onSplitMatch}
              disabled={!activeCommunity || players.length === 0}
            >
              Split match
            </button>
          </div>
        </>
      )}
    </Screen>
  );
}
