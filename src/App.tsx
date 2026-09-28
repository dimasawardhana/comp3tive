import { useEffect, useMemo, useRef, useState } from "react";
import { type Discipline, type Id, type Player } from "./domain";
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
import { DisciplinesScreen } from "./domain/DisciplinesScreen";
import { MatchScreen } from "./session/MatchScreen";
import { SplitScreen } from "./session/SplitScreen";
import { HistoryScreen } from "./session/HistoryScreen";
import { useSessions } from "./session/useSessions";
import { useSavedSquads } from "./session/useSavedSquads";
import { SquadsScreen } from "./session/SquadsScreen";
import { DashboardScreen } from "./DashboardScreen";
import { Screen } from "./ui/Screen";
import { useTournaments } from "./tournament/useTournaments";
import { GamesScreen } from "./tournament/GamesScreen";
import { TournamentScreen } from "./tournament/TournamentScreen";
import { serializeBackup, parseBackup } from "./data/transfer";
import { assertImportSize, csvRowsToPlayers, parsePlayerCsv } from "./data/player-import";
import { validatePlayer } from "./domain/validation";
import { useNavigation } from "./shell/useNavigation";
import { useSplitFlow, splitFlowRule } from "./shell/useSplitFlow";
import { useCommunityScope } from "./shell/useCommunityScope";
import { RosterScreen } from "./shell/RosterScreen";
import { AppChrome } from "./shell/AppChrome";
import { useStoredPref, useMediaQuery } from "./shell/usePreferences";
import { useToasts } from "./shell/useToasts";
import { formatError } from "./ui/format";

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
  const [communityName, setCommunityName] = useState("");
  const [showAddCommunity, setShowAddCommunity] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null | "new">(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [themePref, setThemePref] = useStoredPref("tb-theme", "auto");
  const [layoutPref, setLayoutPref] = useStoredPref("tb-layout", "auto");
  /** Desktop rail shows labels, or collapses to icons only. */
  const [railPref, setRailPref] = useStoredPref("tb-rail", "expanded");
  const isWide = useMediaQuery("(min-width: 1024px)");
  const effectiveLayout: "mobile" | "desktop" =
    layoutPref === "auto" ? (isWide ? "desktop" : "mobile") : (layoutPref as "mobile" | "desktop");

  useEffect(() => {
    const el = document.documentElement;
    if (themePref === "auto") {
      delete el.dataset.theme;
    } else {
      el.dataset.theme = themePref;
    }
    if (layoutPref === "auto") {
      delete el.dataset.layout;
    } else {
      el.dataset.layout = layoutPref;
    }
  }, [themePref, layoutPref]);

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
  // The unscoped source is deliberate: `find` by id is already unique, and
  // narrowing it is a behaviour change no ticket asks for.
  const viewTournament = useMemo(
    () =>
      view.mode === "tournament"
        ? tournaments.tournaments.find((t) => t.id === view.id) ?? null
        : null,
    [view, tournaments.tournaments],
  );

  // Legacy data (pre-community) has no communityId: adopt it into the active community.
  useEffect(() => {
    if (!activeCommunity) return;
    for (const p of roster.players) {
      if (!p.communityId || !communities.communities.some((c) => c.id === p.communityId)) {
        void roster.savePlayer({ ...p, communityId: activeCommunity.id });
      }
    }
    for (const s of sessions.sessions) {
      if (!s.communityId || !communities.communities.some((c) => c.id === s.communityId)) {
        void sessionStore.saveSession({ ...s, communityId: activeCommunity.id });
      }
    }
  }, [activeCommunity, communities.communities, roster.players, sessions.sessions, roster, sessionStore]);

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

  const handleExport = async () => {
    const allSessions = await sessionStore.listSessions();
    const blob = new Blob(
      [serializeBackup(roster.players, allSessions, communities.communities, tournaments.tournaments, savedSquads.squads)],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `comp3tive-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (file: File) => {
    let data;
    try {
      data = parseBackup(await file.text(), disciplines);
    } catch (err) {
      notify(`Import failed: ${formatError(err)}`, "error");
      return;
    }
    // Merge with existing data: add only new ids, never overwrite.
    const existingCommunityIds = new Set(communities.communities.map((c) => c.id));
    const existingPlayerIds = new Set(roster.players.map((p) => p.id));
    const existingSessionIds = new Set(sessions.sessions.map((s) => s.id));
    const existingTournamentIds = new Set(tournaments.tournaments.map((t) => t.id));
    const existingSquadIds = new Set(savedSquads.squads.map((q) => q.id));
    const newCommunities = data.communities.filter((c) => !existingCommunityIds.has(c.id));
    const newPlayers = data.players.filter((p) => !existingPlayerIds.has(p.id));
    const newSessions = data.sessions.filter((s) => !existingSessionIds.has(s.id));
    const newTournaments = (data.tournaments ?? []).filter((t) => !existingTournamentIds.has(t.id));
    const newSquads = (data.savedSquads ?? []).filter((q) => !existingSquadIds.has(q.id));
    const totalNew =
      newCommunities.length + newPlayers.length + newSessions.length + newTournaments.length + newSquads.length;
    if (
      totalNew === 0 ||
      !window.confirm(
        `Import ${newCommunities.length} new communit${newCommunities.length === 1 ? "y" : "ies"}, ${newPlayers.length} new player${newPlayers.length === 1 ? "" : "s"}, ${newSessions.length} session${newSessions.length === 1 ? "" : "s"}, ${newTournaments.length} tournament${newTournaments.length === 1 ? "" : "s"} and ${newSquads.length} saved squad${newSquads.length === 1 ? "" : "s"}? (Existing records with the same id are kept.)`,
      )
    ) {
      return;
    }
    // parseBackup has already resolved every communityId — including adopting a
    // record whose id is missing or unknown (the v1 case) into the first
    // community — so each imported record keeps its own.
    for (const c of newCommunities) await communityStore.saveCommunity(c);
    // The hooks hold their own copies of the store's lists, and handleImport
    // writes through the stores, so nothing below is on screen until re-read:
    // an imported community would be absent from the dropdown and its records
    // invisible. Communities come first, before the records whose communityId
    // they explain — a player whose community is not yet in hook state is
    // re-homed by the orphan-adoption effect above.
    await communities.refresh();
    for (const p of newPlayers) await roster.savePlayer(p);
    for (const s of newSessions) await sessionStore.saveSession(s);
    for (const t of newTournaments) await tournamentStore.saveTournament(t);
    for (const q of newSquads) await squadStore.saveSavedSquad(q);
    await roster.refresh();
    await sessions.refresh();
    await tournaments.refresh();
    await savedSquads.refresh();
  };

  const createCommunity = async () => {
    if (!communityName.trim()) return;
    await communities.create(communityName.trim());
    setCommunityName("");
    setShowAddCommunity(false);
  };

  const cancelAddCommunity = () => {
    setCommunityName("");
    setShowAddCommunity(false);
  };

  const savePlayer = async (player: Player) => {
    await roster.savePlayer(player);
  };

  const deletePlayer = async (id: Id) => {
    try {
      await roster.deletePlayer(id);
    } catch (err) {
      notify(`Could not delete the player: ${formatError(err)}`, "error");
    }
  };

  const saveDiscipline = async (d: Discipline) => {
    try {
      await catalog.saveDiscipline(d);
    } catch (err) {
      notify(`Could not save discipline: ${formatError(err)}`, "error");
      throw err;
    }
  };

  const deleteDiscipline = async (id: Id) => {
    try {
      await catalog.deleteDiscipline(id);
    } catch (err) {
      notify(`Could not delete discipline: ${formatError(err)}`, "error");
      throw err;
    }
  };
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const downloadSampleData = async (disciplineId: Id) => {
    setDownloadingId(disciplineId);
    try {
      const { downloadSampleData: download } = await import("./data/sample-data");
      download(disciplineId);
    } catch {
      notify("Could not download sample data", "error");
    } finally {
      setDownloadingId(null);
    }
  };
  const handlePlayerImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
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
          await handleImport(file);
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
            await roster.savePlayer(player);
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
      const { players: imported, skipped: unresolved } = csvRowsToPlayers(rows, disciplines, activeCommunity.id);
      for (const player of imported) await roster.savePlayer(player);
      const skipped = [...unparsed, ...unresolved].sort((a, b) => a.line - b.line);
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
  };

  const deleteCommunity = async (id: Id) => {
    if (communities.communities.length <= 1) {
      notify("You need at least one community.", "error");
      return;
    }
    const counts = await communities.remove(id);
    const parts = [
      counts.players && `${counts.players} player${counts.players === 1 ? "" : "s"}`,
      counts.sessions && `${counts.sessions} session${counts.sessions === 1 ? "" : "s"}`,
      counts.squads && `${counts.squads} saved squad${counts.squads === 1 ? "" : "s"}`,
      counts.tournaments && `${counts.tournaments} tournament${counts.tournaments === 1 ? "" : "s"}`,
    ].filter(Boolean);
    notify(
      parts.length > 0 ? `Community deleted, along with ${parts.join(", ")}.` : "Community deleted.",
      "success",
    );
  };

  /** A truthful description of what deleting this community will take with it. */
  const communityDeleteWarning = (communityId: Id): string => {
    const playerCount = roster.players.filter((p) => p.communityId === communityId).length;
    const sessionCount = sessions.sessions.filter((s) => s.communityId === communityId).length;
    const squadCount = savedSquads.squads.filter((q) => q.communityId === communityId).length;
    const tournamentCount = tournaments.tournaments.filter((t) => t.communityId === communityId).length;
    const parts = [
      playerCount && `${playerCount} player${playerCount === 1 ? "" : "s"}`,
      sessionCount && `${sessionCount} session${sessionCount === 1 ? "" : "s"}`,
      squadCount && `${squadCount} saved squad${squadCount === 1 ? "" : "s"}`,
      tournamentCount && `${tournamentCount} tournament${tournamentCount === 1 ? "" : "s"}`,
    ].filter(Boolean);
    return parts.length > 0 ? ` This also permanently deletes ${parts.join(", ")}.` : "";
  };

  const randomPlayers = () => {
    startMatch("ad-hoc");
  };

  const filtersByDiscipline = (disciplineId: Id) => {
    setFilterIds(prev => prev.includes(disciplineId) ? prev.filter(id => id !== disciplineId) : [...prev, disciplineId]);
  };

  const clearFilters = () => {
    setFilterIds([]);
  };

  // Dashboard actions (ticket 04): every exit reuses an existing App flow —
  // the roster "Split match" handler, the Games create flow, hub navigation,
  // and the roster "+ Add Player" modal. Only the entry points differ.
  const showSquads = () => {
    gotoHub("squads");
  };

  const addPlayer = () => {
    gotoHub("roster");
    setEditingPlayer("new");
  };

  const startAdHocSplit = () => {
    if (view.mode === "tournament" && viewTournament) {
      startMatch("tournament", viewTournament.id);
      return;
    }
    startMatch("ad-hoc");
  };

  const openNewTournament = () => {
    setTournamentPrefill({ disciplineId: "", teamCount: 0 });
    gotoHub("games");
  };

  const openTournament = (id: Id) => {
    pushView({ mode: "tournament", id });
  };

  const startSplit = () => {
    if (view.mode === "tournament" && viewTournament) {
      startMatch("tournament", viewTournament.id);
      return;
    }
    startMatch("ad-hoc");
  };

  const deleteTournament = async (id: Id) => {
    try {
      await tournaments.deleteTournament(id);
    } catch (err) {
      notify(`Could not delete the tournament: ${formatError(err)}`, "error");
    }
  };

  const deleteTournamentFromUI = async (id: Id) => {
    await deleteTournament(id);
    if (view.mode === "tournament" && view.id === id) {
      gotoHub("games");
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
        onDeleteCommunity={deleteCommunity}
        communityDeleteWarning={communityDeleteWarning}
        showAddCommunity={showAddCommunity}
        onToggleAddCommunity={() => setShowAddCommunity((s) => !s)}
        themePref={themePref}
        layoutPref={layoutPref}
        onThemeChange={setThemePref}
        onLayoutChange={setLayoutPref}
        toasts={toasts}
      >
        {loadError && (
          <div className="load-error" role="alert">
            <strong>Couldn&apos;t load your saved data.</strong> {loadError} Reload the page to try again.
          </div>
        )}
        {showAddCommunity && (
          <div className="add-community">
            <div className="form-label">New community</div>
            <div className="form-row">
              <input
                type="text"
                value={communityName}
                onChange={(e) => setCommunityName(e.target.value)}
                placeholder="e.g. Sunday League"
                onKeyDown={(e) => {
                  if (e.key === "Enter") createCommunity();
                  if (e.key === "Escape") cancelAddCommunity();
                }}
                autoFocus
              />
              <button className="btn btn-primary" onClick={createCommunity}>Create</button>
              <button className="btn btn-ghost" onClick={cancelAddCommunity} aria-label="Cancel">Cancel</button>
            </div>
          </div>
        )}
        {communities.loading && <p className="status">Loading&hellip;</p>}
        {!communities.loading && communities.communities.length === 0 && !showAddCommunity && (
          <div className="empty">
            <div className="kicker">First whistle</div>
            <div className="big">No communities yet</div>
            <p>Use ✚ in the topbar to create your first community.</p>
          </div>
        )}

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
          />
        )}
        {view.mode === "roster" && (
          <RosterScreen
            activeCommunity={activeCommunity}
            disciplines={disciplines}
            players={communityPlayers}
            visiblePlayers={visiblePlayers}
            filterIds={filterIds}
            disciplinesById={disciplinesById}
            editingPlayer={editingPlayer}
            fileInputRef={fileInputRef}
            onToggleFilter={filtersByDiscipline}
            onClearFilters={clearFilters}
            onAddPlayer={() => setEditingPlayer("new")}
            onOpenPlayer={(player) => setEditingPlayer(player)}
            onImportFile={handlePlayerImport}
            onExport={handleExport}
            onSplitMatch={randomPlayers}
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
          />
        )}
        {view.mode === "history" && (
          <HistoryScreen
            sessions={communitySessions}
            loading={sessions.loading}
            disciplines={disciplines}
            onReopen={openSession}
            onDelete={async (id) => {
              try {
                await sessions.deleteSession(id);
              } catch (err) {
                notify(`Could not delete the session: ${formatError(err)}`, "error");
              }
            }}
          />
        )}

        {view.mode === "squads" && (
          <SquadsScreen
            squads={communitySquads}
            loading={savedSquads.loading}
            disciplines={disciplines}
            roster={communityPlayers}
            onBack={() => goBack()}
            onReSplit={reSplitSquad}
            onNewTournament={newTournamentFromSquad}
            onDelete={async (id) => { await savedSquads.deleteSquad(id); }}
          />
        )}

        {view.mode === "disciplines" && (
          <DisciplinesScreen
            disciplines={disciplines}
            loading={catalog.loading}
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
      </AppChrome>
    </div>
  );
}
