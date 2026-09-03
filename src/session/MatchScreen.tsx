import type { Discipline, Id, Player } from "../domain/types";
import { capabilityFor, strengthOf } from "./flow";

interface Props {
  roster: Player[];
  disciplines: Discipline[];
  disciplineId: Id;
  selectedIds: Id[];
  teamCount: number;
  /** Tournament mode: the tournament fixes the discipline and team count. */
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
  const excluded = roster.some((p) => capabilityFor(p, discipline) === undefined);
  const minSize = discipline.team.minTeamSize;
  const seatsNeeded = teamCount * minSize;
  const notEnoughPlayers = selectedCapable.length < seatsNeeded;
  const maxPossibleTeams = Math.floor(selectedCapable.length / minSize);
  const teamCountTooHigh = teamCount > maxPossibleTeams;

  return (
    <>
      <div className="breadcrumb">
        <a href="#" onClick={(e) => { e.preventDefault(); props.onBack(); }}>Games</a>
        <span className="sep">/</span>
        <span>Match setup</span>
      </div>
      <h1>Who&apos;s here?</h1>
      <p className="lede">Tap everyone who showed up tonight.</p>
      <div className="chips">
        {roster.map((p) => {
          const strength = strengthOf(p, discipline);
          const disabled = strength === null;
          const selected = selectedIds.includes(p.id) && !disabled;
          return (
            <button
              key={p.id}
              type="button"
              data-testid={`player-chip-${p.id}`}
              className="chip"
              disabled={disabled}
              aria-pressed={selected}
            >
              {p.name} <span className="str">{disabled ? "\u2014" : strength.toFixed(1)}</span>
            </button>
          );
        })}
      </div>
      {excluded && (
        <p className="status">Players without a {discipline.shortName} capability are excluded.</p>
      )}

      <span className="sec">What are we playing?</span>
      <div className="games">
        {disciplines.map((d) => (
          <button
            key={d.id}
            type="button"
            className="game"
            aria-pressed={d.id === disciplineId}
            disabled={!!props.lockedDisciplineId && d.id !== props.lockedDisciplineId}
            onClick={() => props.onSelectDiscipline(d.id)}
          >
            {d.name}
            <span className="sub">{gameSub(d)}</span>
          </button>
        ))}
      </div>
      {props.lockedDisciplineId && (
        <p className="status">The tournament is locked to {discipline.shortName}.</p>
      )}

      <span className="sec">Teams</span>
      <div className="stepper">
        <button
          type="button"
          aria-label="Fewer teams"
          disabled={!!props.lockedTeamCount}
          onClick={() => props.onTeamCountChange(teamCount - 1)}
        >
          &#8722;
        </button>
        <span className="count">{teamCount}</span>
        <button
          type="button"
          aria-label="More teams"
          disabled={!!props.lockedTeamCount}
          onClick={() => props.onTeamCountChange(teamCount + 1)}
        >
          +
        </button>
        <span className="hint">
          {props.lockedTeamCount
            ? `${teamCount} teams, locked by the tournament`
            : teamCountTooHigh
              ? `${minSize} per team · max ${maxPossibleTeams} team${maxPossibleTeams === 1 ? "" : "s"} from ${selectedCapable.length} eligible`
              : gameSub(discipline)}
        </span>
      </div>

      <div className="bar">
        <button type="button" className="btn btn-ghost" onClick={props.onBack}>
          Back
        </button>
        <button
          type="button"
          data-testid="split-button"
          className="btn btn-primary"
          disabled={selectedCapable.length === 0 || notEnoughPlayers}
          onClick={props.onSplit}
          title={
            notEnoughPlayers
              ? `Need ${seatsNeeded} eligible players for ${teamCount} team${teamCount === 1 ? "" : "s"} — have ${selectedCapable.length}`
              : undefined
          }
        >
          {notEnoughPlayers
            ? `Need ${seatsNeeded - selectedCapable.length} more`
            : `Split ${selectedCapable.length}/${capable.length}`}
        </button>
      </div>
    </>
  );
}
