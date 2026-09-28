import { useState } from "react";
import type {
  Discipline,
  GameResult,
  Id,
  Player,
  SavedSquad,
  Session,
  SplitResult,
  TeamAssignment,
  Tournament,
  TournamentFormat,
  SeriesLength,
} from "../domain/types";
import type { SessionStore } from "../storage/types";
import { buildBracket, applyResult, undoLastGame } from "../tournament/bracket";
import { fairSplit, buildSettings, suggestTeamCount, poolFromPlayers } from "../solver/solver";
import { capabilityFor, teamName } from "../session/flow";
import { formatError } from "../ui/format";
import { validateTournamentSpec } from "../tournament/tournament-validation";
import type { HubMode, View } from "./useNavigation";
import type { ToastType } from "./useToasts";

export type SplitSource = "ad-hoc" | "tournament" | "session" | "squad";

/**
 * Whether a mutation in the split flow persists, by source (FLOW §2 rules 3–4,
 * ADR-0004). One SplitScreen serves four entry points and this is the only
 * statement of how they differ.
 */
export function splitFlowRule(source: SplitSource): {
  persistsSession: boolean;
  submitsTournament: boolean;
  isSynthetic: boolean;
} {
  return {
    persistsSession: source === "ad-hoc",
    submitsTournament: source === "tournament",
    isSynthetic: source === "session" || source === "squad",
  };
}

/**
 * The pool a re-roll draws from. A stored pool always wins — it is the
 * session's own pool, and re-rolling must let a player who sat out back in.
 * `source` says whether a stored pool is *expected*: only a synthetic source
 * (session | squad) re-splits a stored record whose pool is the teams on
 * screen. A live split (ad-hoc | tournament) always carries
 * `session.poolPlayerIds`, so an empty pool there means no pool.
 */
export function rerollPool(
  source: SplitSource,
  sessionPoolPlayerIds: Id[] | null,
  currentTeams: TeamAssignment[],
): Id[] {
  if (sessionPoolPlayerIds && sessionPoolPlayerIds.length > 0) return sessionPoolPlayerIds;
  if (splitFlowRule(source).isSynthetic) {
    return currentTeams.flatMap((t) => t.slots.map((s) => s.playerId));
  }
  return [];
}

const toggleId = (ids: Id[], id: Id): Id[] =>
  ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];

/** The match-setup screen's draft. `SplitFlowResult` puts it in its public
 *  surface, so a consumer has to be able to name the type. */
export interface MatchSetup {
  disciplineId: Id;
  selectedIds: Id[];
  teamCount: number;
  tournamentId: Id | null;
  source: SplitSource;
}

export interface SplitFlowDeps {
  disciplines: Discipline[];
  disciplinesById: Map<Id, Discipline>;
  players: Player[];
  tournaments: Tournament[];
  viewTournament: Tournament | null;
  /** `split()` reads the live view to name the split it is about to push. */
  view: View;
  activeCommunityId: Id | null;
  sessionStore: SessionStore;
  saveTournament: (t: Tournament) => Promise<void>;
  saveSquad: (s: SavedSquad) => Promise<void>;
  notify: (text: string, type?: ToastType) => void;
  pushView: (v: View) => void;
  resetTo: (v: View) => void;
  setTournamentPrefill: (p: { disciplineId: Id; teamCount: number } | null) => void;
}

export interface SplitFlowResult {
  setup: MatchSetup | null;
  activeSplit: { session: Session; source: SplitSource } | null;
  /** A hub replaces the stack and drops a half-finished match setup. */
  gotoHub: (mode: HubMode) => void;
  startMatch: (source: SplitSource, tournamentId?: Id) => void;
  openSession: (session: Session) => void;
  togglePlayer: (id: Id) => void;
  selectDiscipline: (id: Id) => void;
  changeTeamCount: (n: number) => void;
  split: () => Promise<void>;
  consumeTeams: (tournamentId: Id, teams: TeamAssignment[]) => Promise<void>;
  recordResult: (matchId: Id, games: GameResult[]) => Promise<void>;
  undoLastResult: () => Promise<void>;
  createTournament: (spec: {
    name: string;
    disciplineId: Id;
    format: TournamentFormat;
    seriesLength: SeriesLength;
    teamCount: number;
    thirdPlace?: boolean;
  }) => Promise<void>;
  saveSquadFromSplit: (name: string, result: SplitResult, disciplineId: Id) => Promise<void>;
  reSplitSquad: (squad: SavedSquad) => void;
  useSquadInTournament: (squad: SavedSquad, tournamentId: Id) => Promise<void>;
  newTournamentFromSquad: (squad: SavedSquad) => void;
}

/**
 * The split and tournament flow: every handler that turns a roster into teams,
 * seeds a bracket, or records a result. It owns `setup` and `activeSplit`
 * because the handlers that write them are here, and it re-derives nothing —
 * navigation primitives, store handles and the scoped lists all arrive as deps.
 */
export function useSplitFlow(deps: SplitFlowDeps): SplitFlowResult {
  const {
    disciplines,
    disciplinesById,
    players,
    tournaments,
    viewTournament,
    view,
    activeCommunityId,
    sessionStore,
    saveTournament,
    saveSquad,
    notify,
    pushView,
    resetTo,
    setTournamentPrefill,
  } = deps;
  const [setup, setSetup] = useState<MatchSetup | null>(null);
  const [activeSplit, setActiveSplit] = useState<{ session: Session; source: SplitSource } | null>(null);

  /** A hub replaces the whole stack; the navigation hook owns the stack alone,
   *  so dropping a half-finished match setup lives beside the setup state. */
  const gotoHub = (mode: HubMode) => { resetTo({ mode }); setSetup(null); };

  /** Land on a tournament with the Games hub beneath it, so Back and the
   *  breadcrumb return to Games (FLOW P2). Two calls, not one: the frozen hook
   *  has no atomic replace, so they must stay adjacent — `resetTo` is an absolute
   *  set and `pushView` a functional update, which is what keeps the pair correct
   *  across an intervening render. Never `await` between them. */
  const openTournamentOverGames = (id: Id) => { resetTo({ mode: "games" }); pushView({ mode: "tournament", id }); };

  const startMatch = (source: SplitSource, tournamentId?: Id) => {
    if (source !== "tournament" && (disciplines.length === 0 || players.length === 0)) return;
    const tournament = tournamentId
      ? tournaments.find((t) => t.id === tournamentId) ?? null
      : null;
    let disciplineId = tournament?.disciplineId ?? disciplines[0].id;
    if (!tournament) {
      // Default to the discipline the most present players can actually play.
      let best = disciplines[0];
      let bestCount = -1;
      for (const d of disciplines) {
        const n = players.filter((p) => capabilityFor(p, d)).length;
        if (n > bestCount) {
          bestCount = n;
          best = d;
        }
      }
      disciplineId = best.id;
    }
    const discipline = disciplines.find((d) => d.id === disciplineId) ?? disciplines[0];
    const eligible = players.filter((p) => capabilityFor(p, discipline));
    setSetup({
      disciplineId,
      selectedIds: players.map((p) => p.id),
      teamCount: tournament?.teamCount ?? suggestTeamCount(eligible.length, discipline),
      tournamentId: tournamentId ?? null,
      source,
    });
    pushView({ mode: "match", source });
  };

  const openSession = (session: Session) => {
    setActiveSplit({ session, source: "session" });
    pushView({ mode: "split", source: "session" });
  };

  const togglePlayer = (id: Id) => {
    setSetup((s) => (s ? { ...s, selectedIds: toggleId(s.selectedIds, id) } : s));
  };

  const selectDiscipline = (id: Id) => {
    setSetup((s) => {
      if (!s || s.disciplineId === id) return s;
      const discipline = disciplinesById.get(id);
      if (!discipline) return s;
      const pool = players.filter((p) => s.selectedIds.includes(p.id) && capabilityFor(p, discipline));
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
    const selected = players.filter((p) => setup.selectedIds.includes(p.id));
    const pool = poolFromPlayers(selected, discipline);
    if (pool.length === 0) return;

    const result = fairSplit(pool, discipline, buildSettings(discipline, setup.teamCount));
    const session: Session = {
      id: crypto.randomUUID(),
      communityId: activeCommunityId ?? "",
      disciplineId: discipline.id,
      createdAt: Date.now(),
      poolPlayerIds: pool.map((p) => p.playerId),
      settings: { teamCount: setup.teamCount },
      result,
    };
    // Persistence rules (FLOW): ad-hoc splits save a Session; tournament splits
    // persist via the bracket only; session/squad re-splits are synthetic.
    if (splitFlowRule(setup.source).persistsSession) {
      try {
        await sessionStore.saveSession(session);
      } catch {
        // Non-fatal: still show the split if persistence failed.
      }
    }
    const source = view.mode === "match" ? view.source : "ad-hoc" as SplitSource;
    setActiveSplit({ session, source });
    pushView({ mode: "split", source });
  };

  const consumeTeams = async (tournamentId: Id, teams: TeamAssignment[]) => {
    const tournament = tournaments.find((t) => t.id === tournamentId);
    if (!tournament) {
      notify("Could not save: the tournament is no longer in this community's list.", "error");
      return;
    }
    // A bracket needs a team count its format supports (single elim: 2/4/8;
    // series: 2; swiss: even). Guard before building so a mismatch is a clear
    // message, not a crash inside buildBracket.
    const n = teams.length;
    const bracketOk =
      tournament.format === "swiss" ? n >= 2 && n % 2 === 0
      : tournament.format === "single-elim" ? (n === 2 || n === 4 || n === 8)
      : n === 2; // series
    if (!bracketOk) {
      notify(`Could not save: a ${tournament.format} bracket needs a supported number of teams (got ${n}).`, "error");
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
    try {
      const built = buildBracket(next);
      await saveTournament(built);
      openTournamentOverGames(built.id);
      setSetup(null);
    } catch (err) {
      notify(`Could not save the tournament teams: ${formatError(err)}`, "error");
    }
  };

  const recordResult = async (matchId: Id, games: GameResult[]) => {
    if (!viewTournament) return;
    const next = applyResult(viewTournament, matchId, games);
    await saveTournament(next);
  };

  const undoLastResult = async () => {
    if (!viewTournament) return;
    const next = undoLastGame(viewTournament);
    await saveTournament(next);
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
      communityId: activeCommunityId ?? "",
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
    await saveTournament(tournament);
    openTournamentOverGames(tournament.id);
    setSetup(null);
  };

  const saveSquadFromSplit = async (name: string, result: SplitResult, disciplineId: Id) => {
    if (!activeCommunityId) return;
    const poolPlayerIds = result.teams.flatMap((t) => t.slots.map((s) => s.playerId));
    const squad: SavedSquad = {
      id: crypto.randomUUID(),
      communityId: activeCommunityId,
      name,
      disciplineId,
      createdAt: Date.now(),
      poolPlayerIds,
      settings: { teamCount: result.teams.length },
      result,
    };
    await saveSquad(squad);
  };

  const reSplitSquad = (squad: SavedSquad) => {
    const synthetic: Session = {
      id: `squad-${squad.id}`,
      communityId: activeCommunityId ?? "",
      disciplineId: squad.disciplineId,
      createdAt: Date.now(),
      poolPlayerIds: squad.poolPlayerIds,
      settings: squad.settings,
      result: squad.result,
    };
    setSetup(null);
    setActiveSplit({ session: synthetic, source: "squad" });
    pushView({ mode: "split", source: "squad" });
  };

  const useSquadInTournament = async (squad: SavedSquad, tournamentId: Id) => {
    consumeTeams(tournamentId, squad.result.teams);
  };

  const newTournamentFromSquad = (squad: SavedSquad) => {
    setTournamentPrefill({ disciplineId: squad.disciplineId, teamCount: squad.result.teams.length });
    gotoHub("games");
  };

  return {
    setup,
    activeSplit,
    gotoHub,
    startMatch,
    openSession,
    togglePlayer,
    selectDiscipline,
    changeTeamCount,
    split,
    consumeTeams,
    recordResult,
    undoLastResult,
    createTournament,
    saveSquadFromSplit,
    reSplitSquad,
    useSquadInTournament,
    newTournamentFromSquad,
  };
}
