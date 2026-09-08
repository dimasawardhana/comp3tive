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
  /** Start an ad-hoc split (Roster's "Split match" flow): lands on match setup. */
  onSplitMatch: () => void;
  /** Open the Games hub with the new-tournament create modal (fresh, unpolluted). */
  onNewTournament: () => void;
  /** Open the Saved Squads hub. */
  onBrowseSquads: () => void;
  /** Open the roster's add-player modal (Roster's "+ Add Player" flow). */
  onAddPlayer: () => void;
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
 * active community. The actions are the hub's exits: the primary CTA starts
 * the ad-hoc split and the secondary links reach the other main flows. All
 * navigation is delegated to App via the callback props — this screen never
 * reimplements a flow.
 */
export function DashboardScreen({
  community,
  players,
  squads,
  tournaments,
  onSplitMatch,
  onNewTournament,
  onBrowseSquads,
  onAddPlayer,
}: Props) {
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
          <div className="actions">
            <button type="button" className="btn btn-primary" onClick={onAddPlayer}>
              + Add players
            </button>
          </div>
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

      <div className="dashboard-actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={onSplitMatch}
          disabled={players.length === 0}
        >
          Split match
        </button>
        <div className="dashboard-links">
          <button type="button" className="link" onClick={onNewTournament}>
            + New tournament
          </button>
          <button type="button" className="link" onClick={onBrowseSquads}>
            Browse saved squads
          </button>
          <button type="button" className="link" onClick={onAddPlayer}>
            + Add player
          </button>
        </div>
      </div>
    </div>
  );
}
