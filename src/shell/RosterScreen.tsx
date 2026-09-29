import type { Community, Discipline, Id, Player } from "../domain/types";
import { PageHeader } from "../ui/PageHeader";
import { Screen } from "../ui/Screen";
import { PlayerEditModal } from "../roster/PlayerEditModal";
import type { PendingMerge } from "./usePlayerImport";

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
  /** The backup merge's two-step. Null until a backup names something new. */
  pendingMerge: PendingMerge | null;
  onConfirmMerge: () => void;
  onCancelMerge: () => void;
  importFile: (file: File) => Promise<void>;
  onExport: () => void;
  onSplitMatch: () => void;
  onSavePlayer: (player: Player) => Promise<void>;
  onDeletePlayer: (id: Id) => Promise<void>;
  onCloseEditor: () => void;
  /**
   * The browser's persistence verdict for this origin, forwarded from
   * `useDurability`. Tri-state on purpose, and the three cases are three
   * different policies:
   *
   *  - `true` — the only basis for saying anything reassuring, and only in the
   *    past tense and attributed to the browser, because the whole claim is one
   *    reading that happened on this visit. "Reported … on this visit" is not
   *    decoration: `persisted` is a measurement taken once, nothing re-checks
   *    it, and the user can still clear site data. The tense is the hedge.
   *  - `false` — the only basis for saying the data is not stored persistently,
   *    and the only thing that raises the export nudge. Present tense, because
   *    the condition is the state of the world and not an event that has
   *    happened to it.
   *  - `null` — nobody has answered, which is this app's fact and not the
   *    browser's: the probe has not settled, or there is no API to ask. An
   *    unknown is not a refusal, so it is never rendered as bad news — and the
   *    sentence never names the browser as the cause, because it is the app
   *    that has no answer. `null` is the state of the very first render of
   *    every load, so this is the most-read branch in the app.
   *
   * The note is written as three explicit comparisons rather than a truthiness
   * test, on purpose: `!persisted` folds `null` into the refusal branch, and
   * `persisted && …` renders nothing at all for both unknown and refused. One
   * control, two policies, one of them a lie.
   */
  persisted: boolean | null;
}

/**
 * The roster hub's screen. Its markup moved out of App verbatim; what changed
 * is only which handler each binding names — every `setEditingPlayer`,
 * `filtersByDiscipline`, `clearFilters` and `handleExport` reference became the
 * prop App passes in, and `communityPlayers` became the `players` prop. The
 * Split entry arrives as `onSplitMatch`, bound to App's single ad-hoc handler.
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
          {props.pendingMerge && (
            <div className="status-banner">
              <span className="status-msg">
                Import {props.pendingMerge.counts.communities} new communit{props.pendingMerge.counts.communities === 1 ? "y" : "ies"},{" "}
                {props.pendingMerge.counts.players} new player{props.pendingMerge.counts.players === 1 ? "" : "s"},{" "}
                {props.pendingMerge.counts.sessions} session{props.pendingMerge.counts.sessions === 1 ? "" : "s"},{" "}
                {props.pendingMerge.counts.tournaments} tournament{props.pendingMerge.counts.tournaments === 1 ? "" : "s"} and{" "}
                {props.pendingMerge.counts.squads} saved squad{props.pendingMerge.counts.squads === 1 ? "" : "s"}? (Existing records with the
                same id are kept.)
              </span>
              <button type="button" className="btn btn-ghost" onClick={props.onCancelMerge}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={props.onConfirmMerge}>Import</button>
            </div>
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
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void props.importFile(f);
              }}
              style={{ display: "none" }}
            />
            <div className="roster-toolbar-spacer" />
            <span className="durability-note">
              {props.persisted === true && "This browser reported persistent storage for this app on this visit. Keep a backup anyway."}
              {props.persisted === false && "This browser reports this app's data is not stored persistently. Keep a backup."}
              {props.persisted === null && "This app could not confirm persistent storage here. Keep a backup."}
            </span>
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
