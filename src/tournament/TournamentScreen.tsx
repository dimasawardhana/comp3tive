import { useState } from "react";
import type { Discipline, GameResult, Id, Player, SavedSquad, Tournament, TournamentMatch, TournamentTeam } from "../domain/types";
import { champion, standings } from "./bracket";
import { teamName } from "../session/flow";

interface Props {
  tournament: Tournament;
  disciplines: Discipline[];
  /** Draft-phase saved squads that match this tournament's discipline + team count. */
  matchingSquads?: SavedSquad[];
  onBack: () => void;
  onSplit: () => void; // draft: enter the match flow
  /** Consume a saved squad as this tournament's teams (snapshot into the bracket). */
  onUseSavedSquad?: (squad: SavedSquad) => Promise<void> | void;
  onRecord: (matchId: Id, games: GameResult[]) => Promise<void>;
  onUndo: () => Promise<void>;
  onDelete: () => Promise<void>;
  onReroll?: () => void; // optional: re-split from review screen
  /** Total community players (for pre-split eligible count preview). */
  totalPlayers?: number;
  /** Community roster: resolves player ids to names in review. */
  roster?: Player[];
}

const FORMAT_LABEL: Record<Tournament["format"], string> = {
  series: "Series",
  "single-elim": "Single elimination",
  swiss: "Swiss",
};

const BIB = ["a", "b", "c", "d", "e"];

function teamOf(t: Tournament, id: Id | null): TournamentTeam | null {
  return id ? t.teams.find((x) => x.id === id) ?? null : null;
}

function gameScore(m: TournamentMatch): string {
  if (!m.teamAId || !m.teamBId) return "";
  const a = m.games.filter((g) => g.winnerTeamId === m.teamAId).length;
  const b = m.games.filter((g) => g.winnerTeamId === m.teamBId).length;
  return m.games.length === 0 ? "" : `${a}\u2013${b}`;
}

interface GameDraft {
  winner: "A" | "B" | null;
  scoreA: string;
  scoreB: string;
}

function RecordMatchModal({
  tournament,
  match,
  onClose,
  onSave,
}: {
  tournament: Tournament;
  match: TournamentMatch;
  onClose: () => void;
  onSave: (games: GameResult[]) => Promise<void>;
}) {
  const a = teamOf(tournament, match.teamAId);
  const b = teamOf(tournament, match.teamBId);
  const [draft, setDraft] = useState<GameDraft[]>(() =>
    Array.from({ length: tournament.seriesLength }, (_, i) => {
      const g = match.games[i];
      return {
        winner: g ? (g.winnerTeamId === match.teamAId ? "A" : "B") : null,
        scoreA: g?.scoreA != null ? String(g.scoreA) : "",
        scoreB: g?.scoreB != null ? String(g.scoreB) : "",
      };
    }),
  );
  const [saving, setSaving] = useState(false);

  const need = Math.floor(tournament.seriesLength / 2) + 1;
  const counts = draft.reduce(
    (acc, g) => {
      if (g.winner === "A") acc.a++;
      if (g.winner === "B") acc.b++;
      return acc;
    },
    { a: 0, b: 0 },
  );
  const decided = counts.a >= need || counts.b >= need;

  const submit = () => {
    const games: GameResult[] = [];
    for (const g of draft) {
      if (!g.winner) break; // rows are sequential; stop at the first empty one
      const scoreA = g.scoreA.trim() === "" ? undefined : Number(g.scoreA);
      const scoreB = g.scoreB.trim() === "" ? undefined : Number(g.scoreB);
      games.push({
        winnerTeamId: g.winner === "A" ? match.teamAId! : match.teamBId!,
        ...(scoreA != null && !Number.isNaN(scoreA) ? { scoreA } : {}),
        ...(scoreB != null && !Number.isNaN(scoreB) ? { scoreB } : {}),
      });
    }
    setSaving(true);
    void onSave(games).finally(() => {
      setSaving(false);
      onClose();
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>
          &times;
        </button>
        <h1 style={{ fontFamily: "Chakra Petch", fontSize: 20, marginBottom: 4 }}>
          {match.winnerTeamId ? "Edit result" : "Record result"}
        </h1>
        <p className="lede" style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 14 }}>
          {a?.name ?? "TBD"} vs {b?.name ?? "TBD"} &middot; first to {need}
        </p>

        {Array.from({ length: tournament.seriesLength }, (_, i) => {
          const filledBefore = draft.slice(0, i).every((g) => g.winner);
          const before = draft.slice(0, i).reduce(
            (acc, g) => {
              if (g.winner === "A") acc.a++;
              if (g.winner === "B") acc.b++;
              return acc;
            },
            { a: 0, b: 0 },
          );
          const disabled = !filledBefore || before.a >= need || before.b >= need;
          const g = draft[i];
          return (
            <div key={i} className="record-game" style={{ opacity: disabled ? 0.45 : 1 }}>
              <span className="record-game-label">Game {i + 1}</span>
              <div className="record-game-picks">
                <button
                  type="button"
                  className={`chip${g.winner === "A" ? " on" : ""}`}
                  disabled={disabled}
                  onClick={() =>
                    setDraft((prev) => prev.map((x, j) => (j === i ? { ...x, winner: x.winner === "A" ? null : "A" } : x)))
                  }
                >
                  {a?.name ?? "TBD"}
                </button>
                <button
                  type="button"
                  className={`chip${g.winner === "B" ? " on" : ""}`}
                  disabled={disabled}
                  onClick={() =>
                    setDraft((prev) => prev.map((x, j) => (j === i ? { ...x, winner: x.winner === "B" ? null : "B" } : x)))
                  }
                >
                  {b?.name ?? "TBD"}
                </button>
              </div>
              <div className="record-game-scores">
                <input
                  className="input"
                  inputMode="numeric"
                  placeholder="Score"
                  aria-label={`${a?.name ?? "Team A"} score`}
                  disabled={disabled}
                  value={g.scoreA}
                  onChange={(e) => setDraft((prev) => prev.map((x, j) => (j === i ? { ...x, scoreA: e.target.value } : x)))}
                />
                <input
                  className="input"
                  inputMode="numeric"
                  placeholder="Score"
                  aria-label={`${b?.name ?? "Team B"} score`}
                  disabled={disabled}
                  value={g.scoreB}
                  onChange={(e) => setDraft((prev) => prev.map((x, j) => (j === i ? { ...x, scoreB: e.target.value } : x)))}
                />
              </div>
            </div>
          );
        })}
        {decided && (
          <p className="status" style={{ marginTop: 8 }}>
            Series decided: {counts.a > counts.b ? a?.name : b?.name} takes it {Math.max(counts.a, counts.b)}&ndash;
            {Math.min(counts.a, counts.b)}.
          </p>
        )}

        <div className="bar">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={saving || draft.every((g) => !g.winner)}
            onClick={submit}
          >
            {saving ? "Saving\u2026" : "Save result"}
          </button>
        </div>
      </div>
    </div>
  );
}

function MatchCard({
  tournament,
  match,
  onClick,
}: {
  tournament: Tournament;
  match: TournamentMatch;
  onClick: () => void;
}) {
  const a = teamOf(tournament, match.teamAId);
  const b = teamOf(tournament, match.teamBId);
  const ready = !!(match.teamAId && match.teamBId);
  const score = gameScore(match);
  const row = (team: TournamentTeam | null, winner: boolean) => (
    <div className={`bteam${winner ? " winner" : ""}`}>
      <span className="bteam-name">
        <span className={`bib-dot bib-dot-${BIB[(team?.bibIndex ?? 0) % BIB.length] ?? "a"}`} />
        {team?.name ?? "TBD"}
      </span>
      {winner && <span className="bteam-check">&#10003;</span>}
    </div>
  );
  return (
    <button
      type="button"
      className={`bracket-match${!ready ? " locked" : ""}`}
      disabled={!ready}
      onClick={onClick}
    >
      {row(a, !!match.winnerTeamId && match.winnerTeamId === match.teamAId)}
      {row(b, !!match.winnerTeamId && match.winnerTeamId === match.teamBId)}
      {score && <span className="bracket-score">{score}</span>}
      {match.isThirdPlace && <span className="bracket-tag">3rd place</span>}
    </button>
  );
}

export function TournamentScreen({ tournament, disciplines, matchingSquads, roster, onBack, onSplit, onUseSavedSquad, onRecord, onUndo, onDelete, onReroll, totalPlayers }: Props) {
  const [recording, setRecording] = useState<TournamentMatch | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [reviewing, setReviewing] = useState(tournament.teams.length > 0 && tournament.matches.every(m => m.games.length === 0));
  const discipline = disciplines.find((d) => d.id === tournament.disciplineId);
  const champ = champion(tournament);
  const hasAnyGames = tournament.matches.some((m) => m.games.length > 0);
  const canResplit = tournament.teams.length > 0 && !hasAnyGames;
  const eligibleCount = discipline
    ? (totalPlayers ?? tournament.teams.reduce((s, t) => s + t.players.length, 0))
    : 0;
  const minSize = discipline?.team.minTeamSize ?? 1;
  const perTeam = Math.max(minSize, Math.floor(eligibleCount / tournament.teamCount));




  return (
    <>
      <div className="breadcrumb">
        <a href="#" onClick={(e) => { e.preventDefault(); onBack(); }}>Games</a>
        <span className="sep">/</span>
        <span>{tournament.name}</span>
      </div>
      <div className="tournament-header">
        <h1>{tournament.name}</h1>
        <div className="tournament-subtitle">
          {discipline?.shortName ?? "Unknown"} · {FORMAT_LABEL[tournament.format]} · BO{tournament.seriesLength}
        </div>
      </div>
      <div className="tournament-meta-strip" role="list" aria-label="Tournament details">
        <div className="tms-item" role="listitem">
          <span className="tms-label">Format</span>
          <span className="tms-value">{FORMAT_LABEL[tournament.format]}</span>
        </div>
        <div className="tms-item" role="listitem">
          <span className="tms-label">Series</span>
          <span className="tms-value">BO{tournament.seriesLength}</span>
        </div>
        <div className="tms-item" role="listitem">
          <span className="tms-label">Teams</span>
          <span className="tms-value">{tournament.teams.length}/{tournament.teamCount}</span>
        </div>
        <div className="tms-item" role="listitem">
          <span className="tms-label">Status</span>
          <span className="tms-value">{tournament.status === "draft" ? "Draft" : tournament.status === "active" ? "In progress" : "Complete"}</span>
        </div>
      </div>

                {tournament.teams.length === 0 ? (
        <div className="tournament-preview">
          <div className="tournament-preview-label">Pre-split preview</div>
          <div className="tournament-preview-text">
            You&apos;ll pick from <strong>{eligibleCount} eligible players</strong> and split into {tournament.teamCount} team{tournament.teamCount === 1 ? "" : "s"} of {perTeam} each.
          </div>
          <div className="tournament-preview-text" style={{ fontSize: 13, opacity: 0.8 }}>
            {eligibleCount} of {totalPlayers ?? eligibleCount} players on the roster can play this discipline.
          </div>
          <button type="button" className="btn btn-primary" onClick={onSplit} data-testid="split-teams-cta">
            Split your teams
          </button>
          {matchingSquads && matchingSquads.length > 0 && (
            <div className="tournament-squads">
              <div className="tournament-preview-label">Or use a saved squad</div>
              <ul className="tournament-squad-list">
                {matchingSquads.map((squad) => {
                  const sizeSummary =
                    squad.result.teams.length === 2
                      ? `${squad.result.teams[0].slots.length} v ${squad.result.teams[1].slots.length}`
                      : `${squad.result.teams.length} teams`;
                  return (
                    <li key={squad.id}>
                      <button
                        type="button"
                        className="tournament-squad-row"
                        data-testid={`use-squad-${squad.id}`}
                        onClick={() => void onUseSavedSquad?.(squad)}
                      >
                        <span className="tournament-squad-name">{squad.name}</span>
                        <span className="tournament-squad-meta">
                          {sizeSummary} &middot; gap {squad.result.gap.toFixed(1)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      ) : reviewing ? (
        <ReviewPanel tournament={tournament} roster={roster} />
      ) : (
        <>
          {champ && (
            <div className="champ">
              <span className="champ-label">Champion</span>
              <span className="champ-name">{champ.name}</span>
            </div>
          )}

          {hasAnyGames && (
            <div className="status-banner">
              <button type="button" className="btn btn-ghost" onClick={() => void onUndo()}>
                ↶ Undo last game
              </button>
              {canResplit && (
                <span className="status-msg">Re-split is locked after the first result.</span>
              )}
            </div>
          )}

          {tournament.format === "swiss" ? (
            <StandingsView tournament={tournament} onMatch={setRecording} />
          ) : (
            <BracketView tournament={tournament} onMatch={setRecording} />
          )}
        </>
      )}

      {recording && (
        <RecordMatchModal
          tournament={tournament}
          match={recording}
          onClose={() => setRecording(null)}
          onSave={(games) => onRecord(recording.id, games)}
        />
      )}

      <div className="bar">
        {deleteConfirm ? (
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setDeleteConfirm(false)}>
              Cancel
            </button>
            <button type="button" className="btn btn-danger-ghost" onClick={() => void onDelete()}>
              Delete tournament
            </button>
          </>
        ) : reviewing ? (
          <>
            <button type="button" className="btn btn-ghost" onClick={onBack} data-testid="review-back">
              Back
            </button>
            {onReroll && (
              <button type="button" className="btn btn-ghost" onClick={() => { onReroll(); setReviewing(true); }}>
                Re-split
              </button>
            )}
            <button type="button" className="btn btn-primary" onClick={() => setReviewing(false)} data-testid="confirm-teams">
              Confirm teams →
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn btn-ghost" onClick={onBack}>
              Back
            </button>
            <button type="button" className="btn btn-danger-ghost" onClick={() => setDeleteConfirm(true)}>
              Delete
            </button>
          </>
        )}
      </div>
    </>
  );
}


function ReviewPanel({ tournament, roster }: {
  tournament: Tournament;
  roster?: Player[];
}) {
  const balanced = tournament.teams.every(t => Math.abs(t.strength - tournament.teams[0].strength) <= 0.5);
  const minStr = Math.min(...tournament.teams.map(t => t.strength));
  const maxStr = Math.max(...tournament.teams.map(t => t.strength));
  const gap = Math.max(0, maxStr - minStr);
  return (
    <div className="review-panel" data-testid="review-panel">
      <div className="review-panel-head">
        <h2>Review teams</h2>
        <div className="review-balance">
          <span className={`review-balance-dot ${balanced ? "" : "unbalanced"}`} />
          <span>Gap {gap.toFixed(1)}{balanced ? " · Fair game" : ""}</span>
        </div>
      </div>
      <div className="review-teams">
        {tournament.teams.map((team) => (
          <div key={team.id} className={`review-team ${BIB[team.bibIndex % BIB.length] ?? "a"}`}>
            <div className="review-team-head">
              <span className="review-team-name">{team.name}</span>
              <span className="review-team-avg">Avg {team.strength.toFixed(1)}</span>
            </div>
            <ul className="review-team-players">
              {team.players.map((playerId) => (
                <li key={playerId}>{roster?.find((p) => p.id === playerId)?.name ?? playerId}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function BracketView({
  tournament,
  onMatch,
}: {
  tournament: Tournament;
  onMatch: (m: TournamentMatch) => void;
}) {
  const rounds = [...new Set(tournament.matches.map((m) => m.round))].sort((a, b) => a - b);
  const maxRound = rounds[rounds.length - 1];
  return (
    <div className="bracket" role="list" aria-label="Tournament bracket">
      {rounds.map((r) => (
        <div key={r} className="bracket-column" role="listitem">
          <div className="bracket-column-head">
            <span className="rlabel">{r === maxRound ? "Final" : `Round ${r}`}</span>
            {r !== maxRound && <span className="rlabel rlabel-rule" aria-hidden="true" />}
          </div>
          {tournament.matches
            .filter((m) => m.round === r)
            .sort((a, b) => a.position - b.position)
            .map((m) => (
              <MatchCard key={m.id} tournament={tournament} match={m} onClick={() => onMatch(m)} />
            ))}
        </div>
      ))}
    </div>
  );
}

function StandingsView({
  tournament,
  onMatch,
}: {
  tournament: Tournament;
  onMatch: (m: TournamentMatch) => void;
}) {
  const table = standings(tournament);
  const rounds = [...new Set(tournament.matches.map((m) => m.round))].sort((a, b) => a - b);
  const nameOf = (id: Id | null) => teamOf(tournament, id)?.name ?? "TBD";
  return (
    <>
      <div className="standings">
        {table.map((row, i) => {
          const team = teamOf(tournament, row.teamId);
          return (
            <div key={row.teamId} className="standings-row">
              <span className="standings-pos">{i + 1}</span>
              <span className="standings-team">
                <span className={`bib-dot bib-dot-${BIB[(team?.bibIndex ?? 0) % BIB.length] ?? "a"}`} />
                {team?.name ?? "?"}
              </span>
              <span className="standings-wins">{row.wins}</span>
            </div>
          );
        })}
      </div>
      {rounds.map((r) => (
        <div key={r} className="swiss-round">
          <span className="rlabel">Round {r}</span>
          {tournament.matches
            .filter((m) => m.round === r)
            .sort((a, b) => a.position - b.position)
            .map((m) => (
              <button
                key={m.id}
                type="button"
                className={`bracket-match${!m.teamAId || !m.teamBId ? " locked" : ""}`}
                disabled={!m.teamAId || !m.teamBId}
                onClick={() => onMatch(m)}
              >
                <span className="bteam-name">
                  {nameOf(m.teamAId)}
                  {m.winnerTeamId === m.teamAId && <span className="bteam-check">&#10003;</span>}
                </span>
                <span className="bracket-score">{gameScore(m)}</span>
                <span className="bteam-name">
                  {nameOf(m.teamBId)}
                  {m.winnerTeamId === m.teamBId && <span className="bteam-check">&#10003;</span>}
                </span>
              </button>
            ))}
        </div>
      ))}
    </>
  );
}
