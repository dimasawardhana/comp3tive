import type { Community, Player, SavedSquad, Tournament } from "./domain/types";

interface Props {
  /** The active community; null while loading or before one exists. */
  community: Community | null;
  /** Active community's players, already filtered at the App layer. */
  players: Player[];
  /** Active community's saved squads, already filtered at the App layer. */
  squads: SavedSquad[];
  /** Active community's tournaments, already filtered at the App layer. */
  tournaments: Tournament[];
}

/**
 * Dashboard (the home hub per CONTEXT.md). Shows the active community's state
 * at a glance: players on the roster, saved squads, tournaments in play
 * (drafts + in progress). A fresh community (no players yet) gets a guided
 * empty state instead of zero stat cards. Every number renders from the same
 * community-scoped lists the Roster / Squads / Games hubs receive, so the
 * counts always match what each hub shows. Stat cards reuse the tournament
 * meta-card styling.
 *
 * The header follows the hub convention: kicker + h1 + a lede naming the
 * active community. This ticket ships the screen and its data wiring only;
 * navigation (Home tab), landing, and the action CTAs are later tickets.
 */
export function DashboardScreen({ community, players, squads, tournaments }: Props) {
  if (!community) return null;
  const tournamentCount = tournaments.filter(
    (t) => t.status === "draft" || t.status === "active",
  ).length;

  return (
    <div className="screen">
      <div className="kicker">State of play</div>
      <h1>Dashboard</h1>
      <p className="lede">
        <strong>{community.name}</strong> &middot; {players.length} player
        {players.length === 1 ? "" : "s"} on the roster
      </p>

      {players.length === 0 ? (
        <div className="empty dashboard-empty">
          <div className="kicker">First run</div>
          <div className="big">Run your first split</div>
          <p>Add players to the roster, then split them into fair teams for a match.</p>
        </div>
      ) : (
        <div className="dashboard-stats">
          <div className="tournament-meta-card dashboard-stat">
            <span className="tournament-meta-card-label">Players</span>
            <span className="tournament-meta-card-value">{players.length}</span>
          </div>
          <div className="tournament-meta-card dashboard-stat">
            <span className="tournament-meta-card-label">Saved squads</span>
            <span className="tournament-meta-card-value">{squads.length}</span>
          </div>
          <div className="tournament-meta-card dashboard-stat">
            <span className="tournament-meta-card-label">Tournaments</span>
            <span className="tournament-meta-card-value">{tournamentCount}</span>
          </div>
        </div>
      )}
    </div>
  );
}
