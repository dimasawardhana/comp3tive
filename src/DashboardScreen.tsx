import type { Community, Discipline, Player, SavedSquad, Tournament } from "./domain/types";
import { recentActiveTournaments, recentPlayers } from "./dashboardTeasers";

const FORMAT_LABEL: Record<Tournament["format"], string> = {
  series: "Series",
  "single-elim": "Single elimination",
  swiss: "Swiss",
};

const STATUS_LABEL: Record<Tournament["status"], string> = {
  draft: "Draft",
  active: "In progress",
  complete: "Complete",
};

const BADGE_CLASS: Record<string, string> = {
  futsal: "badge--futsal",
  mlbb: "badge--mlbb",
};

interface Props {
  /** The active community; null while loading or before one exists. */
  community: Community | null;
  /** Active community's players, already filtered at the App layer. */
  players: Player[];
  /** Active community's saved squads, already filtered at the App layer. */
  squads: SavedSquad[];
  /** Active community's tournaments, already filtered at the App layer. */
  tournaments: Tournament[];
  /** Discipline catalog (global): short names and badge colors for teasers. */
  disciplines: Discipline[];
  /** Start an ad-hoc split (Roster's "Split match" flow): lands on match setup. */
  onSplitMatch: () => void;
  /** Open the Games hub with the new-tournament create modal (fresh, unpolluted). */
  onNewTournament: () => void;
  /** Open the Saved Squads hub. */
  onBrowseSquads: () => void;
  /** Open the roster's add-player modal (Roster's "+ Add Player" flow). */
  onAddPlayer: () => void;
  /** Open a player's edit modal (Roster's row-click flow). */
  onOpenPlayer: (player: Player) => void;
  /** Open a tournament (Games' row-click flow). */
  onOpenTournament: (tournament: Tournament) => void;
}

/**
 * Dashboard (the home hub per CONTEXT.md). Shows the active community's state
 * at a glance: players on the roster, saved squads, tournaments in play
 * (drafts + in progress), and teasers of the most recent players and active
 * tournaments. A fresh community (no players yet) gets a guided empty state
 * instead of zero stat cards, and the teaser sections ride along behind it
 * (there is nothing to tease on a fresh roster). Every number renders from
 * the same community-scoped lists the Roster / Squads / Games hubs receive,
 * so the counts always match what each hub shows. Stat cards reuse the
 * tournament meta-card styling.
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
  disciplines,
  onSplitMatch,
  onNewTournament,
  onBrowseSquads,
  onAddPlayer,
  onOpenPlayer,
  onOpenTournament,
}: Props) {
  if (!community) return null;
  const tournamentCount = tournaments.filter(
    (t) => t.status === "draft" || t.status === "active",
  ).length;
  const disciplineById = new Map(disciplines.map((d) => [d.id, d]));
  const badgeClass = (disciplineId: string) => BADGE_CLASS[disciplineId] ?? "badge--generic";
  const recentPlayersList = recentPlayers(players);
  const recentTournaments = recentActiveTournaments(tournaments);

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
        <>
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

          <section className="dashboard-teasers" aria-label="Recent players">
            <div className="dashboard-teasers-head">
              <h2>Recent players</h2>
              <span className="kicker">Last in the roster</span>
            </div>
            <ul className="roster dashboard-teaser-list">
              {recentPlayersList.map((player) => {
                const primaryCap = player.capabilities[0];
                const primaryDiscipline = primaryCap
                  ? disciplineById.get(primaryCap.disciplineId)
                  : null;
                const stripe = primaryDiscipline?.shortName
                  ? `var(--bib-${primaryDiscipline.shortName.toLowerCase().charAt(0)})`
                  : "var(--text-2)";
                return (
                  <li
                    key={player.id}
                    className="row row-clickable"
                    style={{ ["--stripe" as string]: stripe }}
                    role="button"
                    tabIndex={0}
                    onClick={() => onOpenPlayer(player)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onOpenPlayer(player);
                      }
                    }}
                  >
                    <div className="who">
                      <div className="name">{player.name}</div>
                      {player.capabilities.length === 0 ? (
                        <div className="note">No capabilities yet</div>
                      ) : (
                        <div className="badges">
                          {player.capabilities.map((cap) => {
                            const discipline = disciplineById.get(cap.disciplineId);
                            if (!discipline) return null;
                            return (
                              <span
                                key={cap.disciplineId}
                                className={`badge ${badgeClass(discipline.id)}`}
                              >
                                {discipline.shortName}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <span className="row-edit" aria-hidden="true">
                      ›
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="dashboard-teasers" aria-label="Active tournaments">
            <div className="dashboard-teasers-head">
              <h2>Active tournaments</h2>
              <span className="kicker">Teams submitted</span>
            </div>
            {recentTournaments.length === 0 ? (
              <p className="dashboard-teasers-empty">
                No active tournaments.{" "}
                <button type="button" className="link" onClick={onNewTournament}>
                  + Create one
                </button>
              </p>
            ) : (
              <ul className="roster dashboard-teaser-list">
                {recentTournaments.map((tournament) => {
                  const discipline = disciplineById.get(tournament.disciplineId);
                  const stripe = discipline?.shortName
                    ? `var(--bib-${discipline.shortName.toLowerCase().charAt(0)})`
                    : "var(--text-2)";
                  return (
                    <li
                      key={tournament.id}
                      className="row row-clickable"
                      style={{ ["--stripe" as string]: stripe }}
                      role="button"
                      tabIndex={0}
                      onClick={() => onOpenTournament(tournament)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onOpenTournament(tournament);
                        }
                      }}
                    >
                      <div className="who">
                        <div className="name">{tournament.name}</div>
                        <div className="badges">
                          <span className={`badge ${badgeClass(tournament.disciplineId)}`}>
                            {discipline?.shortName ?? "Unknown"}
                          </span>
                          <span className="badge badge--generic">
                            {FORMAT_LABEL[tournament.format]}
                          </span>
                          <span className="badge badge--generic">
                            {tournament.teams.length}/{tournament.teamCount} teams
                          </span>
                          <span className="badge badge--generic">
                            {STATUS_LABEL[tournament.status]}
                          </span>
                        </div>
                      </div>
                      <span className="row-edit" aria-hidden="true">
                        ›
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
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
