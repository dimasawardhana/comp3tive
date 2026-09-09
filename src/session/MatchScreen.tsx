import type { Discipline, Id, Player } from "../domain/types";
import { capabilityFor } from "./flow";

interface Props {
  roster: Player[];
  disciplines: Discipline[];
  disciplineId: Id;
  selectedIds: Id[];
  teamCount: number;
  lockedDisciplineId?: Id;
  lockedTeamCount?: number;
  onTogglePlayer: (id: Id) => void;
  onSelectDiscipline: (id: Id) => void;
  onTeamCountChange: (n: number) => void;
  onSplit: () => void;
  onBack: () => void;
}

function gameSub(d: Discipline): string {
  const n = d.team.minTeamSize;
  return d.team.maxTeamSize === null ? `${n} v ${n} + subs` : `${n} v ${n}, roles covered`;
}

export function MatchScreen(props: Props) {
  const { roster, disciplines, disciplineId, selectedIds, teamCount } = props;
  const discipline = disciplines.find((d) => d.id === disciplineId) ?? disciplines[0];
  const capable = roster.filter((p) => capabilityFor(p, discipline) !== undefined);
  const selectedCapable = capable.filter((p) => selectedIds.includes(p.id));
  const minSize = discipline.team.minTeamSize;
  const seatsNeeded = teamCount * minSize;
  const notEnoughPlayers = selectedCapable.length < seatsNeeded;
  const maxPossibleTeams = Math.floor(selectedCapable.length / minSize);
  const teamCountTooHigh = teamCount > maxPossibleTeams;

  return (
    <div className="screen match-setup">
      <div className="breadcrumb">
        <a href="#" onClick={(e) => { e.preventDefault(); props.onBack(); }}>Roster</a>
        <span className="sep">/</span>
        <span>Match setup</span>
      </div>

      <h1>Set the match</h1>
      <p className="lede">Pick the game first, then the squad. Teams are sized to the game.</p>

      <section className="match-section">
        <div className="match-section-head">
          <span className="match-step">1</span>
          <h2 className="match-section-title">What are we playing?</h2>
        </div>
        <div className="games" role="radiogroup" aria-label="Discipline">
          {disciplines.map((d) => {
            const isActive = d.id === discipline.id;
            const stripeVar = `var(--bib-${d.shortName.toLowerCase().charAt(0)})`;
            return (
              <button
                key={d.id}
                type="button"
                role="radio"
                aria-checked={isActive}
                className={`game ${isActive ? "active" : ""}`}
                style={{ ["--stripe" as string]: stripeVar }}
                onClick={() => props.onSelectDiscipline(d.id)}
                disabled={!!props.lockedDisciplineId && d.id !== props.lockedDisciplineId}
              >
                <div className="game-name">{d.name}</div>
                <div className="game-sub">{gameSub(d)}</div>
                {isActive && <div className="game-check" aria-hidden="true">✓</div>}
              </button>
            );
          })}
        </div>
        {props.lockedDisciplineId && (
          <p className="status">Tournament is locked to {discipline.shortName}.</p>
        )}
      </section>

      <section className="match-section">
        <div className="match-section-head">
          <span className="match-step">2</span>
          <h2 className="match-section-title">Who&apos;s playing?</h2>
          <span className="match-count">
            {selectedCapable.length} / {capable.length} eligible
          </span>
        </div>
        {capable.length === 0 ? (
          <div className="empty">
            <div className="big">No one eligible</div>
            <p>No players on this roster have a {discipline.shortName} capability yet.</p>
          </div>
        ) : (
          <div className="chips" role="group" aria-label="Eligible players">
            {capable.map((p) => {
              const cap = capabilityFor(p, discipline);
              const preferred = cap?.preferredRole
                ? discipline.roles.find((r) => r.id === cap.preferredRole)
                : null;
              const otherRoles = cap?.eligibleRoles
                .filter((id) => id !== cap.preferredRole)
                .map((id) => discipline.roles.find((r) => r.id === id))
                .filter((r): r is NonNullable<typeof r> => r !== undefined) ?? [];
              return (
                <button
                  key={p.id}
                  type="button"
                  data-testid={`player-chip-${p.id}`}
                  className="chip chip-player"
                  aria-pressed={selectedIds.includes(p.id)}
                  onClick={() => props.onTogglePlayer(p.id)}
                >
                  <span className="chip-name">{p.name}</span>
                  {p.notes && <span className="chip-note">{p.notes}</span>}
                  {cap && (
                    <span className="chip-roles">
                      {preferred && (
                        <span className="chip-role chip-role--preferred" title="Preferred role">
                          {preferred.name}
                        </span>
                      )}
                      {otherRoles.map((r) => (
                        <span key={r.id} className="chip-role" title="Eligible role">
                          {r.name}
                        </span>
                      ))}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section className="match-section">
        <div className="match-section-head">
          <span className="match-step">3</span>
          <h2 className="match-section-title">How many teams?</h2>
          <span className="match-count">
            {seatsNeeded} seats needed
          </span>
        </div>
        <div className="stepper" role="group" aria-label="Team count">
          <button
            type="button"
            aria-label="Fewer teams"
            onClick={() => props.onTeamCountChange(Math.max(2, teamCount - 1))}
            disabled={props.lockedTeamCount !== undefined || teamCount <= 2}
          >
            −
          </button>
          <span className="count" aria-live="polite">{teamCount}</span>
          <button
            type="button"
            aria-label="More teams"
            onClick={() => props.onTeamCountChange(Math.min(8, teamCount + 1))}
            disabled={props.lockedTeamCount !== undefined || teamCount >= 8}
          >
            +
          </button>
        </div>
        {props.lockedTeamCount !== undefined && (
          <p className="status">Locked to {props.lockedTeamCount} teams by the tournament.</p>
        )}
        {!props.lockedTeamCount && teamCountTooHigh && maxPossibleTeams > 0 && (
          <p className="status">Max {maxPossibleTeams} teams from {selectedCapable.length} eligible players.</p>
        )}
      </section>

      <div className="bar match-bar">
        <button type="button" className="btn btn-ghost" onClick={props.onBack}>
          Back
        </button>
        <button
          type="button"
          data-testid="split-button"
          className="btn btn-primary"
          onClick={props.onSplit}
          disabled={selectedCapable.length === 0 || notEnoughPlayers}
          title={
            notEnoughPlayers
              ? `Need ${seatsNeeded} eligible players for ${teamCount} team${teamCount === 1 ? "" : "s"} — have ${selectedCapable.length}`
              : undefined
          }
        >
          Split {teamCount} teams
        </button>
      </div>
    </div>
  );
}
