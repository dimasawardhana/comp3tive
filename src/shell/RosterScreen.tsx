import type { Community, Discipline, Id, Player } from "../domain/types";
import { PageHeader } from "../ui/PageHeader";
import { Screen } from "../ui/Screen";
import { PlayerEditModal } from "../roster/PlayerEditModal";

export interface RosterScreenProps {
  activeCommunity: Community | null;
  disciplines: Discipline[];
  players: Player[];                 // scoped
  visiblePlayers: Player[];
  filterIds: Id[];
  disciplinesById: Map<Id, Discipline>;
  editingPlayer: Player | null | "new";
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onToggleFilter: (disciplineId: Id) => void;
  onClearFilters: () => void;
  onAddPlayer: () => void;
  onOpenPlayer: (player: Player) => void;
  onImportFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onExport: () => void;
  onSplitMatch: () => void;
  onSavePlayer: (player: Player) => Promise<void>;
  onDeletePlayer: (id: Id) => Promise<void>;
  onCloseEditor: () => void;
}

/**
 * The roster hub's screen. Its markup moved out of App verbatim; what changed
 * is only which handler each binding names — every `setEditingPlayer`,
 * `filtersByDiscipline`, `clearFilters`, `handleExport`, `handlePlayerImport`
 * and `randomPlayers` reference became the prop App passes in, and
 * `communityPlayers` became the `players` prop.
 *
 * `onDelete` is A04's already-catching `deletePlayer` passed straight through:
 * `PlayerEditModal.remove` calls `onClose()` itself, so no try/catch is added
 * here — A04's toast is the error path, and rethrowing would escape `void
 * remove()` as an unhandled rejection.
 */
export function RosterScreen(props: RosterScreenProps) {
  const { activeCommunity, disciplines, players, visiblePlayers, filterIds, disciplinesById, editingPlayer, fileInputRef } = props;
  return (
    <Screen>
      <PageHeader
        kicker="Match sheet"
        title="comp3tive"
        lede={
          activeCommunity && (
            <>
              <strong>{activeCommunity.name}</strong> · {players.length} player
              {players.length === 1 ? "" : "s"} on the roster
            </>
          )
        }
      />
          
      {activeCommunity && (
        <>
          {/* Discipline filter chips */}
          {disciplines.length > 0 && (
            <div className="chips">
              {disciplines.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className="chip"
                  aria-pressed={filterIds.includes(d.id)}
                  onClick={() => props.onToggleFilter(d.id)}
                >
                  {d.shortName}
                </button>
              ))}
            </div>
          )}
          {filterIds.length > 0 && (
            <button className="btn btn-ghost" onClick={props.onClearFilters}>Clear filters</button>
          )}
              
          {/* Player actions */}
          <div className="roster-toolbar">
            <button
              className="btn btn-primary"
              onClick={props.onAddPlayer}
            >
              + Add Player
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => fileInputRef.current?.click()}
            >
              Import players
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.csv,.txt"
              onChange={props.onImportFile}
              style={{ display: "none" }}
            />
            <div className="roster-toolbar-spacer" />
            <button className="btn btn-ghost" onClick={props.onExport}>
              Export
            </button>
          </div>

          {editingPlayer !== null && activeCommunity && (
            <PlayerEditModal
              player={editingPlayer === "new" ? null : editingPlayer}
              disciplines={disciplines}
              communityId={activeCommunity.id}
              onClose={props.onCloseEditor}
              onSave={props.onSavePlayer}
              onDelete={props.onDeletePlayer}
            />
          )}
              
          {/* Player list */}
          {players.length === 0 ? (
            <div className="empty">
              <div className="kicker">Empty bench</div>
              <div className="big">No players in this community</div>
              <p>Add the first player manually, or import a JSON / CSV roster.</p>
              <button
                className="btn btn-primary"
                style={{ marginTop: 14 }}
                onClick={props.onAddPlayer}
              >
                + Add the first player
              </button>
            </div>
          ) : (
            <div className="roster">
              {visiblePlayers.map((player, i) => {
                const primaryCap = player.capabilities[0];
                const primaryDiscipline = primaryCap ? disciplinesById.get(primaryCap.disciplineId) : null;
                const bibVar = primaryDiscipline?.shortName
                  ? `var(--bib-${primaryDiscipline.shortName.toLowerCase().charAt(0)})`
                  : "var(--text-2)";
                return (
                  <div
                    key={player.id}
                    className="row row-clickable"
                    style={{ "--stripe": bibVar } as React.CSSProperties}
                    onClick={() => props.onOpenPlayer(player)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        props.onOpenPlayer(player);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label={`Edit ${player.name}`}
                  >
                    <span className="lineup-no">{String(i + 1).padStart(2, "0")}</span>
                    <div className="who">
                      <div className="name">{player.name}</div>
                      {player.notes && (
                        <div className="note">{player.notes}</div>
                      )}
                      <div className="badges">
                        {player.capabilities.map(cap => {
                          const discipline = disciplinesById.get(cap.disciplineId);
                          if (!discipline) return null;
                          const bibClass = `badge--${discipline.shortName.toLowerCase().charAt(0)}`;
                          return (
                            <span key={cap.disciplineId} className={`badge ${bibClass}`}>
                              {discipline.shortName}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                    <span className="row-edit" aria-hidden="true">›</span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="cta-bar">
            <div className="cta-label">
              Ready to play? <strong>Split the roster</strong> and check the balance.
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={props.onSplitMatch}
              disabled={!activeCommunity || players.length === 0}
            >
              Split match
            </button>
          </div>
        </>
      )}
    </Screen>
  );
}
