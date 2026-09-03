import { useEffect, useRef, useState } from "react";
import {
  computeStrength,
  type Capability,
  type Community,
  type Discipline,
  type GameResult,
  type Id,
  type Player,
  type Session,
  type TeamAssignment,
  type Tournament,
  type TournamentFormat,
  type SeriesLength,
} from "./domain";
import {
  createIndexedDbCommunityStore,
  createIndexedDbRosterStore,
  createIndexedDbSessionStore,
  createIndexedDbDisciplineStore,
  createIndexedDbTournamentStore,
} from "./storage";
import { useRoster } from "./roster/useRoster";
import { useDisciplines } from "./domain/useDisciplines";
import { useCommunities } from "./domain/useCommunities";
import { DisciplinesScreen } from "./domain/DisciplinesScreen";
import { DisciplineEditModal } from "./domain/DisciplineEditModal";
import { PlayerEditModal } from "./roster/PlayerEditModal";
import { fairSplit, buildSettings, suggestTeamCount, poolFromPlayers } from "./solver/solver";
import { MatchScreen } from "./session/MatchScreen";
import { SplitScreen } from "./session/SplitScreen";
import { HistoryScreen } from "./session/HistoryScreen";
import { useSessions } from "./session/useSessions";
import { capabilityFor, teamName } from "./session/flow";
import { useTournaments } from "./tournament/useTournaments";
import { GamesScreen } from "./tournament/GamesScreen";
import { TournamentScreen } from "./tournament/TournamentScreen";
import { buildBracket, applyResult, undoLastGame } from "./tournament/bracket";
import { serializeBackup, parseBackup } from "./data/transfer";
import { validateTeamParticipation } from "./tournament/team-participation-validator";
import { validateTournamentSpec } from "./tournament/tournament-validation";
const communityStore = createIndexedDbCommunityStore();
const rosterStore = createIndexedDbRosterStore();
const sessionStore = createIndexedDbSessionStore();
const disciplineStore = createIndexedDbDisciplineStore();
const tournamentStore = createIndexedDbTournamentStore();

type View =
  | { mode: "roster" }
  | { mode: "form"; player: Player | null }
  | { mode: "community" }
  | { mode: "games" }
  | { mode: "tournament"; id: Id }
  | { mode: "match" }
  | { mode: "split"; session: Session }
  | { mode: "history" }
  | { mode: "disciplines" };

interface MatchSetup {
  disciplineId: Id;
  selectedIds: Id[];
  teamCount: number;
  tournamentId: Id | null;
}

const toggleId = (ids: Id[], id: Id): Id[] =>
  ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];

/** Persisted preference (theme, layout) with a localStorage fallback. */
function useStoredPref(key: string, initial: string) {
  const [value, setValue] = useState<string>(() => {
    try {
      return localStorage.getItem(key) ?? initial;
    } catch {
      return initial;
    }
  });
  const set = (v: string) => {
    setValue(v);
    try {
      localStorage.setItem(key, v);
    } catch {
      /* ignore */
    }
  };
  return [value, set] as const;
}

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

function strengthsFor(player: Player, disciplines: Discipline[]) {
  return disciplines.flatMap((d) => {
    const cap = player.capabilities.find((c) => c.disciplineId === d.id);
    return cap ? [{ id: d.id, shortName: d.shortName, strength: computeStrength(d, cap) }] : [];
  });
}

const badgeClass = (disciplineId: string) =>
  disciplineId === "futsal" || disciplineId === "mlbb" ? `badge--${disciplineId}` : "badge--generic";

export default function App() {
  const roster = useRoster(rosterStore);
  const sessions = useSessions(sessionStore);
  const catalog = useDisciplines(disciplineStore);
  const communities = useCommunities(communityStore, rosterStore, sessionStore);
  const tournaments = useTournaments(tournamentStore);
  const [view, setView] = useState<View>({ mode: "roster" });
  const [setup, setSetup] = useState<MatchSetup | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [justCleared, setJustCleared] = useState(false);
  const [filterIds, setFilterIds] = useState<string[]>([]);
  const [randomDisciplines, setRandomDisciplines] = useState<string[]>([]);
  const [randomPreview, setRandomPreview] = useState<Player | null>(null);
  const [communityName, setCommunityName] = useState("");
  const [showAddCommunity, setShowAddCommunity] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null | "new">(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [themePref, setThemePref] = useStoredPref("tb-theme", "auto");
  const [layoutPref, setLayoutPref] = useStoredPref("tb-layout", "auto");
  const systemDark = useMediaQuery("(prefers-color-scheme: dark)");
  const isWide = useMediaQuery("(min-width: 768px)");
  const effectiveTheme: "light" | "dark" =
    themePref === "auto" ? (systemDark ? "dark" : "light") : (themePref as "light" | "dark");
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
  const disciplinesById = new Map(disciplines.map((d) => [d.id, d]));
  const activeCommunity: Community | null =
    communities.communities.find((c) => c.id === communities.activeId) ?? null;
  const communityPlayers = activeCommunity
    ? roster.players.filter((p) => p.communityId === activeCommunity.id)
    : [];
  const visiblePlayers = filterIds.length === 0
    ? communityPlayers
    : communityPlayers.filter((p) => p.capabilities.some((c) => filterIds.includes(c.disciplineId)));
  const viewTournament =
    view.mode === "tournament" ? tournaments.tournaments.find((t) => t.id === view.id) ?? null : null;

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

  const startMatch = (tournamentId: Id | null = null) => {
    if (disciplines.length === 0 || communityPlayers.length === 0) return;
    const tournament = tournamentId
      ? tournaments.tournaments.find((t) => t.id === tournamentId) ?? null
      : null;
    let disciplineId = tournament?.disciplineId ?? disciplines[0].id;
    if (!tournament) {
      // Default to the discipline the most present players can actually play.
      let best = disciplines[0];
      let bestCount = -1;
      for (const d of disciplines) {
        const n = communityPlayers.filter((p) => capabilityFor(p, d)).length;
        if (n > bestCount) {
          bestCount = n;
          best = d;
        }
      }
      disciplineId = best.id;
    }
    const discipline = disciplines.find((d) => d.id === disciplineId) ?? disciplines[0];
    const eligible = communityPlayers.filter((p) => capabilityFor(p, discipline));
    setSetup({
      disciplineId,
      selectedIds: communityPlayers.map((p) => p.id),
      teamCount: tournament?.teamCount ?? suggestTeamCount(eligible.length, discipline),
      tournamentId,
    });
    setView({ mode: "match" });
  };

  const togglePlayer = (id: Id) => {
    setSetup((s) => (s ? { ...s, selectedIds: toggleId(s.selectedIds, id) } : s));
  };

  const selectDiscipline = (id: Id) => {
    setSetup((s) => {
      if (!s || s.disciplineId === id) return s;
      const discipline = disciplinesById.get(id);
      if (!discipline) return s;
      const pool = communityPlayers.filter((p) => s.selectedIds.includes(p.id) && capabilityFor(p, discipline));
      return { ...s, disciplineId: id, teamCount: suggestTeamCount(pool.length, discipline) };
    });
  };

  const changeTeamCount = (n: number) => {
    setSetup((s) => (s ? { ...s, teamCount: Math.max(1, Math.min(n, 8)) } : s));
  };

  const split = async () => {
    if (!setup) return;
    const discipline = disciplinesById.get(setup.disciplineId);
    if (!discipline) return;
    const selected = communityPlayers.filter((p) => setup.selectedIds.includes(p.id));
    const pool = poolFromPlayers(selected, discipline);
    if (pool.length === 0) return;

    const result = fairSplit(pool, discipline, buildSettings(discipline, setup.teamCount));
    const session: Session = {
      id: crypto.randomUUID(),
      communityId: activeCommunity?.id ?? "",
      disciplineId: discipline.id,
      createdAt: Date.now(),
      poolPlayerIds: pool.map((p) => p.playerId),
      settings: { teamCount: setup.teamCount },
      result,
    };
    if (!setup.tournamentId) {
      try {
        await sessionStore.saveSession(session);
      } catch {
        // Non-fatal: still show the split if persistence failed.
      }
    }
    setView({ mode: "split", session });
  };

  const submitTeams = (teams: TeamAssignment[]) => {
    if (!setup?.tournamentId || !activeCommunity) return;
    const tournament = tournaments.tournaments.find((t) => t.id === setup.tournamentId);
    if (!tournament) return;
    const discipline = disciplinesById.get(tournament.disciplineId);
    if (!discipline) return;
    
    // Get the session for this tournament's discipline
    const session = sessions.sessions.find(s => s.disciplineId === tournament.disciplineId);
    if (!session) return;
    
    // Validate teams before submission
    const validation = validateTeamParticipation(
      tournament,
      session,
      {
        teams,
        gap: 0, // Will be calculated from actual teams
        flags: [],
        unassigned: [],
        solver: { optimal: true, nodesExplored: 0, elapsedMs: 0 }
      },
      discipline
    );
    
    if (validation.length > 0) {
      // Show validation errors to user
      console.error("Team validation failed:", validation);
      alert(`Validation failed: ${validation.map(v => v.message).join('\n')}`);
      return;
    }
    
    const seeded = [...teams].sort((a, b) => b.avgStrength - a.avgStrength);
    const next: Tournament = {
      ...tournament,
      teams: seeded.map((t, i) => ({
        id: `team-${i + 1}`,
        bibIndex: t.index,
        name: teamName(t.index),
        strength: t.avgStrength,
        players: t.slots.map((s) => s.playerId),
      })),
    };
    const built = buildBracket(next);
    void tournaments.saveTournament(built).then(() => setView({ mode: "tournament", id: built.id }));
  };

  const recordResult = async (matchId: Id, games: GameResult[]) => {
    if (!viewTournament) return;
    const next = applyResult(viewTournament, matchId, games);
    await tournaments.saveTournament(next);
  };

  const undoLastResult = async () => {
    if (!viewTournament) return;
    const next = undoLastGame(viewTournament);
    await tournaments.saveTournament(next);
  };


  const reopenSession = (s: Session) => {
    setSetup({
      disciplineId: s.disciplineId,
      selectedIds: s.poolPlayerIds,
      teamCount: s.settings.teamCount,
      tournamentId: null,
    });
    setView({ mode: "match" });
  };

  const handleExport = async () => {
    const allSessions = await sessionStore.listSessions();
    const blob = new Blob(
      [serializeBackup(roster.players, allSessions, communities.communities, tournaments.tournaments)],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `team-builder-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (file: File) => {
    let data;
    try {
      data = parseBackup(await file.text());
    } catch (err) {
      setImportError(err instanceof Error ? err.message : String(err));
      return;
    }
    // Merge with existing data: add only new ids, never overwrite.
    const existingCommunityIds = new Set(communities.communities.map((c) => c.id));
    const existingPlayerIds = new Set(roster.players.map((p) => p.id));
    const existingSessionIds = new Set(sessions.sessions.map((s) => s.id));
    const existingTournamentIds = new Set(tournaments.tournaments.map((t) => t.id));
    const newCommunities = data.communities.filter((c) => !existingCommunityIds.has(c.id));
    const newPlayers = data.players.filter((p) => !existingPlayerIds.has(p.id));
    const newSessions = data.sessions.filter((s) => !existingSessionIds.has(s.id));
    const newTournaments = (data.tournaments ?? []).filter((t) => !existingTournamentIds.has(t.id));
    const totalNew =
      newCommunities.length + newPlayers.length + newSessions.length + newTournaments.length;
    if (
      totalNew === 0 ||
      !window.confirm(
        `Import ${newCommunities.length} new communit${newCommunities.length === 1 ? "y" : "ies"}, ${newPlayers.length} new player${newPlayers.length === 1 ? "" : "s"}, ${newSessions.length} session${newSessions.length === 1 ? "" : "s"} and ${newTournaments.length} tournament${newTournaments.length === 1 ? "" : "s"}? (Existing records with the same id are kept.)`,
      )
    ) {
      return;
    }
    // v1 backups (e.g. mpl-id-roster.json): adopt players into active community, not synthetic default.
    const importCommunityId = activeCommunity?.id ?? newCommunities[0]?.id ?? "community-default";
    for (const c of newCommunities) await communityStore.saveCommunity(c);
    for (const p of newPlayers) await roster.savePlayer({ ...p, communityId: importCommunityId });
    for (const s of newSessions) await sessionStore.saveSession(s);
    for (const t of newTournaments) await tournamentStore.saveTournament(t);
    setImportError(null);
  };

  const clearData = () => {
    setClearConfirm(true);
  };

  const confirmClear = async () => {
    await communityStore.replaceAllCommunities([]);
    await rosterStore.replaceAllPlayers([]);
    await sessionStore.replaceAllSessions([]);
    await tournamentStore.replaceAllTournaments([]);
    setClearConfirm(false);
    setJustCleared(true);
  };

  const cancelClear = () => {
    setClearConfirm(false);
  };

  const createCommunity = async () => {
    if (!communityName.trim()) return;
    const community: Community = {
      id: crypto.randomUUID(),
      name: communityName.trim(),
      createdAt: Date.now(),
    };
    await communityStore.saveCommunity(community);
    setCommunityName("");
    setShowAddCommunity(false);
  };

  const savePlayer = async (player: Player) => {
    await roster.savePlayer(player);
  };

  const deletePlayer = async (id: Id) => {
    await rosterStore.deletePlayer(id);
  };

  const saveDiscipline = async (d: Discipline) => {
    await disciplineStore.saveDiscipline(d);
  };

  const deleteDiscipline = async (id: Id) => {
    await disciplineStore.deleteDiscipline(id);
  };
  const handlePlayerImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const trimmed = text.trim();

      // JSON branch
      if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        let parsed: unknown;
        try {
          parsed = JSON.parse(trimmed);
        } catch {
          alert("That file is not valid JSON.");
          return;
        }
        if (!parsed || typeof parsed !== "object") {
          alert("That JSON file does not contain a recognizable roster.");
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
            alert("Pick or create a community before importing a player file.");
            return;
          }
          let imported = 0;
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
            await roster.savePlayer(player);
            imported++;
          }
          alert(`Imported ${imported} player${imported === 1 ? "" : "s"} into ${activeCommunity.name}.`);
          return;
        }
        alert("That JSON file is not a recognized roster or backup.");
        return;
      }

      // CSV branch
      if (!activeCommunity) {
        alert("Pick or create a community before importing a CSV.");
        return;
      }
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      const startIdx = lines[0]?.toLowerCase().includes("name") ? 1 : 0;
      let imported = 0;
      for (let i = startIdx; i < lines.length; i++) {
        const parts = lines[i].split(",").map((p) => p.trim().replace(/^"|"$/g, ""));
        const name = parts[0];
        if (!name) continue;
        const disciplineShort = parts[1]?.toLowerCase() || "";
        const strength = parts[2] ? Number(parts[2]) : 3;
        const matchedDiscipline = disciplines.find(
          (d) => d.shortName.toLowerCase() === disciplineShort || d.name.toLowerCase() === disciplineShort,
        );
        const capability: Capability | null = matchedDiscipline
          ? {
              disciplineId: matchedDiscipline.id,
              attributeRatings: Object.fromEntries(
                matchedDiscipline.attributes.map((a) => [
                  a.id,
                  Math.max(1, Math.min(5, strength)) as 1 | 2 | 3 | 4 | 5,
                ]),
              ),
              eligibleRoles: matchedDiscipline.roles.map((r) => r.id),
              preferredRole: null,
            }
          : null;
        const player: Player = {
          id: crypto.randomUUID(),
          communityId: activeCommunity.id,
          name,
 capabilities: capability ? [capability] : [],
        };
        await roster.savePlayer(player);
        imported++;
      }
      alert(`Imported ${imported} player${imported === 1 ? "" : "s"}.`);
    } catch (err) {
      alert(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const deleteCommunity = async (id: Id) => {
    await communityStore.deleteCommunity(id);
  };

  const setActiveCommunity = (id: Id | null) => {
    if (id !== null) communities.setActiveId(id);
  };

  const randomPlayers = () => {
    const shuffled = [...communityPlayers].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, Math.min(5, shuffled.length));
    setSetup({
      disciplineId: disciplines[0].id,
      selectedIds: selected.map(p => p.id),
      teamCount: 2,
      tournamentId: null,
    });
    setView({ mode: "match" });
  };

  const randomizePreview = () => {
    if (communityPlayers.length === 0) return;
    const shuffled = [...communityPlayers].sort(() => Math.random() - 0.5);
    setRandomPreview(shuffled[0]);
  };

  const filtersByDiscipline = (disciplineId: Id) => {
    setFilterIds(prev => prev.includes(disciplineId) ? prev.filter(id => id !== disciplineId) : [...prev, disciplineId]);
  };

  const clearFilters = () => {
    setFilterIds([]);
  };

  const showHistory = () => {
    setView({ mode: "history" });
  };

  const goHome = () => {
    setView({ mode: "roster" });
  };

  const showDisciplines = () => {
    setView({ mode: "disciplines" });
  };

  const createTournament = async (spec: {

    name: string;
    disciplineId: Id;
    format: TournamentFormat;
    seriesLength: SeriesLength;
    teamCount: number;
    thirdPlace?: boolean;
  }) => {
    const discipline = disciplinesById.get(spec.disciplineId);
    if (!discipline) return;

    // Validate tournament specification
    const validation = validateTournamentSpec(spec, discipline);
    if (validation.length > 0) {
      console.error("Tournament validation failed:", validation);
      alert(`Validation failed: ${validation.map(v => v.message).join('\n')}`);
      return;
    }

    const tournament: Tournament = {
      id: crypto.randomUUID(),
      communityId: activeCommunity?.id ?? "",
      disciplineId: spec.disciplineId,
      name: spec.name,
      format: spec.format,
      seriesLength: spec.seriesLength,
      teamCount: spec.teamCount,
      thirdPlace: spec.thirdPlace ?? true,
      createdAt: Date.now(),
      status: "draft" as const,
      teams: [],
      matches: [],
    };
    await tournamentStore.saveTournament(tournament);
  };


  const openTournament = (id: Id) => {
    setView({ mode: "tournament", id });
  };

  const enterMatchFlow = (tournamentId: Id | null = null) => {
    startMatch(tournamentId);
  };

  const exitMatchFlow = () => {
    setView({ mode: "roster" });
    setSetup(null);
  };

  const startSplit = () => {
    if (!setup) return;
    split();
  };

  const finishSplit = (teams: TeamAssignment[]) => {
    if (!setup?.tournamentId) return;
    submitTeams(teams);
  };

  const recordTournamentResult = async (matchId: Id, games: GameResult[]) => {
    await recordResult(matchId, games);
  };
  const deleteTournament = async (id: Id) => {
    await tournamentStore.deleteTournament(id);
  };

  const deleteTournamentFromUI = async (id: Id) => {
    await deleteTournament(id);
  };
  const showTournamentView = (tournament: Tournament) => {
    setView({ mode: "tournament", id: tournament.id });
  };

  return (
    <div className="app" data-layout={effectiveLayout}>
      <header className="topbar-wrap topbar">
        <div className="wordmark">
          <span className="sq">●</span>
          <span>Team Builder</span>
        </div>
        <div className="squad-switcher">
          <span className="kicker">Community</span>
          <select
            value={activeCommunity?.id ?? ""}
            onChange={(e) => setActiveCommunity(e.target.value || null)}
            className="squad-select"
            aria-label="Active community"
          >
            <option value="">— No community —</option>
            {communities.communities.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <button
            type="button"
            className="icon-btn"
            aria-label="New community"
            title="New community"
            onClick={() => setShowAddCommunity((s) => !s)}
          >
            ✚
          </button>
          {activeCommunity && (
            <button
              type="button"
              className="icon-btn icon-btn-danger"
              aria-label={`Delete ${activeCommunity.name}`}
              title={`Delete ${activeCommunity.name}`}
              onClick={() => {
                if (window.confirm(`Delete "${activeCommunity.name}"? This removes the community, all its players, and history.`)) {
                  void deleteCommunity(activeCommunity.id);
                }
              }}
            >
              ✕
            </button>
          )}
        </div>
        <div className="settings-trigger">
          <button
            type="button"
            className="icon-btn"
            aria-label="Settings"
            title="Settings"
            onClick={() => setShowSettings((s) => !s)}
          >
            ⚙
          </button>
          {showSettings && (
            <div className="settings-popover" role="dialog" aria-label="Settings">
              <div className="settings-section">
                <div className="settings-label">Theme</div>
                <div className="settings-options">
                  <button type="button" className={`settings-chip ${themePref === "light" ? "active" : ""}`} onClick={() => setThemePref("light")}>Light</button>
                  <button type="button" className={`settings-chip ${themePref === "dark" ? "active" : ""}`} onClick={() => setThemePref("dark")}>Dark</button>
                  <button type="button" className={`settings-chip ${themePref === "auto" ? "active" : ""}`} onClick={() => setThemePref("auto")}>Auto</button>
                </div>
              </div>
              <div className="settings-section">
                <div className="settings-label">Layout</div>
                <div className="settings-options">
                  <button type="button" className={`settings-chip ${layoutPref === "auto" ? "active" : ""}`} onClick={() => setLayoutPref("auto")}>Auto</button>
                  <button type="button" className={`settings-chip ${layoutPref === "mobile" ? "active" : ""}`} onClick={() => setLayoutPref("mobile")}>Mobile</button>
                  <button type="button" className={`settings-chip ${layoutPref === "desktop" ? "active" : ""}`} onClick={() => setLayoutPref("desktop")}>Desktop</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </header>
      {view.mode === "roster" && (
        <div className="screen">
          <div className="kicker">Match Sheet · 01</div>
          <h1>Team Builder</h1>
          {activeCommunity && (
            <div className="lede">
              <strong>{activeCommunity.name}</strong> · {communityPlayers.length} player{communityPlayers.length === 1 ? "" : "s"} on the roster
            </div>
          )}



          {showAddCommunity && (
            <div className="add-community">
              <input
                type="text"
                value={communityName}
                onChange={(e) => setCommunityName(e.target.value)}
                placeholder="New community name"
                onKeyDown={(e) => e.key === "Enter" && createCommunity()}
                autoFocus
              />
              <button className="btn btn-primary" onClick={createCommunity}>Create</button>
            </div>
          )}
          {communities.communities.length === 0 && !showAddCommunity && (
            <div className="empty">
              <div className="kicker">First whistle</div>
              <div className="big">No communities yet</div>
              <p>Hit ✚ in the topbar to create your first community.</p>
            </div>
          )}
          
          {activeCommunity && (
            <>
              {/* Discipline filter chips */}
              {disciplines.length > 0 && (
                <div className="chips">
                  {disciplines.map((d) => (
                    <button
                      key={d.id}
                      className={`chip ${filterIds.includes(d.id) ? "active" : ""}`}
                      onClick={() => filtersByDiscipline(d.id)}
                    >
                      {d.shortName}
                    </button>
                  ))}
                </div>
              )}
              {filterIds.length > 0 && (
                <button className="btn btn-ghost" onClick={clearFilters}>Clear filters</button>
              )}
              
              {/* Player actions */}
              <div className="roster-toolbar">
                <button
                  className="btn btn-primary"
                  onClick={() => setEditingPlayer("new")}
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
                  onChange={handlePlayerImport}
                  style={{ display: "none" }}
                />
                <div className="roster-toolbar-spacer" />
                <button className="btn btn-ghost" onClick={handleExport}>
                  Export
                </button>
              </div>

              {editingPlayer !== null && activeCommunity && (
                <PlayerEditModal
                  player={editingPlayer === "new" ? null : editingPlayer}
                  disciplines={disciplines}
                  communityId={activeCommunity.id}
                  onClose={() => setEditingPlayer(null)}
                  onSave={async (p) => {
                    await savePlayer(p);
                    setEditingPlayer(null);
                  }}
                  onDelete={async (id) => {
                    await deletePlayer(id);
                    setEditingPlayer(null);
                  }}
                />
              )}
              
              {/* Player list */}
              {communityPlayers.length === 0 ? (
                <div className="empty">
                  <div className="kicker">Empty bench</div>
                  <div className="big">No players in this squad</div>
                  <p>Add the first player manually, or import a JSON / CSV roster.</p>
                  <button
                    className="btn btn-primary"
                    style={{ marginTop: 14 }}
                    onClick={() => setEditingPlayer("new")}
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
                    return (
                      <div
                        key={player.id}
                        className="row row-clickable"
                        style={{ "--stripe": bibVar } as React.CSSProperties}
                        onClick={() => setEditingPlayer(player)}
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
                    );
                  })}
                </div>
              )}

              <div className="cta-bar">
                <div className="cta-label">
                  Ready to play? <strong>Split the squad</strong> into two teams for a quick match.
                </div>
                <button
                  className="btn btn-primary"
                  onClick={randomPlayers}
                  disabled={!activeCommunity || communityPlayers.length === 0}
                >
                  Split match
                </button>
              </div>
            </>
          )}
        </div>
      )}
      {view.mode === "games" && (
        <GamesScreen
          tournaments={tournaments.tournaments}
          disciplines={disciplines}
          onCreate={createTournament}
          onOpen={openTournament}
          onDelete={deleteTournament}
        />
      )}
      {view.mode === "tournament" && viewTournament && (
        <TournamentScreen
          tournament={viewTournament}
          disciplines={disciplines}
          onBack={goHome}
          onSplit={startSplit}
          onRecord={async (matchId, games) => { await recordResult(matchId, games); }}
          onUndo={undoLastResult}
          onDelete={() => deleteTournamentFromUI(viewTournament.id)}
        />
      )}

      {view.mode === "split" && view.session && (
        <SplitScreen
          session={view.session}
          discipline={disciplines.find(d => d.id === view.session!.disciplineId) ?? disciplines[0]}
          roster={communityPlayers}
          onPersistResult={async (result) => {
            // Update session with new result
            const updatedSession = { ...view.session!, result };
            await sessionStore.saveSession(updatedSession);
          }}
        />
      )}

      {view.mode === "history" && (
        <HistoryScreen
          sessions={sessions.sessions}
          loading={sessions.loading}
          disciplines={disciplines}
          onReopen={(session) => setView({ mode: "split", session })}
          onDelete={async (id) => { await sessionStore.deleteSession(id); }}
        />
      )}

      {view.mode === "disciplines" && (
        <DisciplinesScreen
          disciplines={disciplines}
          loading={catalog.loading}
          onSave={async (d) => { await disciplineStore.saveDiscipline(d); }}
          onDelete={async (id) => { await disciplineStore.deleteDiscipline(id); }}
          onBack={goHome}
        />
      )}

      {view.mode === "match" && setup && (
        <MatchScreen
          roster={communityPlayers}
          disciplines={disciplines}
          disciplineId={setup.disciplineId}
          selectedIds={setup.selectedIds}
          teamCount={setup.teamCount}
          lockedDisciplineId={setup.tournamentId ? undefined : undefined}
          lockedTeamCount={setup.tournamentId ? undefined : undefined}
          onTogglePlayer={togglePlayer}
          onSelectDiscipline={selectDiscipline}
          onTeamCountChange={changeTeamCount}
          onSplit={split}
          onBack={goHome}
        />
      )}

      <nav className="bottom-nav" aria-label="Primary">
        <button className={`nav-link ${view.mode === "roster" ? "nav-active" : ""}`} onClick={goHome} aria-label="Roster">
          <span className="nav-icon" aria-hidden="true">◉</span>
          <span>Roster</span>
        </button>
        <button className={`nav-link ${view.mode === "games" ? "nav-active" : ""}`} onClick={() => setView({ mode: "games" })} aria-label="Games">
          <span className="nav-icon" aria-hidden="true">▣</span>
          <span>Games</span>
        </button>
        <button className={`nav-link ${view.mode === "history" ? "nav-active" : ""}`} onClick={showHistory} aria-label="History">
          <span className="nav-icon" aria-hidden="true">≡</span>
          <span>History</span>
        </button>
        <button className={`nav-link ${view.mode === "disciplines" ? "nav-active" : ""}`} onClick={showDisciplines} aria-label="Disciplines">
          <span className="nav-icon" aria-hidden="true">◇</span>
          <span>Squads</span>
        </button>
      </nav>
    </div>
  );
}
