import { useEffect, useState } from "react";
import type { Community, Discipline, Id, SeriesLength, Tournament, TournamentFormat } from "../domain/types";
import { validateTournamentSpec, type TournamentValidationIssue } from "./tournament-validation";
import { roundRobinRounds } from "../data/round-robin";
import { PageHeader } from "../ui/PageHeader";
import { FORMAT_LABEL, SELECTABLE_FORMATS, STATUS_LABEL } from "../ui/constants";
import { Modal } from "../ui/Modal";

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

// The chips come from `SELECTABLE_FORMATS` (src/ui/constants.ts): a format is
// offered when the app can run it, not when the domain can name it.
const BO: SeriesLength[] = [1, 3, 5];

/**
 * The team counts each format offers, in the order the chips read them.
 *
 * One rule, two copies: this table says which count chips are enabled, and
 * `getValidTeamCounts` in tournament-validation.ts says what the validator
 * accepts. `team-counts.test.ts` imports this table and asserts the two agree,
 * because a chip the validator rejects is a create that fails on the floor and
 * a count the validator takes that no chip offers is a format nothing can run.
 *
 * The **first** entry is the count a format opens on, so the order is a product
 * decision rather than part of the rule: single elimination opens on 4, since
 * a two-team single elimination is a Series with extra steps.
 */
export const TEAM_COUNTS: Record<TournamentFormat, number[]> = {
  series: [2],
  "single-elim": [4, 2, 8],
  swiss: [4, 6, 8],
  // What the circle method can schedule, 3 to 8. The odd counts stay because a
  // bye is a real fixture: it is the empty slot the ring already carries, it
  // hands out no result, and over the n rounds every team rests on exactly one.
  "round-robin": [3, 4, 5, 6, 7, 8],
};

/**
 * The row of count chips: every count any format takes, ascending, so a chip
 * exists for each one and the formats that refuse it render it disabled.
 *
 * Computed from `TEAM_COUNTS` rather than written out as a second list, because
 * that row is the one a visitor sees: it is how a 3- or 5-team night discovers
 * the format is playable at all. A count a format takes is a chip, and a count
 * no format takes is not on the row to begin with.
 */
const COUNT_CHIPS: readonly number[] = [...new Set(Object.values(TEAM_COUNTS).flat())].sort(
  (a, b) => a - b,
);

/**
 * The format that takes `n` split teams, read off the same two tables the
 * modal's chips are rendered from, so a squad of any supported count pre-fills
 * into a tournament that can actually be created.
 *
 * 2 is a Series, 4 and 8 a single elimination, 6 a Swiss — all exactly as
 * before. What changes is 3, 5 and 7: they used to pre-fill as Swiss, which the
 * validator then refused, so those squads dead-ended on a tournament the app
 * could have run. Round robin is the only format that takes every count from 3
 * to 8, so each count now lands on the one format that takes it.
 *
 * A one-team squad fits no format at all; Swiss is the fallback because its
 * rule is the one the validator's own message will quote, and no tournament is
 * created either way.
 */
export const formatForTeamCount = (n: number): TournamentFormat =>
  SELECTABLE_FORMATS.find((f) => TEAM_COUNTS[f].includes(n)) ?? "swiss";

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
    setCreating(true);
    setDisciplineId(prefill.disciplineId);
    setFormat(formatForTeamCount(prefill.teamCount));
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
      <PageHeader
        kicker="Tournaments"
        title="Games"
        lede={
          activeCommunity && (
            <>
              <strong>{activeCommunity.name}</strong> · {tournaments.length} tournament
              {tournaments.length === 1 ? "" : "s"}
            </>
          )
        }
      />
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
        <Modal onClose={() => setCreating(false)}>
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
                {SELECTABLE_FORMATS.map((f) => (
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
                {COUNT_CHIPS.map((n) => {
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
                {format === "round-robin" && "Round robin: 3 to 8 teams, odd counts included."}
              </p>
              {format === "round-robin" && teamCount % 2 === 1 && (
                <p className="modal-section-hint">
                  {teamCount} teams is an odd field, so one team sits out each round. Every team rests
                  exactly once, and a bye is not a loss.
                </p>
              )}
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
              {format === "round-robin" && ` · ${roundRobinRounds(teamCount)} rounds · every team plays every other`}
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
        </Modal>
      )}
    </>
  );
}