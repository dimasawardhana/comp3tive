import { useCallback, useState } from "react";
import type { Community, Discipline, Id, Player, SavedSquad, Tournament } from "../domain/types";
import type { SessionStore } from "../storage/types";
import { serializeBackup } from "../data/transfer";
import { formatError } from "../ui/format";
import type { ToastType } from "./useToasts";
import type { HubMode, View } from "./useNavigation";

/**
 * The shell's write commands: every handler in `App` that mutates a store and
 * answers with a toast.
 *
 * **Why these and not the navigation helpers.** The rule was the one
 * `.superpowers/sdd/2026-09-17-shell-and-structure/progress.md` derived when the
 * last extraction was sized: a region's line cost is its *read set*, not its
 * length. `filtersByDiscipline`, `showSquads`, `openTournament` and their
 * siblings are one to three lines each that close over one or two identifiers,
 * so moving them buys nothing and costs a prop. What is here instead is the
 * cluster that repeats the same three-line shape — `try { await … } catch { notify }`
 * — over seven different stores, and carries the two pieces of real logic in the
 * file (`communityDeleteWarning`'s census, `handleExport`'s ordering comment).
 *
 * **`downloadingId` lives here, not in `App`.** It is `downloadSampleData`'s own
 * in-flight flag and nothing else reads it; `App` forwards it to `ScreenSwitch`
 * as a prop, which is a read, not an owner. Keeping the state beside its only
 * writer is what stops this hook from being a relocation of `App`'s state.
 *
 * **Nothing here calls `notify` for itself.** `notify` arrives from `App`'s one
 * `useToasts()` call, which `src/shell/useToasts.ts` requires be the only one.
 */
export interface AppCommandsDeps {
  savePlayer: (player: Player) => Promise<void>;
  deletePlayer: (id: Id) => Promise<void>;
  saveDiscipline: (d: Discipline) => Promise<void>;
  deleteDiscipline: (id: Id) => Promise<void>;
  /** The cascade `useCommunities().remove` runs, and the counts it reports back. */
  deleteCommunityCascade: (id: Id) => Promise<{
    players: number;
    sessions: number;
    squads: number;
    tournaments: number;
  }>;
  /** The active community list, read by `deleteCommunity`'s last-community guard. */
  communityCount: number;
  /**
   * Unscoped on purpose, and both the delete census and the backup read them
   * that way: "what will this take with it" and "export everything" are
   * questions about every community, not the active one.
   */
  players: Player[];
  sessionCount: number;
  squadCount: number;
  tournamentCount: number;
  exportCommunities: Community[];
  exportTournaments: Tournament[];
  exportSquads: SavedSquad[];
  /**
   * The whole catalog, unscoped like the other three export lists: an export
   * carries every community and every discipline the device knows, so a restore
   * onto a fresh device gets the custom entries its players' capabilities name.
   */
  exportDisciplines: Discipline[];
  deleteTournament: (id: Id) => Promise<void>;
  sessionStore: SessionStore;
  recordExport: () => void;
  /** `deleteTournamentFromUI` bounces to Games only when the deleted one is on screen. */
  view: View;
  gotoHub: (mode: HubMode) => void;
  notify: (text: string, type?: ToastType) => void;
}

export interface AppCommands {
  savePlayer: (player: Player) => Promise<void>;
  deletePlayer: (id: Id) => Promise<void>;
  saveDiscipline: (d: Discipline) => Promise<void>;
  deleteDiscipline: (id: Id) => Promise<void>;
  downloadSampleData: (disciplineId: Id) => Promise<void>;
  downloadingId: string | null;
  deleteCommunity: (id: Id) => Promise<void>;
  communityDeleteWarning: (communityId: Id) => string;
  handleExport: () => Promise<void>;
  deleteTournament: (id: Id) => Promise<void>;
  deleteTournamentFromUI: (id: Id) => Promise<void>;
}

/** `1 player`, `2 players` — the count-and-noun shape both censuses print. */
const plural = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`;

export function useAppCommands(deps: AppCommandsDeps): AppCommands {
  const {
    savePlayer,
    deletePlayer: deletePlayerFromStore,
    saveDiscipline,
    deleteDiscipline: deleteDisciplineFromStore,
    deleteCommunityCascade,
    communityCount,
    players,
    sessionCount,
    squadCount,
    tournamentCount,
    exportCommunities,
    exportTournaments,
    exportSquads,
    exportDisciplines,
    deleteTournament: deleteTournamentFromStore,
    sessionStore,
    recordExport,
    view,
    gotoHub,
    notify,
  } = deps;

  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const deletePlayer = useCallback(
    async (id: Id) => {
      try {
        await deletePlayerFromStore(id);
      } catch (err) {
        notify(`Could not delete the player: ${formatError(err)}`, "error");
      }
    },
    [deletePlayerFromStore, notify],
  );

  const saveDisciplineWithNotify = useCallback(
    async (d: Discipline) => {
      try {
        await saveDiscipline(d);
      } catch (err) {
        notify(`Could not save discipline: ${formatError(err)}`, "error");
        throw err;
      }
    },
    [saveDiscipline, notify],
  );

  const deleteDiscipline = useCallback(
    async (id: Id) => {
      try {
        await deleteDisciplineFromStore(id);
      } catch (err) {
        notify(`Could not delete discipline: ${formatError(err)}`, "error");
        throw err;
      }
    },
    [deleteDisciplineFromStore, notify],
  );

  const downloadSampleData = useCallback(
    async (disciplineId: Id) => {
      setDownloadingId(disciplineId);
      try {
        const { downloadSampleData: download } = await import("../data/sample-data");
        await download(disciplineId);
      } catch {
        notify("Could not download sample data", "error");
      } finally {
        setDownloadingId(null);
      }
    },
    [notify],
  );

  const deleteCommunity = useCallback(
    async (id: Id) => {
      if (communityCount <= 1) {
        notify("You need at least one community.", "error");
        return;
      }
      const counts = await deleteCommunityCascade(id);
      const parts = [
        counts.players && plural(counts.players, "player"),
        counts.sessions && plural(counts.sessions, "session"),
        counts.squads && plural(counts.squads, "saved squad"),
        counts.tournaments && plural(counts.tournaments, "tournament"),
      ].filter(Boolean);
      notify(
        parts.length > 0 ? `Community deleted, along with ${parts.join(", ")}.` : "Community deleted.",
        "success",
      );
    },
    [communityCount, deleteCommunityCascade, notify],
  );

  /** A truthful description of what deleting this community will take with it. */
  const communityDeleteWarning = useCallback(
    (communityId: Id): string => {
      const playerCount = players.filter((p) => p.communityId === communityId).length;
      const parts = [
        playerCount && plural(playerCount, "player"),
        sessionCount && plural(sessionCount, "session"),
        squadCount && plural(squadCount, "saved squad"),
        tournamentCount && plural(tournamentCount, "tournament"),
      ].filter(Boolean);
      return parts.length > 0 ? ` This also permanently deletes ${parts.join(", ")}.` : "";
    },
    // The three counts are per-community and so cannot be pre-filtered by the
    // caller; the census is the one place that reads the unscoped lists.
    [players, sessionCount, squadCount, tournamentCount],
  );

  const handleExport = useCallback(async () => {
    const allSessions = await sessionStore.listSessions();
    const blob = new Blob(
      [
        serializeBackup(
          players,
          allSessions,
          exportCommunities,
          exportTournaments,
          exportSquads,
          exportDisciplines,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `comp3tive-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    // Last, after the download has been triggered and its object URL released:
    // the export is over from the app's point of view, and this is the
    // bookkeeping. The browser exposes no way to learn whether the user then
    // cancelled a save dialog, so what is recorded is "an export was
    // triggered" — the distinction `useDurability` already draws about this key
    // when it says a file on disk is the backup.
    recordExport();
  }, [sessionStore, players, exportCommunities, exportTournaments, exportSquads, exportDisciplines, recordExport]);

  const deleteTournament = useCallback(
    async (id: Id) => {
      try {
        await deleteTournamentFromStore(id);
      } catch (err) {
        notify(`Could not delete the tournament: ${formatError(err)}`, "error");
      }
    },
    [deleteTournamentFromStore, notify],
  );

  const deleteTournamentFromUI = useCallback(
    async (id: Id) => {
      await deleteTournament(id);
      if (view.mode === "tournament" && view.id === id) {
        gotoHub("games");
      }
    },
    [deleteTournament, view, gotoHub],
  );

  return {
    savePlayer,
    deletePlayer,
    saveDiscipline: saveDisciplineWithNotify,
    deleteDiscipline,
    downloadSampleData,
    downloadingId,
    deleteCommunity,
    communityDeleteWarning,
    handleExport,
    deleteTournament,
    deleteTournamentFromUI,
  };
}
