import { useEffect, useState } from "react";
import type { Community, Discipline, Id, SeriesLength, Tournament, TournamentFormat } from "../domain/types";
import { validateTournamentSpec, type TournamentValidationIssue } from "./tournament-validation";

interface Props {
  tournaments: Tournament[]; // community-scoped, newest first
  disciplines: Discipline[];
  /** Squad detail "New tournament with these teams": pre-fills the create modal. */
  prefill?: { disciplineId: Id; teamCount: number } | null;
  /** Called once the prefill has been applied. */
  onPrefillConsumed?: () => void;
  onCreate: (spec: {
    name: string;
    disciplineId: Id;
    format: TournamentFormat;
    seriesLength: SeriesLength;
    teamCount: number;
    thirdPlace: boolean;
  }) => Promise<void>;
  onOpen: (id: Id) => void;
  onDelete: (id: Id) => Promise<void>;
  onManageDisciplines?: () => void;
  activeCommunity?: Community | null;
}

const FORMAT_LABEL: Record<TournamentFormat, string> = {
  series: "Series",
  "single-elim": "Single elimination",
  swiss: "Swiss",
};

const FORMATS: TournamentFormat[] = ["series", "single-elim", "swiss"];
const BO: SeriesLength[] = [1, 3, 5];

const TEAM_COUNTS: Record<TournamentFormat, number[]> = {
  series: [2],
  "single-elim": [4, 2, 8],
  swiss: [4, 6, 8],
};

const STATUS_LABEL: Record<Tournament["status"], string> = {
  draft: "Draft",
  active: "In progress",
  complete: "Complete",
};

export function GamesScreen({ tournaments, disciplines, onCreate, onOpen, onDelete, onManageDisciplines, prefill, onPrefillConsumed, activeCommunity }: Props) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [disciplineId, setDisciplineId] = useState<string>(disciplines[0]?.id ?? "");
  const [format, setFormat] = useState<TournamentFormat>("single-elim");
  const [seriesLength, setSeriesLength] = useState<SeriesLength>(3);
  const [teamCount, setTeamCount] = useState<number>(TEAM_COUNTS["single-elim"][0]);
  const [thirdPlace, setThirdPlace] = useState<boolean>(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<TournamentValidationIssue[]>([]);

  // Squad pre-fill: open the create modal with discipline + team count already set.
  useEffect(() => {
    if (!prefill) return;
    const squadFormat: TournamentFormat =
      prefill.teamCount === 2 ? "series"
      : prefill.teamCount <= 8 && TEAM_COUNTS["single-elim"].includes(prefill.teamCount) ? "single-elim"
      : "swiss";
    setCreating(true);
    setDisciplineId(prefill.disciplineId);
    setFormat(squadFormat);
    setTeamCount(prefill.teamCount);
    setSeriesLength(3);
    onPrefillConsumed?.();
  }, [prefill, onPrefillConsumed]);

  const counts = TEAM_COUNTS[format];
  const pickFormat = (f: TournamentFormat) => {
    setFormat(f);
    setTeamCount(TEAM_COUNTS[f][0]);
    setValidationErrors([]);
  };

  const submit = () => {
    if (!name.trim() || !disciplineId) return;

    const discipline = disciplines.find(d => d.id === disciplineId);
    if (!discipline) return;

    const validation = validateTournamentSpec(
      {
        name: name.trim(),
        disciplineId,
        format,
        seriesLength,
        teamCount,
      },
      discipline
    );

    if (validation.length > 0) {
      setValidationErrors(validation);
      return;
    }

    setValidationErrors([]);
    void onCreate({
      name: name.trim(),
      disciplineId,
      format,
      seriesLength,
      teamCount,
      thirdPlace: format === "single-elim" ? thirdPlace : false,
    }).then(() => {
      setName("");
      setCreating(false);
      setValidationErrors([]);
      setThirdPlace(true);
    });
  };

  return (
    <>
      <div className="kicker">Tournaments</div>
      <h1>Games</h1>
      {activeCommunity && (
        <div className="lede">
          <strong>{activeCommunity.name}</strong> · {tournaments.length} tournament{tournaments.length === 1 ? "" : "s"}
        </div>
      )}
      <div className="games-toolbar">
        <button type="button" className="btn btn-ghost" onClick={onManageDisciplines}>
          Disciplines
        </button>
      </div>
      {tournaments.length === 0 ? (
        <div className="empty">
          <div className="kicker">No games yet</div>
          <div className="big">Run a competition</div>
          <p>Create a tournament, set the format, and split your teams inside it.</p>
          <div className="actions">
            <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
              + New tournament
            </button>
          </div>
        </div>
      ) : (
        <ul className="roster">
          {tournaments.map((t) => {
            const discipline = disciplines.find((d) => d.id === t.disciplineId);
            return (
              <li
                key={t.id}
                className="row"
                role="button"
                tabIndex={0}
                onClick={() => onOpen(t.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onOpen(t.id);
                  }
                }}
              >
                <div className="who">
                  <span className="name">{t.name}</span>
                  <span className="note">
                    {discipline?.shortName ?? "Unknown"} &middot; {FORMAT_LABEL[t.format]} &middot; BO{t.seriesLength}{" "}
                    &middot; {t.teamCount} teams &middot; {STATUS_LABEL[t.status]}
                  </span>
                </div>
                <span className="row-actions">
                  <span className="chev" aria-hidden="true">
                    &#8250;
                  </span>
                  {deleteId === t.id ? (
                    <>
                      <button
                        type="button"
                        className="link danger"
                        onClick={async (e) => {
                          e.stopPropagation();
                          await onDelete(t.id);
                          setDeleteId(null);
                        }}
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        className="link"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteId(null);
                        }}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="link danger"
                      aria-label="Delete tournament"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteId(t.id);
                      }}
                    >
                      Remove
                    </button>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <div className="bar">
        <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
          New tournament
        </button>
      </div>

      {creating && (
        <div className="modal-overlay" onClick={() => setCreating(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="modal-close" aria-label="Close" onClick={() => setCreating(false)}>
              &times;
            </button>
            <h1 className="modal-title">New tournament</h1>

            {validationErrors.length > 0 && (
              <ul className="validation-errors" role="alert">
                {validationErrors.map((error, index) => (
                  <li key={index}>
                    <strong>{error.path}:</strong>
                    {error.message}
                  </li>
                ))}
              </ul>
            )}

            <div className="modal-section">
              <div className="field-label">Name</div>
              <input
                id="tournament-name"
                className="input"
                value={name}
                placeholder="e.g. Saturday futsal night"
                autoComplete="off"
                onChange={(e) => {
                  setName(e.target.value);
                  setValidationErrors([]);
                }}
              />
            </div>

            <div className="modal-section">
              <div className="field-label">Discipline</div>
              <div className="chips">
                {disciplines.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    className="chip"
                    aria-pressed={d.id === disciplineId}
                    onClick={() => {
                      setDisciplineId(d.id);
                      setValidationErrors([]);
                    }}
                  >
                    {d.shortName}
                  </button>
                ))}
              </div>
              {disciplineId && (() => {
                const d = disciplines.find(x => x.id === disciplineId);
                if (!d) return null;
                return (
                  <div className="modal-section-preview">
                    <strong>{d.name}</strong> · {d.roles.length} role{d.roles.length === 1 ? "" : "s"} · {d.attributes.length} attribute{d.attributes.length === 1 ? "" : "s"} · {d.team.minTeamSize}{d.team.maxTeamSize ? `–${d.team.maxTeamSize}` : "+"} per team
                  </div>
                );
              })()}
            </div>

            <div className="modal-section">
              <div className="field-label">Format</div>
              <div className="chips">
                {FORMATS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    className="chip"
                    aria-pressed={f === format}
                    onClick={() => pickFormat(f)}
                  >
                    {FORMAT_LABEL[f]}
                  </button>
                ))}
              </div>
            </div>

            <div className="modal-section">
              <div className="field-label">Series length</div>
              <div className="chips">
                {BO.map((n) => (
                  <button
                    key={n}
                    type="button"
                    className="chip"
                    aria-pressed={n === seriesLength}
                    onClick={() => {
                      setSeriesLength(n);
                      setValidationErrors([]);
                    }}
                  >
                    BO{n}
                  </button>
                ))}
              </div>
              <p className="modal-section-hint">
                BO{seriesLength} = {seriesLength === 1 ? "single game" : `first to ${Math.ceil(seriesLength / 2)} wins`}
              </p>
            </div>

            <div className="modal-section">
              <div className="field-label">Teams</div>
              <div className="chips">
                {[2, 4, 6, 8].map((n) => {
                  const allowed = counts.includes(n);
                  return (
                    <button
                      key={n}
                      type="button"
                      className="chip"
                      aria-pressed={n === teamCount}
                      disabled={!allowed}
                      onClick={() => {
                        if (!allowed) return;
                        setTeamCount(n);
                        setValidationErrors([]);
                      }}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
              <p className="modal-section-hint">
                {format === "series" && "Series: 2 teams only."}
                {format === "single-elim" && "Single elimination: 2, 4, or 8 teams."}
                {format === "swiss" && "Swiss: 4, 6, or 8 teams."}
              </p>
            </div>

            {format === "single-elim" && (
              <div className="modal-section">
                <label className="opt-row">
                  <input
                    type="checkbox"
                    checked={thirdPlace}
                    onChange={(e) => setThirdPlace(e.target.checked)}
                  />
                  <span>Play a 3rd-place match</span>
                </label>
              </div>
            )}

            <div className="modal-section-preview">
              <strong>{FORMAT_LABEL[format]}</strong> · {teamCount} team{teamCount === 1 ? "" : "s"}
              {format === "series" && ` · BO${seriesLength} = first to ${Math.ceil(seriesLength / 2)} wins`}
              {format === "single-elim" && ` · ${teamCount === 2 ? 1 : teamCount === 4 ? 2 : 3} round${teamCount === 8 ? "s" : ""}${thirdPlace ? " · 3rd-place match" : ""}`}
              {format === "swiss" && ` · ${teamCount === 4 ? 2 : teamCount === 6 ? 3 : 3} rounds · standings`}
            </div>

            <div className="bar">
              <button type="button" className="btn btn-ghost" onClick={() => setCreating(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!name.trim() || !disciplineId}
                onClick={submit}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}