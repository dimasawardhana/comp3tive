import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type Id, type Player } from "./domain";
import {
  createIndexedDbCommunityStore,
  createIndexedDbRosterStore,
  createIndexedDbSessionStore,
  createIndexedDbDisciplineStore,
  createIndexedDbTournamentStore,
  createIndexedDbSavedSquadStore,
} from "./storage";
import { useRoster } from "./roster/useRoster";
import { useDisciplines } from "./domain/useDisciplines";
import { useCommunities } from "./domain/useCommunities";
import { useSessions } from "./session/useSessions";
import { useSavedSquads } from "./session/useSavedSquads";
import { useTournaments } from "./tournament/useTournaments";
import { useAppCommands } from "./shell/useAppCommands";
import { createPushController } from "./account/useSync";
import { useLegacyAdoption } from "./shell/useLegacyAdoption";
import { useNavigation } from "./shell/useNavigation";
import { useSplitFlow } from "./shell/useSplitFlow";
import { useCommunityScope } from "./shell/useCommunityScope";
import { usePlayerImport } from "./shell/usePlayerImport";
import { AppChrome } from "./shell/AppChrome";
import { ScreenSwitch } from "./shell/ScreenSwitch";
import { AddCommunityForm } from "./shell/AddCommunityForm";
import { useAddCommunity } from "./shell/useAddCommunity";
import { useStoredPref, useThemeAndLayout } from "./shell/usePreferences";
import { useDurability } from "./shell/useDurability";
import { useToasts } from "./shell/useToasts";

const communityStore = createIndexedDbCommunityStore();
const rosterStore = createIndexedDbRosterStore();
const sessionStore = createIndexedDbSessionStore();
const disciplineStore = createIndexedDbDisciplineStore();
const tournamentStore = createIndexedDbTournamentStore();
const squadStore = createIndexedDbSavedSquadStore();

export default function App() {
  const roster = useRoster(rosterStore);
  const sessions = useSessions(sessionStore);
  const catalog = useDisciplines(disciplineStore);
  const communities = useCommunities(communityStore, rosterStore, sessionStore, squadStore, tournamentStore);
  const tournaments = useTournaments(tournamentStore);
  const savedSquads = useSavedSquads(squadStore);
  const { view, viewStack, pushView, goBack, resetTo } = useNavigation({ mode: "dashboard" });
  /** First load failure from any store. These were previously swallowed, which
   *  left a failed read looking identical to an empty app. */
  const loadError = communities.error ?? roster.error ?? sessions.error ?? catalog.error ?? tournaments.error ?? savedSquads.error;

  const [tournamentPrefill, setTournamentPrefill] = useState<{ disciplineId: Id; teamCount: number } | null>(null);
  const [filterIds, setFilterIds] = useState<string[]>([]);

  const goDisciplines = () => pushView({ mode: "disciplines" });

  const { toasts, notify } = useToasts();
  const [editingPlayer, setEditingPlayer] = useState<Player | null | "new">(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { themePref, setThemePref, layoutPref, setLayoutPref, effectiveLayout } = useThemeAndLayout();
  /** Desktop rail shows labels, or collapses to icons only. */
  const [railPref, setRailPref] = useStoredPref("tb-rail", "expanded");

  const disciplines = catalog.disciplines;
  // The community-scoping rule itself lives in useCommunityScope; this is the
  // app's single call site for it.
  const {
    activeCommunity,
    disciplinesById,
    players: communityPlayers,
    sessions: communitySessions,
    tournaments: communityTournaments,
    squads: communitySquads,
  } = useCommunityScope({
    communities: communities.communities,
    activeCommunityId: communities.activeId,
    players: roster.players,
    sessions: sessions.sessions,
    tournaments: tournaments.tournaments,
    squads: savedSquads.squads,
    disciplines,
  });
  const visiblePlayers = filterIds.length === 0
    ? communityPlayers
    : communityPlayers.filter((p) => p.capabilities.some((c) => filterIds.includes(c.disciplineId)));
  /**
   * Storage durability, the one call site of the hook.
   *
   * Destructured field by field, and that is not a style preference: the hook
   * hands back a fresh object literal on every render, so the returned value
   * must never reach a dependency array. The only thing passed to the hook here
   * is a number, and the only thing passed *on* is `dismissNudge`, which the
   * hook keeps stable across renders by `useCallback`.
   *
   * `shouldNudge` is recomputed against `Date.now()` in the hook's render body,
   * so it never flips on its own — a tab left open across the fortnight
   * boundary keeps the answer it painted. That is accepted, not overlooked:
   * every interaction this app has re-renders `App` (the nav keeps its state
   * here, and every store refresh lands in state), so the stale window is
   * exactly the stretch in which the user has touched nothing at all — and the
   * first thing they do, on returning, corrects it. A timer would re-render
   * the whole tree every tick for a case with nobody in it to warn.
   */
  const { persisted, shouldNudge, dismissNudge, recordExport } = useDurability({
    playerCount: communityPlayers.length,
  });
  /** Null renders no row; the hook has already applied every other gate. */
  const exportNudge = shouldNudge ? { onDismiss: dismissNudge } : null;
  // The unscoped source is deliberate: `find` by id is already unique, and
  // narrowing it is a behaviour change no ticket asks for.
  const viewTournament = useMemo(
    () =>
      view.mode === "tournament"
        ? tournaments.tournaments.find((t) => t.id === view.id) ?? null
        : null,
    [view, tournaments.tournaments],
  );

  useLegacyAdoption({
    activeCommunity,
    communities: communities.communities,
    players: roster.players,
    sessions: sessions.sessions,
    savePlayer: roster.savePlayer,
    sessionStore,
    notify,
  });

  /**
   * The Account's data lifecycle (ticket 05): one object, built once, threaded
   * to the AccountPanel through the screen switch. `onReplaced` refreshes every
   * domain hook so a pull renders without a reload, and activates the pulled
   * community when the Account named one.
   */
  const accountSync = useMemo(
    () => ({
      stores: {
        communities: communityStore,
        roster: rosterStore,
        sessions: sessionStore,
        tournaments: tournamentStore,
        squads: squadStore,
        disciplines: disciplineStore,
      },
      onReplaced: async (communityId: string | null) => {
        await communities.refresh();
        await roster.refresh();
        await sessions.refresh();
        await tournaments.refresh();
        await savedSquads.refresh();
        await catalog.refresh();
        if (communityId) communities.setActiveId(communityId);
      },
      notify,
    }),
    [communities, roster, sessions, tournaments, savedSquads, catalog, notify],
  );
  /**
   * The Account's push (ticket 06): every store mutation marks the active
   * community dirty, and one debounced upload carries it. Signed out, the
   * controller is inert by construction (`markDirty` checks the session).
   * `pagehide` flushes, so an edit-then-close still reaches the Account.
   */
  const pushController = useMemo(
    () =>
      createPushController({
        stores: accountSync.stores,
        activeCommunityId: () => communities.activeId,
        notify,
      }),
    [accountSync, notify],
  );
  const markDirty = useCallback(
    (communityId: string | null | undefined) => {
      if (communityId) pushController.markDirty(communityId);
    },
    [pushController],
  );
  const flow = useSplitFlow({
    disciplines,
    // Unscoped on purpose, like `viewTournament` above: a split's bracket
    // belongs to the tournament the split was started from, whatever the
    // community is now. Narrowing this list would be a behaviour change.
    tournaments: tournaments.tournaments,
    disciplinesById,
    players: communityPlayers,
    viewTournament,
    view,
    activeCommunityId: activeCommunity?.id ?? null,
    sessionStore,
    saveTournament: tournaments.saveTournament,
    saveSquad: savedSquads.saveSquad,
    notify,
    pushView,
    resetTo,
    setTournamentPrefill,
    markDirty,
  });
  const {
    setup,
    activeSplit,
    gotoHub,
    startMatch,
    openSession,
    createTournament,
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
  } = flow;
  const importer = usePlayerImport({
    activeCommunity,
    disciplines,
    communities: communities.communities,
    players: roster.players,
    sessions: sessions.sessions,
    tournaments: tournaments.tournaments,
    squads: savedSquads.squads,
    savePlayer: roster.savePlayer,
    saveCommunity: communityStore.saveCommunity,
    saveSession: sessionStore.saveSession,
    saveTournament: tournamentStore.saveTournament,
    saveDiscipline: catalog.saveDiscipline,
    saveSquad: squadStore.saveSavedSquad,
    // Communities before their own records, the rest after: the order the merge
    // has always written in. Two handles, not one, so the merge reads each list
    // once; both are memoised because the hook memoises on them.
    refreshCommunities: useCallback(async () => {
      await communities.refresh();
    }, [communities]),
    refreshRecords: useCallback(async () => {
      await roster.refresh();
      await sessions.refresh();
      await tournaments.refresh();
      await savedSquads.refresh();
    }, [roster, sessions, tournaments, savedSquads]),
    notify,
    fileInputRef,
  });

  const {
    showAddCommunity,
    setShowAddCommunity,
    communityName,
    setCommunityName,
    createCommunity,
    cancelAddCommunity,
  } = useAddCommunity(
    useCallback(
      async (name: string) => {
        const community = await communities.create(name);
        markDirty(community.id);
        return community;
      },
      [communities, markDirty],
    ),
  );


  useEffect(() => {
    const flush = () => pushController.flush();
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, [pushController]);

  /**
   * The shell's write commands, in one hook: the seven store mutations that all
   * answer with a toast, plus the export and the delete census. See the hook's
   * own header for why this cluster and not the navigation helpers around it.
   *
   * `communities.remove` is passed rather than the store, because the cascade and
   * the counts are the hook's own contract with `community-removal.ts` and
   * re-deriving them here would be a second copy of it.
   */
  const commands = useAppCommands({
    savePlayer: roster.savePlayer,
    deletePlayer: roster.deletePlayer,
    saveDiscipline: catalog.saveDiscipline,
    deleteDiscipline: catalog.deleteDiscipline,
    deleteCommunityCascade: communities.remove,
    communityCount: communities.communities.length,
    players: roster.players,
    sessionCount: sessions.sessions.length,
    squadCount: savedSquads.squads.length,
    tournamentCount: tournaments.tournaments.length,
    exportCommunities: communities.communities,
    exportTournaments: tournaments.tournaments,
    exportSquads: savedSquads.squads,
    exportDisciplines: catalog.disciplines,
    deleteTournament: tournaments.deleteTournament,
    deleteSession: sessions.deleteSession,
    deleteSquad: savedSquads.deleteSquad,
    sessionStore,
    recordExport,
    view,
    gotoHub,
    notify,
    markDirty,
    activeCommunityId: communities.activeId,
  });

  const filtersByDiscipline = (disciplineId: Id) => {
    setFilterIds(prev => prev.includes(disciplineId) ? prev.filter(id => id !== disciplineId) : [...prev, disciplineId]);
  };

  const clearFilters = () => {
    setFilterIds([]);
  };

  // Dashboard actions (ticket 04): every exit reuses an existing App flow —
  // the same ad-hoc split handler Roster's "Split match" uses, the Games
  // create flow, hub navigation, and the roster "+ Add Player" modal. Only
  // the entry points differ.
  const showSquads = () => {
    gotoHub("squads");
  };

  const addPlayer = () => {
    gotoHub("roster");
    setEditingPlayer("new");
  };

  /** Every non-tournament Split entry — Roster's "Split match" and the
   *  Dashboard's — starts an ad-hoc split. Neither screen can be showing a
   *  tournament, so there is nothing to scope it to. */
  const startAdHocSplit = () => {
    startMatch("ad-hoc");
  };

  const openNewTournament = () => {
    setTournamentPrefill({ disciplineId: "", teamCount: 0 });
    gotoHub("games");
  };

  const openTournament = (id: Id) => {
    pushView({ mode: "tournament", id });
  };

  /** The bracket's own Split entry. This renders only inside a tournament view,
   *  so the ad-hoc fallback the old copy carried was unreachable. */
  const startSplit = () => {
    if (viewTournament) {
      startMatch("tournament", viewTournament.id);
    }
  };

  return (
    <div className="app" data-layout={effectiveLayout} data-rail={railPref}>
      <AppChrome
        railPref={railPref}
        onSelectCommunity={communities.setActiveId}
        onToggleRail={() => setRailPref(railPref === "collapsed" ? "expanded" : "collapsed")}
        viewStack={viewStack}
        onGotoHub={gotoHub}
        communities={communities.communities}
        activeCommunity={activeCommunity}
        onDeleteCommunity={commands.deleteCommunity}
        communityDeleteWarning={commands.communityDeleteWarning}
        onToggleAddCommunity={() => setShowAddCommunity((s) => !s)}
        toasts={toasts}
      >
        {loadError && (
          <div className="load-error" role="alert">
            <strong>Couldn&apos;t load your saved data.</strong> {loadError} Reload the page to try again.
          </div>
        )}
        {showAddCommunity && (
          <AddCommunityForm
            communityName={communityName}
            onCommunityNameChange={setCommunityName}
            onCreate={createCommunity}
            onCancel={cancelAddCommunity}
          />
        )}
        {communities.loading && <p className="status">Loading&hellip;</p>}
        {!communities.loading && communities.communities.length === 0 && !showAddCommunity && (
          <div className="empty">
            <div className="kicker">First whistle</div>
            <div className="big">No communities yet</div>
            <p>A community holds one roster: the players, teams and history of one group.</p>
            <button type="button" className="btn btn-primary" onClick={() => setShowAddCommunity(true)}>
              + Create a community
            </button>
          </div>
        )}

        <ScreenSwitch
          view={view}
          viewTournament={viewTournament}
          setup={setup}
          activeSplit={activeSplit}
          communities={communities.communities}
          activeCommunity={activeCommunity}
          communityPlayers={communityPlayers}
          communitySquads={communitySquads}
          communityTournaments={communityTournaments}
          communitySessions={communitySessions}
          disciplines={disciplines}
          disciplinesById={disciplinesById}
          visiblePlayers={visiblePlayers}
          filterIds={filterIds}
          editingPlayer={editingPlayer}
          fileInputRef={fileInputRef}
          tournamentPrefill={tournamentPrefill}
          downloadingId={commands.downloadingId}
          pendingMerge={importer.pendingMerge}
          lastReport={importer.lastReport}
          sessionsLoading={sessions.loading}
          nudge={exportNudge}
          persisted={persisted}
          squadsLoading={savedSquads.loading}
          disciplinesLoading={catalog.loading}
          sessionStore={sessionStore}
          accountSync={accountSync}
          pushController={pushController}
          themePref={themePref}
          layoutPref={layoutPref}
          onThemeChange={setThemePref}
          onLayoutChange={setLayoutPref}
          notify={notify}
          goBack={goBack}
          gotoHub={gotoHub}
          goDisciplines={goDisciplines}
          setEditingPlayer={setEditingPlayer}
          setTournamentPrefill={setTournamentPrefill}
          startAdHocSplit={startAdHocSplit}
          openNewTournament={openNewTournament}
          showSquads={showSquads}
          addPlayer={addPlayer}
          openTournament={openTournament}
          filtersByDiscipline={filtersByDiscipline}
          clearFilters={clearFilters}
          handleExport={commands.handleExport}
          savePlayer={commands.savePlayer}
          deletePlayer={commands.deletePlayer}
          deleteTournament={commands.deleteTournament}
          startSplit={startSplit}
          deleteTournamentFromUI={commands.deleteTournamentFromUI}
          openSession={openSession}
          deleteSession={commands.deleteSession}
          deleteSquad={commands.deleteSquad}
          markDirty={markDirty}
          saveDiscipline={commands.saveDiscipline}
          deleteDiscipline={commands.deleteDiscipline}
          downloadSampleData={commands.downloadSampleData}
          confirmMerge={importer.confirmMerge}
          cancelMerge={importer.cancelMerge}
          importFile={importer.importFile}
          createTournament={createTournament}
          startMatch={startMatch}
          togglePlayer={togglePlayer}
          selectDiscipline={selectDiscipline}
          changeTeamCount={changeTeamCount}
          split={split}
          consumeTeams={consumeTeams}
          recordResult={recordResult}
          undoLastResult={undoLastResult}
          saveSquadFromSplit={saveSquadFromSplit}
          reSplitSquad={reSplitSquad}
          useSquadInTournament={useSquadInTournament}
          newTournamentFromSquad={newTournamentFromSquad}
        />
      </AppChrome>
    </div>
  );
}
