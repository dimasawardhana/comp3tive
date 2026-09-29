import { useCallback, useEffect, useState, type RefObject } from "react";
import type { Community, Discipline, Player, SavedSquad, Session, Tournament } from "../domain/types";
import { parseBackup } from "../data/transfer";
import { assertImportSize, csvRowsToPlayers, parsePlayerCsv, type CsvRow, type ImportSkip } from "../data/player-import";
import { validatePlayer } from "../domain/validation";
import { formatError } from "../ui/format";
import type { ToastType } from "./useToasts";

/** A08's per-row skip, re-exported so a consumer imports it from one place. */
export type { ImportSkip } from "../data/player-import";

/**
 * Phase D's report shape, kept here because that is where an import's outcome is
 * decided. Nothing in the app constructs one today: an import reports itself
 * through toasts, and no report panel was ever specified. A producer must set
 * it, not just re-export it.
 */
export interface ImportReport {
  imported: number;
  skipped: ImportSkip[];
}

/**
 * The prefix that marks a row as one of the template's own examples, and the
 * only way this app can tell an example from a real player.
 *
 * The template ships `Example Player 1` and `Example Player 2, delete me`
 * because a name is the only marker a CSV row can carry, and `CSV_TEMPLATE`
 * chooses names no organizer would give a teammate so a leftover one says on
 * its face that the file was not finished. That is a **name** rule, not a
 * structure rule, and the difference is the whole decision: a name rule cannot
 * be trusted to *refuse* a row, because a rule that says "a player called
 * Example Player is not a player" is a rule about a word. It can be trusted to
 * *tell* the user, which is what the report does with it. The alternative —
 * dropping these rows silently — would have been a refusal decided by a
 * prefix, and it would have been invisible, so nobody could tell the app had
 * edited their file.
 *
 * The prefix is written out here rather than derived from `CSV_TEMPLATE`
 * because that file is Phase D's and read-only to this phase, and because the
 * two can be tied in a test instead: `RosterScreen.import-report.test.ts` —
 * case "catches every example row the shipped template contains" — parses the
 * shipped template through the shipped parser and asserts every example row in
 * it is caught, which fails the moment either end moves. (It is that file and
 * not a `usePlayerImport` one: there is no test module for this hook, because
 * `usePlayerImport` needs React effects to be observable and the unit
 * environment has none — everything the hook decides is proved in the browser
 * in `e2e/tests/roster/fast-entry.spec.ts`, and everything this rule decides is
 * proved here.)
 */
const TEMPLATE_EXAMPLE_PREFIX = "example player";

/**
 * Whether a parsed row's name marks it as one of the template's examples.
 *
 * `trim` first because a spreadsheet cell can carry the space, and
 * `toLowerCase` because the marker is a capitalised sentence rather than a
 * fixed token. The cost of a false positive is one sentence in a report; the
 * cost of a false negative is a ghost on the roster, so the test is the loose
 * one and the failure it risks is the reversible one.
 */
export const isTemplateExampleRow = (name: string): boolean =>
  name.trim().toLowerCase().startsWith(TEMPLATE_EXAMPLE_PREFIX);

/**
 * The phrase every row this app held back for a template-like name carries in
 * its reason, exported so the report's grouping keys off one string rather
 * than a second copy of it. The report groups rows by the cause their reason
 * names, and a duplicated literal in a screen is a duplicated literal that can
 * be reworded on one side only — at which point the example rows fall out of
 * their group and into the ungrouped floor, silently, on a file that was
 * otherwise fine.
 *
 * It says "the template's example marker" and not "one of the example rows the
 * template ships", because the app cannot know which. It ran a name prefix.
 * A sentence reading *"is one of the example rows the CSV template ships"* is a
 * claim about **this user's file**, and for any name that merely begins the
 * same way it is false — so the sentence now states the rule that was applied
 * and lets the report's group note offer the user the decision.
 */
export const TEMPLATE_EXAMPLE_REASON_MARKER = "the template's example marker";

/**
 * Why a row this app took for a template example is not in the roster of
 * imported players, said as a fact about **this import** and about **the app's
 * own rule** — never as a verdict on the row.
 *
 * Past tense, and it names no future behaviour: the row is not on the roster
 * *now*, and nothing here claims what the app would do with the same file
 * tomorrow. A wording like "this app ignores example rows" would be a claim
 * about code — `parsePlayerCsv` and this predicate — that no test in the repo
 * holds open, and a report is the last place a claim like that belongs.
 */
const exampleRowReason = (name: string): string =>
  `"${name}" — this app did not import it: the name starts with ${TEMPLATE_EXAMPLE_REASON_MARKER}.`;

/**
 * Why a row whose player the app failed to save is on the report.
 *
 * Past tense, cause not claimed, and it is the reason this report has to carry
 * for a row that **the parser read perfectly well**: the file was fine and the
 * app's own write failed. Nothing here blames the file, and nothing here
 * promises a retry. It lands in the ungrouped floor, which is where a row the
 * app cannot classify belongs — see `RosterScreen`'s floor.
 */
const unsavedRowReason = "This app did not save this player, so the row was not imported.";

/**
 * Split parsed rows into the ones that are real entries and the ones that are
 * the template's own examples, as `ImportSkip`s carrying the row's line.
 *
 * This runs on `rows` — which is why it can see a name at all. `parsePlayerCsv`
 * and `csvRowsToPlayers` never see these rows as anything but valid data, which
 * is the shape of the problem: the app has to *choose* not to import them, and
 * the report is where that choice becomes visible. The line comes from the
 * parsed row rather than from the array index, so it is the line the user's
 * spreadsheet shows.
 */
const takeTemplateExamples = (rows: CsvRow[]): { rows: CsvRow[]; examples: ImportSkip[] } => {
  const kept: CsvRow[] = [];
  const examples: ImportSkip[] = [];
  for (const row of rows) {
    if (isTemplateExampleRow(row.name)) examples.push({ line: row.line, reason: exampleRowReason(row.name) });
    else kept.push(row);
  }

  return { rows: kept, examples };
};

/**
 * A backup merge waiting for a yes. `counts` is what the banner names, `apply`
 * is the write half — kept separate because a native `window.confirm` returned a
 * boolean and the writes could not start until the user had answered.
 */
export interface PendingMerge {
  counts: Record<string, number>;
  apply: () => Promise<void>;
}

export interface PlayerImportDeps {
  activeCommunity: Community | null;
  disciplines: Discipline[];
  communities: Community[];              // all, for id dedupe
  players: Player[];
  sessions: Session[];
  tournaments: Tournament[];
  squads: SavedSquad[];
  savePlayer: (p: Player) => Promise<void>;
  saveCommunity: (c: Community) => Promise<void>;
  saveSession: (s: Session) => Promise<void>;
  saveTournament: (t: Tournament) => Promise<void>;
  saveSquad: (s: SavedSquad) => Promise<void>;
  /**
   * Re-read the communities, before their own records are written: the hooks
   * hold their own copies of the store's lists, so an imported community would
   * otherwise be absent from the dropdown while the players that name it
   * arrive. `refreshRecords` then re-reads the four lists the rest of the merge
   * writes. Two calls, not one, because the merge needs the communities in
   * between — one combined call would read every list twice.
   */
  refreshCommunities: () => Promise<void>;
  refreshRecords: () => Promise<void>;
  notify: (text: string, type?: ToastType) => void;
  fileInputRef: RefObject<HTMLInputElement | null>;
}

export interface PlayerImportResult {
  pendingMerge: PendingMerge | null;
  confirmMerge: () => void;
  cancelMerge: () => void;
  lastReport: ImportReport | null;
  importFile: (file: File) => Promise<void>;
}

/**
 * The player import: a players-only JSON roster, a CSV, or a full backup merged
 * into the existing data. `notify` arrives as a dep rather than a
 * `useToasts()` call — the toast list is per-caller state rendered by App's
 * chrome, so a second call here would build a list nothing renders.
 */
export function usePlayerImport(deps: PlayerImportDeps): PlayerImportResult {
  const {
    activeCommunity,
    disciplines,
    communities,
    players,
    sessions,
    tournaments,
    squads,
    savePlayer,
    saveCommunity,
    saveSession,
    saveTournament,
    saveSquad,
    refreshCommunities,
    refreshRecords,
    notify,
    fileInputRef,
  } = deps;
  const [pendingMerge, setPendingMerge] = useState<PendingMerge | null>(null);

  /**
   * The last CSV import's outcome, and nothing else. `ImportReport` is C27's
   * shape and is not widened here: a report is a count and a list of rows, and
   * the things a report panel needs beyond that — which community, which file,
   * what time — are all recoverable from where it renders, or are not worth
   * persisting. What the shape *cannot* carry is a name, which is why the
   * panel identifies a row by its line and not by the player in it; see
   * `RosterScreen`'s own note on that.
   */
  const [lastReport, setLastReport] = useState<ImportReport | null>(null);

  /**
   * A report is a verdict about one file imported into one community, and the
   * roster directly beneath it holds a different set of people the moment the
   * user switches community. Left up, it is the stale report the rest of this
   * screen refuses to show: a list of line numbers about rows in a file the
   * user is no longer looking at, sitting above an unrelated set of players.
   *
   * Clearing is the honest half of that choice and the lossy half. What is lost
   * is the enumeration, not the verdict — the toast named the first skip, and
   * the file is still on the user's disk, so re-importing it is one click and
   * the report comes back saying the same thing. Switching back to the community
   * does not bring it back, and that is deliberate: a report that outlives the
   * scope it describes is the same lie as one that outlives the file.
   *
   * Navigation within the community does *not* clear it, and that is the
   * asymmetry the rule rests on: History and Roster show the same people, so a
   * report read on one of them is still true on the other.
   */
  useEffect(() => {
    setLastReport(null);
  }, [activeCommunity?.id]);

  const confirmMerge = useCallback(() => {
    void pendingMerge?.apply();
    setPendingMerge(null);
  }, [pendingMerge]);

  const cancelMerge = useCallback(() => setPendingMerge(null), []);

  /**
   * A full backup. The five "new" lists are computed first and handed to the
   * roster screen as a pending merge; the writes themselves are the `apply`
   * closure, so nothing lands until the user answers.
   */
  const importBackup = useCallback(
    async (file: File) => {
      let data;
      try {
        data = parseBackup(await file.text(), disciplines);
      } catch (err) {
        notify(`Import failed: ${formatError(err)}`, "error");
        return;
      }
      // Merge with existing data: add only new ids, never overwrite.
      const existingCommunityIds = new Set(communities.map((c) => c.id));
      const existingPlayerIds = new Set(players.map((p) => p.id));
      const existingSessionIds = new Set(sessions.map((s) => s.id));
      const existingTournamentIds = new Set(tournaments.map((t) => t.id));
      const existingSquadIds = new Set(squads.map((q) => q.id));
      const newCommunities = data.communities.filter((c) => !existingCommunityIds.has(c.id));
      const newPlayers = data.players.filter((p) => !existingPlayerIds.has(p.id));
      const newSessions = data.sessions.filter((s) => !existingSessionIds.has(s.id));
      const newTournaments = (data.tournaments ?? []).filter((t) => !existingTournamentIds.has(t.id));
      const newSquads = (data.savedSquads ?? []).filter((q) => !existingSquadIds.has(q.id));
      const totalNew =
        newCommunities.length + newPlayers.length + newSessions.length + newTournaments.length + newSquads.length;
      if (totalNew === 0) return;
      setPendingMerge({
        counts: {
          communities: newCommunities.length,
          players: newPlayers.length,
          sessions: newSessions.length,
          tournaments: newTournaments.length,
          squads: newSquads.length,
        },
        apply: async () => {
          // parseBackup has already resolved every communityId — including
          // adopting a record whose id is missing or unknown (the v1 case) into
          // the first community — so each imported record keeps its own.
          for (const c of newCommunities) await saveCommunity(c);
          // The hooks hold their own copies of the store's lists, so nothing
          // below is on screen until re-read: an imported community would be
          // absent from the dropdown and its records invisible. Communities
          // come first, before the records whose communityId they explain — a
          // player whose community is not yet in hook state is re-homed by the
          // orphan-adoption effect above.
          await refreshCommunities();
          for (const p of newPlayers) await savePlayer(p);
          for (const s of newSessions) await saveSession(s);
          for (const t of newTournaments) await saveTournament(t);
          for (const q of newSquads) await saveSquad(q);
          await refreshRecords();
        },
      });
    },
    [communities, players, sessions, tournaments, squads, disciplines, saveCommunity, savePlayer, saveSession, saveTournament, saveSquad, refreshCommunities, refreshRecords, notify],
  );

  const importFile = useCallback(
    async (file: File) => {
      // Before anything can fail. An import that never reaches the CSV branch —
      // a file too large, a JSON backup, a roster with no players array — must
      // still take the last report down with it. What is left up otherwise is
      // the previous import's verdict sitting above a roster the new file has
      // already changed, which is a report about a file the user is no longer
      // looking at. Set here rather than in the CSV branch's own success path,
      // because a *failed* import is exactly when a stale report is most
      // misleading: the user reads the panel and concludes the failure was
      // partial.
      setLastReport(null);
      try {
        assertImportSize(file.size);
        const text = await file.text();
        const trimmed = text.trim();

        // JSON branch
        if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
          let parsed: unknown;
          try {
            parsed = JSON.parse(trimmed);
          } catch {
            notify("That file is not valid JSON.", "error");
            return;
          }
          if (!parsed || typeof parsed !== "object") {
            notify("That JSON file does not contain a recognizable roster.", "error");
            return;
          }
          const obj = parsed as Record<string, unknown>;
          // Full backup file → route to the merge importer.
          if (obj.version !== undefined) {
            await importBackup(file);
            return;
          }
          // Players-only JSON
          if (Array.isArray(obj.players)) {
            if (!activeCommunity) {
              notify("Pick or create a community before importing a player file.", "error");
              return;
            }
            let imported = 0;
            const rejected: { name: string; reason: string }[] = [];
            for (const raw of obj.players) {
              if (!raw || typeof raw !== "object") continue;
              const p = raw as Partial<Player> & { id?: string; name?: string };
              if (!p.name) continue;
              const player: Player = {
                id: p.id ?? crypto.randomUUID(),
                communityId: activeCommunity.id,
                name: p.name,
                notes: p.notes,
                capabilities: Array.isArray(p.capabilities) ? p.capabilities : [],
              };
              const problems = validatePlayer(player, disciplines);
              if (problems.length > 0) {
                rejected.push({ name: player.name, reason: problems[0].message });
                continue;
              }
              await savePlayer(player);
              imported++;
            }
            // A file that yielded no player must not report one: an all-rejected
            // file, or one whose rows carry no name at all, would otherwise
            // announce "Imported 0 players" in success styling.
            if (imported > 0) {
              notify(
                `Imported ${imported} player${imported === 1 ? "" : "s"} into ${activeCommunity.name}.`,
                "success",
              );
            } else {
              notify(`No players imported into ${activeCommunity.name}.`, "error");
            }
            if (rejected.length > 0) {
              notify(
                `Skipped ${rejected.length} player${rejected.length === 1 ? "" : "s"}. First: "${rejected[0].name}" — ${rejected[0].reason}`,
                "error",
              );
            }
            return;
          }
          notify("That JSON file is not a recognized roster or backup.", "error");
          return;
        }

        // CSV branch
        if (!activeCommunity) {
          notify("Pick or create a community before importing a CSV.", "error");
          return;
        }
        const { rows, skipped: unparsed } = parsePlayerCsv(text);
        // The template's own example rows are separated here, before the
        // catalog is consulted: they are valid rows that this app chooses not
        // to write, and a choice the report has to be able to show.
        const { rows: entries, examples } = takeTemplateExamples(rows);
        // **One call per row rather than one call for the file.**
        // `csvRowsToPlayers` is a pure per-row loop, so the players and the
        // skips are byte-for-byte the same either way. The per-row call is what
        // keeps each player's **line** attached to it, and the write path below
        // needs that line in order to name the rows whose save failed.
        // `Player` carries no line of its own, so the alternative was to infer
        // one from a position in an array — and on a file where an earlier row
        // was skipped, that position is the wrong row's. A report that points
        // at the wrong line is the one lie this surface may not tell.
        const resolved = entries.map((row) => ({ line: row.line, ...csvRowsToPlayers([row], disciplines, activeCommunity.id) }));
        const toWrite = resolved.flatMap((r) => r.players.map((player) => ({ line: r.line, player })));
        const unresolved = resolved.flatMap((r) => r.skipped);

        // **A save that throws must still leave a report.** `savePlayer` can
        // refuse — the browser said no, the store is closed, the quota is gone —
        // and the loop used to abort with the report still unset. The user was
        // then left with a roster their file had partly changed, a red toast,
        // and **no verdict at all**: not a lie, since the report had been
        // cleared at the top of this function, but an *absence*, and on this
        // surface an absence is the failure nobody looks for. So the count of
        // what really landed is kept, the rows that never got written become
        // skips with their own lines, and `imported + skipped` still equals the
        // file's row count — so the headline a user can count is still a count
        // they can check.
        let saved = 0;
        let writeError: unknown = null;
        for (const entry of toWrite) {
          try {
            await savePlayer(entry.player);
            saved++;
          } catch (err) {
            writeError = err;
            break;
          }
        }
        const unsaved = toWrite.slice(saved).map((entry) => ({ line: entry.line, reason: unsavedRowReason }));
        // Sorted by line, and every skip list is merged rather than
        // concatenated: a user reading top to bottom down a spreadsheet reads
        // one sequence, and two sequences that each happen to be sorted tell
        // them to read the file twice. The grouping into causes is the panel's
        // job, and it re-sorts nothing.
        const skipped = [...unparsed, ...unresolved, ...examples, ...unsaved].sort((a, b) => a.line - b.line);
        setLastReport({ imported: saved, skipped });
        // Rethrown, and only now: the report is on the page, and the one
        // sentence a user needs for a storage failure is the one that says what
        // the browser said. Announcing it here instead would be a second
        // announcement path, and this one is already written.
        if (writeError !== null) throw writeError;

        // The skips that are not the template's own rows. Everything below
        // branches on this rather than on `skipped`, because the template's rows
        // are not failures and must not be dressed as ones.
        const unreadable = skipped.filter((s) => !s.reason.includes(TEMPLATE_EXAMPLE_REASON_MARKER));
        // Same rule as the JSON branch: a CSV of blank lines imports nothing and
        // must not claim a success.
        if (saved > 0) {
          notify(`Imported ${saved} player${saved === 1 ? "" : "s"} into ${activeCommunity.name}.`, "success");
        } else if (unreadable.length > 0 || skipped.length === 0) {
          // Either the app could not read a row, or the file held no player rows
          // at all. Both are things the user did not know and can act on.
          notify(`No players imported into ${activeCommunity.name}.`, "error");
        } else {
          // **The untouched template, and the app's first words to a new user.**
          // Nothing was written because every row was one this app recognised
          // as a template example, which is not a failure and must not be
          // announced in error styling at someone who has done nothing wrong.
          // The first thing a new organizer does with a template is import it
          // back to see what happens, so this is the first sentence this
          // surface ever speaks to anyone. It is stated, not styled as a
          // problem, and the panel underneath says exactly which rows and why.
          notify(`No players imported into ${activeCommunity.name}.`, "info");
        }
        // **A skip toast only when nothing was imported.** With the report up,
        // a skip toast is a second, worse copy of the same fact: it lasts three
        // seconds, it names one line out of all of them, and it is styled as an
        // error — so 40 players landing with 3 rows unread would raise a red
        // toast over a roster that is in good order. That is the overstatement
        // this app's copy has been fought over for, and the report is the
        // honest version of it. When nothing was imported the toast is not a
        // second copy: it is the one place the failure is announced, because a
        // report the user has to go and find is not a failure notice.
        if (saved === 0 && unreadable.length > 0) {
          notify(
            `Skipped ${unreadable.length} row${unreadable.length === 1 ? "" : "s"}. Line ${unreadable[0].line}: ${unreadable[0].reason}`,
            "error",
          );
        }
      } catch (err) {
        notify(`Import failed: ${formatError(err)}`, "error");
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [activeCommunity, disciplines, savePlayer, notify, fileInputRef, importBackup],
  );

  return { pendingMerge, confirmMerge, cancelMerge, lastReport, importFile };
}
