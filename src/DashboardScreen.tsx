import type { Community, Discipline, Player, SavedSquad, Tournament } from "./domain/types";
import { recentActiveTournaments, recentPlayers } from "./dashboardTeasers";
import { PageHeader } from "./ui/PageHeader";
import { Screen } from "./ui/Screen";
import { FORMAT_LABEL, STATUS_LABEL } from "./ui/constants";

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
  /**
   * The export nudge: a *request* to back the data up, not a status line.
   * `null` renders no row at all, and the hook has already decided everything
   * else — this prop only carries the one button.
   *
   * `onDismiss` is `useDurability`'s own `dismissNudge`, which snoozes under a
   * written policy (a month, and only for a roster no bigger than the one the
   * prompt was about). A local `useState(false)` here would replace that with
   * "hidden until this tab closes", which is a different and worse promise:
   * it would forget the answer the moment the user navigated away.
   */
  nudge: { onDismiss: () => void } | null;

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
 * The header is an h1 and one lede line naming the active community. The
 * actions are the hub's exits: the primary CTA starts the ad-hoc split and the
 * secondary links reach the other main flows. All navigation is delegated to
 * App via the callback props, so this screen never reimplements a flow.
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
  nudge,
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
    <Screen>
      <PageHeader
        title="Dashboard"
        lede={
          <>
            <strong>{community.name}</strong> &middot; {players.length} player
            {players.length === 1 ? "" : "s"} on the roster
          </>
        }
        action={
          players.length > 0 ? (
            <button type="button" className="btn btn-primary" onClick={onSplitMatch}>
              Split match
            </button>
          ) : undefined
        }
      />

      {players.length === 0 ? (
        <section className="dashboard-first-run">
          {/* Zeros printed as zeros, in the same divided strip a populated
              account gets. A first-run screen that hides its own counts reads
              as a different screen; this one says plainly that the roster,
              the squads and the tournaments are all at zero, which is the
              honest state and the frame the numbers will grow into. */}
          <div className="dashboard-stats dashboard-stats--zero">
            <div className="tournament-meta-card dashboard-stat">
              <span className="tournament-meta-card-label">Players</span>
              <span className="tournament-meta-card-value">0</span>
            </div>
            <div className="tournament-meta-card dashboard-stat">
              <span className="tournament-meta-card-label">Saved squads</span>
              <span className="tournament-meta-card-value">0</span>
            </div>
            <div className="tournament-meta-card dashboard-stat">
              <span className="tournament-meta-card-label">Tournaments</span>
              <span className="tournament-meta-card-value">0</span>
            </div>
          </div>
          <div className="empty dashboard-empty">
            <div className="big">Run your first split</div>
            <p>Add players to the roster, then split them into fair teams for a match.</p>
            <div className="actions">
              <button type="button" className="btn btn-primary" onClick={onAddPlayer}>
                + Add players
              </button>
            </div>
          </div>
          {/* The first-run screen answers "what do I do next" in full rather
              than leaving one card in an empty canvas: the roster is the first
              step, the rest are the real destinations that already work with an
              empty roster, and the third column is the discipline catalog the
              app actually holds. That is why the screen has no dead half: the
              right side carries a fact about this product, not filler. */}
          <div className="dashboard-first-run-next">
            <h2 className="dashboard-teasers-head">After the roster</h2>
            <ul className="dashboard-next-list">
              <li>
                <span className="dashboard-next-title">Rate what each player is good at</span>
                <span className="dashboard-next-note">
                  The split reads roles and attributes, so a rated roster gets a fairer result.
                </span>
              </li>
              <li>
                <span className="dashboard-next-title">Split for tonight</span>
                <span className="dashboard-next-note">
                  Pick the discipline and the team count, then compare the gap it proves.
                </span>
              </li>
              <li>
                <span className="dashboard-next-title">Run a tournament</span>
                <span className="dashboard-next-note">
                  Round robin, Swiss or single elimination, recorded as you play.
                </span>
              </li>
              <li>
                <span className="dashboard-next-title">Keep a backup</span>
                <span className="dashboard-next-note">
                  Export a JSON file from Roster. It is the only copy you control.
                </span>
              </li>
            </ul>
          </div>
          {/* The catalog, from the same `disciplines` list the other hubs read:
              a first-time organizer's real choice is which of these they play,
              and it is the one fact on this screen that comes from the app
              rather than from this component. */}
          <div className="dashboard-catalog">
            <h2 className="dashboard-teasers-head">Ready to play</h2>
            <ul className="dashboard-catalog-list">
              {disciplines.map((d) => (
                <li key={d.id}>
                  <div className="dashboard-catalog-row">
                    <span className="dashboard-catalog-name">{d.name}</span>
                    <span className="dashboard-catalog-meta">
                      {d.roles.length} role{d.roles.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  {/* The roles themselves, because they are what the split
                      balances against. This is the one place on a first-run
                      screen where a reader can see what the app actually
                      models, and it comes from the catalog rather than from a
                      sentence about the catalog. */}
                  <span className="dashboard-catalog-roles">
                    {d.roles.map((r) => r.name).join(" · ")}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
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
          {nudge && (
            <div className="nudge">
              <span className="nudge-msg">{"This browser does not promise to keep this app's data. Export a backup from Roster."}</span>
              <button type="button" className="link" onClick={nudge.onDismiss}>
                Dismiss
              </button>
            </div>
          )}

          <section className="dashboard-teasers" aria-label="Recent players">
            <div className="dashboard-teasers-head">
              <h2>Recent players</h2>
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

      {players.length > 0 && (
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
      )}
    </Screen>
  );
}
