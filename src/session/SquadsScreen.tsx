import { useState } from "react";
import { PageHeader } from "../ui/PageHeader";
import { Screen } from "../ui/Screen";
import type { Discipline, Id, Player, SavedSquad } from "../domain/types";
import { teamName } from "./flow";
import { BIB } from "../ui/constants";
import { relativeTime } from "../ui/format";
import { ConfirmButton } from "../ui/ConfirmButton";

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
          <ConfirmButton
            className="btn btn-danger-ghost"
            label="Delete"
            confirmLabel="Delete squad"
            message={`Delete "${open.name}"? Tournaments that used it keep their teams.`}
            onConfirm={() => void onDelete(open.id)}
          />
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
                  <span onClick={(e) => e.stopPropagation()}>
                    <ConfirmButton
                      className="link danger"
                      label="Delete"
                      ariaLabel={`Delete ${squad.name}`}
                      confirmLabel={`Delete ${squad.name}`}
                      message={`Delete "${squad.name}"? Tournaments that used it keep their teams.`}
                      onConfirm={() => void onDelete(squad.id)}
                    />
                  </span>
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
