import { useState } from "react";
import { PageHeader } from "../ui/PageHeader";
import { Screen } from "../ui/Screen";
import type { Discipline, Id, Player, SavedSquad } from "../domain/types";
import { teamName } from "./flow";

interface Props {
  /** Active community's saved squads, newest first. */
  squads: SavedSquad[];
  loading: boolean;
  disciplines: Discipline[];
  roster: Player[];
  onBack: () => void;
  /** Reopen the squad's teams in the split screen (swaps / re-roll, save-as-new). */
  onReSplit: (squad: SavedSquad) => void;
  /** Jump to the Games tab with the new-tournament modal prefilled for this squad. */
  onNewTournament: (squad: SavedSquad) => void;
  onDelete: (id: Id) => Promise<void>;
}

const BIB = ["a", "b", "c", "d", "e"];

function relativeTime(ts: number): string {
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

function squadBadges(squad: SavedSquad, disciplines: Discipline[]) {
  const discipline = disciplines.find((d) => d.id === squad.disciplineId);
  const playerCount = squad.result.teams.reduce((n, t) => n + t.slots.length, 0);
  return {
    discipline,
    playerCount,
    summary:
      squad.result.teams.length === 2
        ? `${squad.result.teams[0].slots.length} v ${squad.result.teams[1].slots.length}`
        : `${squad.result.teams.length} teams`,
  };
}

export function SquadsScreen({ squads, loading, disciplines, roster, onBack, onReSplit, onNewTournament, onDelete }: Props) {
  const [openId, setOpenId] = useState<Id | null>(null);
  const open = squads.find((s) => s.id === openId) ?? null;
  const nameOf = (id: Id): string => roster.find((p) => p.id === id)?.name ?? "?";
  const disciplineName = (squad: SavedSquad): string =>
    disciplines.find((d) => d.id === squad.disciplineId)?.shortName ?? "Unknown";
  const gapOf = (squad: SavedSquad): string => squad.result.gap.toFixed(1);

  if (open) {
    const playerCount = open.result.teams.reduce((n, t) => n + t.slots.length, 0);
    return (
      <Screen>
        <PageHeader
          kicker="Saved squad"
          title={open.name}
          lede={
            <>
              {disciplineName(open)} &middot; {open.result.teams.length} teams &middot; {playerCount} players
              &middot; gap {gapOf(open)}
            </>
          }
        />

        <div className="review-teams">
          {open.result.teams.map((team) => (
            <div key={team.index} className={`review-team ${BIB[team.index % BIB.length] ?? "a"}`}>
              <div className="review-team-head">
                <span className="review-team-name">{teamName(team.index)}</span>
                <span className="review-team-avg">Avg {team.avgStrength.toFixed(1)}</span>
              </div>
              <ul className="review-team-players">
                {team.slots.map((slot) => (
                  <li key={slot.playerId}>{nameOf(slot.playerId)}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="bar">
          <button type="button" className="btn btn-ghost" onClick={() => setOpenId(null)}>
            ← Squads
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => onReSplit(open)}>
            Re-split
          </button>
          <button type="button" className="btn btn-primary" onClick={() => onNewTournament(open)}>
            New tournament with these teams
          </button>
          <button
            type="button"
            className="btn btn-danger-ghost"
            onClick={() => {
              if (window.confirm(`Delete "${open.name}"? Tournaments that used it keep their teams.`)) {
                void onDelete(open.id);
              }
            }}
          >
            Delete
          </button>
        </div>
      </Screen>
    );
  }

  return (
    <Screen>
      <PageHeader
        kicker="Squad bank"
        title="Saved squads"
        lede="Named team sets you saved from a split. Drop one into a tournament or re-split it."
      />

      {loading ? (
        <p className="status">Loading&hellip;</p>
      ) : squads.length === 0 ? (
        <div className="empty">
          <div className="kicker">Nothing saved yet</div>
          <div className="big">No saved squads</div>
          <p>Run a split and hit Save squad. It shows up here, ready for a tournament.</p>
        </div>
      ) : (
        <ul className="roster history-list">
          {squads.map((squad) => {
            const { discipline, playerCount, summary } = squadBadges(squad, disciplines);
            const stripeVar = discipline
              ? `var(--bib-${discipline.shortName.toLowerCase().charAt(0)})`
              : "var(--text-2)";
            return (
              <li
                key={squad.id}
                className="row row-clickable history-row"
                style={{ ["--stripe" as string]: stripeVar }}
                role="button"
                tabIndex={0}
                onClick={() => setOpenId(squad.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setOpenId(squad.id);
                  }
                }}
              >
                <div className="who">
                  <div className="name">
                    {squad.name}
                    <span className="history-time" title={new Date(squad.createdAt).toLocaleString()}>
                      {relativeTime(squad.createdAt)}
                    </span>
                  </div>
                  <div className="badges">
                    <span className="badge badge--generic">{discipline?.shortName ?? "Unknown"}</span>
                    <span className="badge badge--generic">
                      {squad.result.teams.length} teams ({summary})
                    </span>
                    <span className="badge badge--generic">gap {gapOf(squad)}</span>
                    <span className="badge badge--generic">{playerCount} players</span>
                  </div>
                </div>
                <span className="row-actions">
                  <span className="row-edit" aria-hidden="true">›</span>
                  <button
                    type="button"
                    className="link danger"
                    aria-label={`Delete ${squad.name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm(`Delete "${squad.name}"? Tournaments that used it keep their teams.`)) {
                        void onDelete(squad.id);
                      }
                    }}
                  >
                    Delete
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <div className="bar">
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          Back
        </button>
      </div>
    </Screen>
  );
}
