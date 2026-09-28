import { useCallback, useState, type RefObject } from "react";
import type { Community, Discipline, Player, SavedSquad, Session, Tournament } from "../domain/types";
import { parseBackup } from "../data/transfer";
import { assertImportSize, csvRowsToPlayers, parsePlayerCsv, type ImportSkip } from "../data/player-import";
import { validatePlayer } from "../domain/validation";
import { formatError } from "../ui/format";
import type { ToastType } from "./useToasts";

/** A08's per-row skip, re-exported so a consumer imports it from one place. */
export type { ImportSkip } from "../data/player-import";

/** The outcome of the last import, for the roster screen's report panel. */
export interface ImportReport {
  imported: number;
  skipped: ImportSkip[];
}

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
   * Re-read every list the merge writes, communities before their records and
   * the rest after. The hooks hold their own copies of the store's lists, so
   * nothing an import writes is on screen until this runs.
   */
  refreshImported: () => Promise<void>;
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
    refreshImported,
    notify,
    fileInputRef,
  } = deps;
  const [pendingMerge, setPendingMerge] = useState<PendingMerge | null>(null);
  const [lastReport, setLastReport] = useState<ImportReport | null>(null);

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
          await refreshImported();
          for (const p of newPlayers) await savePlayer(p);
          for (const s of newSessions) await saveSession(s);
          for (const t of newTournaments) await saveTournament(t);
          for (const q of newSquads) await saveSquad(q);
          await refreshImported();
        },
      });
    },
    [communities, players, sessions, tournaments, squads, disciplines, saveCommunity, savePlayer, saveSession, saveTournament, saveSquad, refreshImported, notify],
  );

  const importFile = useCallback(
    async (file: File) => {
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
            // A08's `ImportSkip` is a line/reason pair, and this branch has
            // neither: an entry that is not an object is not a row, so nothing
            // is skipped. The rejected names travel in the toast below.
            setLastReport({ imported, skipped: [] });
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
        const { players: imported, skipped: unresolved } = csvRowsToPlayers(rows, disciplines, activeCommunity.id);
        for (const player of imported) await savePlayer(player);
        const skipped = [...unparsed, ...unresolved].sort((a, b) => a.line - b.line);
        setLastReport({ imported: imported.length, skipped });
        // Same rule as the JSON branch: a CSV of blank lines imports nothing and
        // must not claim a success.
        if (imported.length > 0) {
          notify(
            `Imported ${imported.length} player${imported.length === 1 ? "" : "s"} into ${activeCommunity.name}.`,
            "success",
          );
        } else {
          notify(`No players imported into ${activeCommunity.name}.`, "error");
        }
        if (skipped.length > 0) {
          notify(
            `Skipped ${skipped.length} row${skipped.length === 1 ? "" : "s"}. Line ${skipped[0].line}: ${skipped[0].reason}`,
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
