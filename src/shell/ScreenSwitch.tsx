import type { Dispatch, RefObject, SetStateAction } from "react";
import type {
  Community,
  Discipline,
  Id,
  Player,
  SavedSquad,
  Session,
  Tournament,
} from "../domain/types";
import type { SessionStore } from "../storage/types";
import type { HubMode, View } from "./useNavigation";
import {
  splitFlowRule,
  type MatchSetup,
  type SplitFlowResult,
  type SplitSource,
} from "./useSplitFlow";
import type { PendingMerge, PlayerImportResult } from "./usePlayerImport";
import type { ToastType } from "./useToasts";
import { formatError } from "../ui/format";
import { Screen } from "../ui/Screen";
import { DashboardScreen } from "../DashboardScreen";
import { RosterScreen } from "./RosterScreen";
import { GamesScreen } from "../tournament/GamesScreen";
import { TournamentScreen } from "../tournament/TournamentScreen";
import { SplitScreen } from "../session/SplitScreen";
import { HistoryScreen } from "../session/HistoryScreen";
import { SquadsScreen } from "../session/SquadsScreen";
import { DisciplinesScreen } from "../domain/DisciplinesScreen";
import { MatchScreen } from "../session/MatchScreen";

/** The `{disciplineId, teamCount}` draft Games is entered with and consumes. */
type TournamentPrefill = { disciplineId: Id; teamCount: number };

/**
 * Every prop is required and none carries a default. The switch is the one
 * place that reads the whole of app state, so a missing value has to be a
 * compile error at this boundary rather than a `?? []` that renders an empty
 * screen nobody can explain. Handlers taken straight from `useSplitFlow` are
 * named by index into `SplitFlowResult` so their signatures cannot drift from
 * the hook that produces them.
 */
export interface ScreenSwitchProps {
  // ---- what is on screen ----
  view: View;
  viewTournament: Tournament | null;
  setup: MatchSetup | null;
  activeSplit: { session: Session; source: SplitSource } | null;

  // ---- community-scoped data ----
  activeCommunity: Community | null;
  communityPlayers: Player[];
  communitySquads: SavedSquad[];
  communityTournaments: Tournament[];
  communitySessions: Session[];

  // ---- catalog and roster presentation ----
  disciplines: Discipline[];
  disciplinesById: Map<Id, Discipline>;
  visiblePlayers: Player[];
  filterIds: string[];
  editingPlayer: Player | null | "new";
  fileInputRef: RefObject<HTMLInputElement | null>;
  tournamentPrefill: TournamentPrefill | null;
  downloadingId: string | null;
  pendingMerge: PendingMerge | null;
  sessionsLoading: boolean;
  squadsLoading: boolean;
  disciplinesLoading: boolean;
  /**
   * The export nudge, already decided by `useDurability`. `onDismiss` is that
   * hook's own `dismissNudge`; the switch forwards it unchanged so the snooze
   * policy stays the one that was written down, and not a per-screen one.
   */
  nudge: { onDismiss: () => void } | null;
  /** Tri-state persistence verdict, forwarded to the roster's storage note. */
  persisted: boolean | null;

  // ---- stores and services the screens call into directly ----
  sessionStore: SessionStore;
  notify: (text: string, type?: ToastType) => void;

  // ---- navigation ----
  goBack: () => void;
  gotoHub: (mode: HubMode) => void;
  goDisciplines: () => void;
  setEditingPlayer: Dispatch<SetStateAction<Player | null | "new">>;
  setTournamentPrefill: (p: TournamentPrefill | null) => void;

  // ---- App's own handlers ----
  startAdHocSplit: () => void;
  openNewTournament: () => void;
  showSquads: () => void;
  addPlayer: () => void;
  openTournament: (id: Id) => void;
  filtersByDiscipline: (disciplineId: Id) => void;
  clearFilters: () => void;
  handleExport: () => Promise<void>;
  savePlayer: (player: Player) => Promise<void>;
  deletePlayer: (id: Id) => Promise<void>;
  deleteTournament: (id: Id) => Promise<void>;
  startSplit: () => void;
  deleteTournamentFromUI: (id: Id) => Promise<void>;
  openSession: SplitFlowResult["openSession"];
  deleteSession: (id: Id) => Promise<void>;
  deleteSquad: (id: Id) => Promise<void>;
  saveDiscipline: (d: Discipline) => Promise<void>;
  deleteDiscipline: (id: Id) => Promise<void>;
  downloadSampleData: (disciplineId: Id) => Promise<void>;

  // ---- the import and split flow's own handlers ----
  confirmMerge: () => void;
  /** C27's report shape, read by the roster panel. Declared once, here. */
  lastReport: PlayerImportResult["lastReport"];
  cancelMerge: () => void;
  importFile: (file: File) => Promise<void>;
  createTournament: SplitFlowResult["createTournament"];
  startMatch: SplitFlowResult["startMatch"];
  togglePlayer: SplitFlowResult["togglePlayer"];
  selectDiscipline: SplitFlowResult["selectDiscipline"];
  changeTeamCount: SplitFlowResult["changeTeamCount"];
  split: SplitFlowResult["split"];
  consumeTeams: SplitFlowResult["consumeTeams"];
  recordResult: SplitFlowResult["recordResult"];
  undoLastResult: SplitFlowResult["undoLastResult"];
  saveSquadFromSplit: SplitFlowResult["saveSquadFromSplit"];
  reSplitSquad: SplitFlowResult["reSplitSquad"];
  useSquadInTournament: SplitFlowResult["useSquadInTournament"];
  newTournamentFromSquad: SplitFlowResult["newTournamentFromSquad"];
}

/**
 * The screen switch: the `view.mode` chain that picks which screen `<main>`
 * shows, and nothing else. It sits between the topbar and the live region, so
 * it renders exactly one screen as `<main>`'s only child.
 *
 * Every value it reads arrives as a required prop and is forwarded unchanged —
 * the chain decides which screen mounts, and each screen keeps owning its own
 * behaviour. The two siblings App renders around this (the load-error alert and
 * the no-communities empty state) are not screens and stay in `App`.
 */
export function ScreenSwitch(props: ScreenSwitchProps) {
  const {
    view,
    viewTournament,
    setup,
    activeSplit,
    activeCommunity,
    communityPlayers,
    communitySquads,
    communityTournaments,
    communitySessions,
    disciplines,
    disciplinesById,
    visiblePlayers,
    filterIds,
    editingPlayer,
    fileInputRef,
    tournamentPrefill,
    downloadingId,
    pendingMerge,
    sessionsLoading,
    squadsLoading,
    disciplinesLoading,
    nudge,
    persisted,
    sessionStore,
    notify,
    goBack,
    gotoHub,
    goDisciplines,
    setEditingPlayer,
    setTournamentPrefill,
    startAdHocSplit,
    openNewTournament,
    showSquads,
    addPlayer,
    openTournament,
    filtersByDiscipline,
    clearFilters,
    handleExport,
    savePlayer,
    deletePlayer,
    deleteTournament,
    startSplit,
    deleteTournamentFromUI,
    openSession,
    deleteSession,
    deleteSquad,
    saveDiscipline,
    deleteDiscipline,
    downloadSampleData,
    confirmMerge,
    cancelMerge,
    importFile,
    lastReport,
    createTournament,
    startMatch,
    togglePlayer,
    selectDiscipline,
    changeTeamCount,
    split,
    consumeTeams,
    recordResult,
    undoLastResult,
    saveSquadFromSplit,
    reSplitSquad,
    useSquadInTournament,
    newTournamentFromSquad,
  } = props;
  return (
    <>
      {view.mode === "dashboard" && (
        <DashboardScreen
          community={activeCommunity}
          players={communityPlayers}
          squads={communitySquads}
          tournaments={communityTournaments}
          disciplines={disciplines}
          onSplitMatch={startAdHocSplit}
          onNewTournament={openNewTournament}
          onBrowseSquads={showSquads}
          onAddPlayer={addPlayer}
          onOpenPlayer={(player) => {
            gotoHub("roster");
            setEditingPlayer(player);
          }}
          onOpenTournament={(tournament) => openTournament(tournament.id)}
          nudge={nudge}
        />
      )}
      {view.mode === "roster" && (
        <RosterScreen
          activeCommunity={activeCommunity}
          disciplines={disciplines}
          players={communityPlayers}
          visiblePlayers={visiblePlayers}
          persisted={persisted}
          filterIds={filterIds}
          disciplinesById={disciplinesById}
          editingPlayer={editingPlayer}
          fileInputRef={fileInputRef}
          onToggleFilter={filtersByDiscipline}
          onClearFilters={clearFilters}
          onAddPlayer={() => setEditingPlayer("new")}
          onOpenPlayer={(player) => setEditingPlayer(player)}
          pendingMerge={pendingMerge}
          notify={notify}
          lastReport={lastReport}
          onConfirmMerge={confirmMerge}
          onCancelMerge={cancelMerge}
          importFile={importFile}
          onExport={handleExport}
          onSplitMatch={startAdHocSplit}
          onSavePlayer={savePlayer}
          onDeletePlayer={deletePlayer}
          onCloseEditor={() => setEditingPlayer(null)}
        />
      )}
      {view.mode === "games" && (
        <Screen>
          <GamesScreen
            tournaments={communityTournaments}
            disciplines={disciplines}
            onCreate={createTournament}
            onOpen={openTournament}
            onDelete={deleteTournament}
            onManageDisciplines={() => goDisciplines()}
            prefill={tournamentPrefill}
            onPrefillConsumed={() => setTournamentPrefill(null)}
            activeCommunity={activeCommunity}
          />
        </Screen>
      )}
      {view.mode === "tournament" && viewTournament && (
        <Screen>
          <TournamentScreen
            tournament={viewTournament}
            disciplines={disciplines}
            matchingSquads={communitySquads.filter(
              (q) =>
                q.disciplineId === viewTournament.disciplineId &&
                q.result.teams.length === viewTournament.teamCount,
            )}
            roster={communityPlayers}
            onBack={() => goBack()}
            onSplit={() => startSplit()}
            onUseSavedSquad={(squad) => useSquadInTournament(squad, viewTournament.id)}
            onRecord={recordResult}
            onUndo={undoLastResult}
            onDelete={() => deleteTournamentFromUI(viewTournament.id)}
            onReroll={() => startMatch("tournament", viewTournament.id)}
            totalPlayers={communityPlayers.length}
          />
        </Screen>
      )}

      {view.mode === "split" && activeSplit && (
        <SplitScreen
          session={activeSplit.session}
          discipline={disciplines.find(d => d.id === activeSplit.session.disciplineId) ?? disciplines[0]}
          roster={communityPlayers}
          onPersistResult={async (result) => {
            // FLOW rule 3: only ad-hoc splits persist re-rolls/swaps to the
            // Session log. Session/squad sources are synthetic — re-rolling a
            // reopened History session must not mutate the archived raw log, and
            // a squad re-split only persists when saved as a new squad.
            // Tournament splits persist via the bracket (no Session pollution).
            if (splitFlowRule(activeSplit.source).persistsSession) {
              const updatedSession = { ...activeSplit.session, result };
              await sessionStore.saveSession(updatedSession);
            }
          }}
          source={activeSplit.source}
          onSubmitTournament={
            splitFlowRule(activeSplit.source).submitsTournament && setup?.tournamentId
              ? (teams) => consumeTeams(setup.tournamentId!, teams)
              : undefined
          }
          onSaveSquad={(name, result) => saveSquadFromSplit(name, result, activeSplit.session.disciplineId)}
          onBack={() => goBack()}
          // The landing hero mounts SplitScreen with no `share`, so the same
          // screen renders there with no share control: the demo split belongs
          // to nobody, and a Share button on a public marketing page would
          // offer to publish a fabricated roster.
          share={activeCommunity ? { communityName: activeCommunity.name } : undefined}
        />
      )}
      {view.mode === "history" && (
        <HistoryScreen
          sessions={communitySessions}
          loading={sessionsLoading}
          disciplines={disciplines}
          onReopen={openSession}
          onDelete={async (id) => {
            try {
              await deleteSession(id);
            } catch (err) {
              notify(`Could not delete the session: ${formatError(err)}`, "error");
            }
          }}
        />
      )}

      {view.mode === "squads" && (
        <SquadsScreen
          squads={communitySquads}
          loading={squadsLoading}
          disciplines={disciplines}
          roster={communityPlayers}
          onBack={() => goBack()}
          onReSplit={reSplitSquad}
          onNewTournament={newTournamentFromSquad}
          onDelete={async (id) => { await deleteSquad(id); }}
        />
      )}

      {view.mode === "disciplines" && (
        <DisciplinesScreen
          disciplines={disciplines}
          loading={disciplinesLoading}
          onSave={saveDiscipline}
          onDelete={deleteDiscipline}
          onBack={() => goBack()}
          onDownloadSample={downloadSampleData}
          downloadingId={downloadingId}
        />
      )}

      {view.mode === "match" && setup && (
        <MatchScreen
          roster={communityPlayers}
          disciplines={disciplines}
          disciplineId={setup.disciplineId}
          selectedIds={setup.selectedIds}
          teamCount={setup.teamCount}
          lockedDisciplineId={view.mode === "match" && view.source === "tournament" ? setup.disciplineId : undefined}
          lockedTeamCount={view.mode === "match" && view.source === "tournament" ? setup.teamCount : undefined}
          onTogglePlayer={togglePlayer}
          onSelectDiscipline={selectDiscipline}
          onTeamCountChange={changeTeamCount}
          onSplit={split}
          onBack={() => goBack()}
        />
      )}
    </>
  );
}
