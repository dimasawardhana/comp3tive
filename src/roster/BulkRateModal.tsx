import { useState } from "react";
import type { Attribute, Capability, Discipline, Id, Player } from "../domain/types";
import { computeStrength } from "../domain/strength";
import { validatePlayer } from "../domain/validation";
import { Modal } from "../ui/Modal";

interface Props {
  /** The catalog, in the order the app shows it. */
  disciplines: Discipline[];
  /**
   * Exactly the selected players. The rate set is this array and nothing else:
   * the roster decides it, so what the button said it would write and what gets
   * written cannot come apart.
   */
  players: Player[];
  /** The active filter's discipline when there is exactly one; else null. */
  defaultDisciplineId: Id | null;
  /**
   * Called with the whole set, already rated. The caller writes it through the
   * app's own save path, so the in-memory roster, the store and the CSV
   * importer's idea of a player stay one list.
   */
  onApply: (updated: Player[], discipline: Discipline, ratings: Record<Id, number>) => Promise<void>;
  onClose: () => void;
}

/**
 * Above this many whole steps an attribute gets a number field instead of a row
 * of buttons. `0`-`1000` is a legal `Attribute` and a thousand buttons in a
 * dialog is not a control, it is a wall.
 */
const MAX_SCALE_BUTTONS = 12;

/**
 * An attribute's own bounds. `min` and `max` are optional on `Attribute` and
 * default to 1 and 5 (`src/domain/types.ts:87-88`), so every reader of them has
 * to say the default out loud; this is the one place in the rating UI that does.
 * All three seeded disciplines leave both unset and land on 1-5
 * (`src/domain/seed.ts:22-26`, `:43-48`, `:61-65`), which is a coincidence of
 * today's catalog and not a fact about attributes: a fourth discipline is free
 * to declare `0`-`10`, and `validateCapability` already grades a rating against
 * the discipline's own numbers rather than against 5
 * (`src/domain/validation.ts:42-43`).
 */
export function attributeBounds(attribute: Attribute): { min: number; max: number } {
  return { min: attribute.min ?? 1, max: attribute.max ?? 5 };
}

/**
 * The whole-number steps of an attribute's own scale, or `[]` when a row of
 * buttons would be the wrong control.
 *
 * `[]` means two different things and both mean "use the number field": a range
 * with no whole number in it (`0.5`-`0.75` is a scale nobody can tick), and a
 * range too wide to be a row of buttons. Neither is reachable from the seeded
 * catalog and both are legal on `Attribute`, which is the whole reason the
 * control asks the discipline instead of assuming the range it ships with today.
 */
export function attributeScale(attribute: Attribute): number[] {
  const { min, max } = attributeBounds(attribute);
  const lo = Math.ceil(min);
  const hi = Math.floor(max);
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi - lo >= MAX_SCALE_BUTTONS) return [];
  const steps: number[] = [];
  for (let n = lo; n <= hi; n++) steps.push(n);
  return steps;
}

/** The step halfway up an attribute's own scale: the value the dialog opens on. */
function middleOf(attribute: Attribute): number {
  const { min, max } = attributeBounds(attribute);
  const steps = attributeScale(attribute);
  if (steps.length > 0) return steps[Math.floor((steps.length - 1) / 2)];
  return (min + max) / 2;
}

/**
 * The rating each field opens on.
 *
 * A value every player in the set already carries is the honest starting point:
 * opening the dialog and pressing the button then changes nothing, which is what
 * a user who only meant to look expects. Anything else — a set that disagrees
 * with itself, or a player with no capability in this discipline at all — starts
 * at the middle of the attribute's own range, which is a proposal and not a
 * reading of anybody's file. It is a step *on the scale*, so the buttons never
 * open with nothing pressed.
 *
 * An agreed value that is already out of the discipline's bounds is left as it
 * is. The write is then refused by `validatePlayer` and the modal says why,
 * which is the honest outcome for data the app did not write; clamping it here
 * would invent a rating and hide the bad record.
 */
export function startingRatings(discipline: Discipline, players: Player[]): Record<Id, number> {
  const ratings: Record<Id, number> = {};
  for (const attribute of discipline.attributes) {
    const seen = new Set<number>();
    for (const player of players) {
      const cap = player.capabilities.find((c) => c.disciplineId === discipline.id);
      const value = cap?.attributeRatings[attribute.id];
      if (value !== undefined) seen.add(value);
    }
    ratings[attribute.id] = seen.size === 1 ? [...seen][0] : middleOf(attribute);
  }
  return ratings;
}

/**
 * The roster this dialog would write.
 *
 * **A player who already has the capability in this discipline keeps their own
 * roles.** Only the ratings change, which is the same rule the backup merge
 * states as "add only new ids, never overwrite"
 * (`src/shell/usePlayerImport.ts:256`) and the merge banner states to the user
 * as "Existing records with the same id are kept"
 * (`src/shell/RosterScreen.tsx:425`). A write is not entitled to a field it was
 * not asked about, however many players it is written to at once: rating eight
 * players' fitness must not quietly make all eight eligible for every role.
 *
 * **A player with no capability in this discipline gains one**, holding the same
 * values `csvRowsToPlayers` writes for a CSV row naming this discipline
 * (`src/data/player-import.ts:204-211`): every role eligible, no preferred role.
 * The importer made this decision once and this path must not make it a second,
 * different one — a player who gained roles by being rated and lost them by
 * being imported would be the same person with two records. The dialog says so
 * before the write, not after.
 */
export function ratePlayers(
  players: Player[],
  discipline: Discipline,
  ratings: Record<Id, number>,
): Player[] {
  return players.map((player) => {
    const existing = player.capabilities.find((c) => c.disciplineId === discipline.id);
    if (!existing) {
      return {
        ...player,
        capabilities: [
          ...player.capabilities,
          {
            disciplineId: discipline.id,
            attributeRatings: { ...ratings },
            eligibleRoles: discipline.roles.map((r) => r.id),
            preferredRole: null,
          },
        ],
      };
    }
    const capability: Capability = {
      ...existing,
      attributeRatings: { ...existing.attributeRatings, ...ratings },
    };
    return {
      ...player,
      capabilities: player.capabilities.map((c) => (c.disciplineId === discipline.id ? capability : c)),
    };
  });
}

/**
 * What the write did, in one sentence, in the shape the import report's headline
 * settled on: this app did it, the count is there, and the consequence is said
 * rather than left to be discovered.
 *
 * **The clause about equal strength is not decoration.** A bulk write sets every
 * attribute of one discipline to one number for every selected player, so after
 * it, every one of them reads the same strength in that discipline. "Rated 8
 * players" reads as eight separate judgements; they are one judgement written
 * eight times, and the sentence is where that is said out loud. It is dropped
 * for a single player, where "the same" has nobody to be the same as.
 */
export function rateConfirmation(discipline: Discipline, ratings: Record<Id, number>, count: number): string {
  const what = discipline.attributes.map((a) => `${a.name} ${ratings[a.id]}`).join(", ");
  const scope = `on the ${count} selected player${count === 1 ? "" : "s"} in ${discipline.name}`;
  return count === 1
    ? `This app set ${what} ${scope}.`
    : `This app set ${what} ${scope}, so their strength there is now the same.`;
}

/**
 * Rate a set of players in one discipline, from the roster's own selection.
 *
 * **What a person sets here is the attributes; the strength is this app's
 * answer.** `computeStrength` derives it from those ratings on every read and
 * nothing anywhere stores it (`src/domain/strength.ts:11-19`), so a control
 * labelled "strength" would be asking for a number this dialog would overwrite
 * the moment it closed. The derived value is shown instead, as a readout with
 * no control in it, next to the sentence that says where it comes from and that
 * it cannot be edited here.
 *
 * The write is validated in full before the first player is saved, so a set that
 * would break an invariant is refused as a set rather than half-written.
 */
export function BulkRateModal({ disciplines, players, defaultDisciplineId, onApply, onClose }: Props) {
  const [disciplineId, setDisciplineId] = useState<Id>(defaultDisciplineId ?? disciplines[0]?.id ?? "");
  const discipline = disciplines.find((d) => d.id === disciplineId);
  const [ratings, setRatings] = useState<Record<Id, number>>(() =>
    discipline ? startingRatings(discipline, players) : {},
  );
  const [issues, setIssues] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  /** Switching discipline re-seeds the fields from the new discipline's own attributes. */
  const pickDiscipline = (id: Id) => {
    const next = disciplines.find((d) => d.id === id);
    setDisciplineId(id);
    setIssues([]);
    setRatings(next ? startingRatings(next, players) : {});
  };

  /**
   * The strength this app will report for the numbers in the fields. Built as a
   * real capability — the discipline's own roles, no preference — because that
   * is what `computeStrength` is handed everywhere else, and because a value
   * derived from a throwaway object is a value nobody can check.
   */
  const derived: Capability | null = discipline
    ? {
        disciplineId: discipline.id,
        attributeRatings: ratings,
        eligibleRoles: discipline.roles.map((r) => r.id),
        preferredRole: null,
      }
    : null;
  const strength = discipline && derived ? computeStrength(discipline, derived) : null;
  const nothingToRate = discipline !== undefined && discipline.attributes.length === 0;

  const apply = async () => {
    if (!discipline) return;
    const updated = ratePlayers(players, discipline, ratings);
    // Every touched player is validated before the first one is written, so a
    // refusal is a refusal of the whole set.
    const problems: string[] = [];
    for (const player of updated) {
      for (const issue of validatePlayer(player, disciplines)) problems.push(`${player.name}: ${issue.message}`);
    }
    if (problems.length > 0) {
      setIssues(problems);
      return;
    }
    setIssues([]);
    setSaving(true);
    try {
      await onApply(updated, discipline, ratings);
      onClose();
    } catch {
      // The caller already said what went wrong, on the app's own toast. The
      // dialog stays open so the numbers are not retyped, and nothing is
      // written twice: the failure path is the caller's, and it has already
      // counted what did land.
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose}>
      <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>
        &times;
      </button>
      <h1 className="modal-title">
        Rate {players.length} player{players.length === 1 ? "" : "s"}
      </h1>

      {issues.length > 0 && (
        <ul className="field-errors" role="alert">
          {issues.map((issue, i) => (
            <li key={i} className="field-error">{issue}</li>
          ))}
        </ul>
      )}

      <div className="modal-section">
        <div className="modal-section-title"><span>Discipline</span></div>
        <div className="chips">
          {disciplines.map((d) => (
            <button
              key={d.id}
              type="button"
              className="chip"
              aria-pressed={d.id === disciplineId}
              onClick={() => pickDiscipline(d.id)}
            >
              {d.shortName}
            </button>
          ))}
        </div>
      </div>

      {discipline && (
        <div className="modal-section">
          <div className="modal-section-title"><span>Ratings</span></div>
          {nothingToRate ? (
            <p className="status">This discipline has no attributes, so there is nothing to rate.</p>
          ) : (
            <>
              <p className="modal-banner modal-banner-info">
                Every player you selected is set to the same number in each row, so they will all read
                the same strength in this discipline. Players who do not play it yet are added to it,
                with every role open and no preferred role — the same as a row from a CSV import.
              </p>
              <div className="rate-group">
                {discipline.attributes.map((attribute) => {
                  const steps = attributeScale(attribute);
                  const labelId = `rate-attr-${attribute.id}`;
                  const { min, max } = attributeBounds(attribute);
                  return (
                    <div key={attribute.id} className="rating-row">
                      <span className="rating-label" id={labelId}>{attribute.name}</span>
                      {steps.length > 0 ? (
                        <div className="rating-buttons" role="group" aria-labelledby={labelId}>
                          {steps.map((n) => (
                            <button
                              key={n}
                              type="button"
                              className={`rating-btn ${ratings[attribute.id] === n ? "on" : ""}`}
                              aria-label={`${attribute.name} ${n}`}
                              aria-pressed={ratings[attribute.id] === n}
                              onClick={() => {
                                setIssues([]);
                                setRatings((prev) => ({ ...prev, [attribute.id]: n }));
                              }}
                            >
                              {n}
                            </button>
                          ))}
                        </div>
                      ) : (
                        /* No whole steps on this attribute's own scale, so the
                           row of buttons would be empty: a number field
                           carrying the discipline's own bounds instead. An
                           emptied field keeps the last number rather than
                           becoming a blank rating, which the validation below
                           would only refuse anyway. */
                        <input
                          className="input rating-number"
                          type="number"
                          min={min}
                          max={max}
                          value={ratings[attribute.id] ?? min}
                          aria-label={`${attribute.name} rating`}
                          onChange={(e) => {
                            const next = Number(e.target.value);
                            if (e.target.value.trim() === "" || !Number.isFinite(next)) return;
                            setIssues([]);
                            setRatings((prev) => ({ ...prev, [attribute.id]: next }));
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
              {strength !== null && (
                <div className="derived-readout">
                  <span className="derived-label">Strength</span>
                  <span className="derived-value" aria-live="polite">{strength.toFixed(1)}</span>
                </div>
              )}
              <p className="derived-note">
                Strength is worked out by this app from the ratings above. It is not stored, and it
                cannot be edited here.
              </p>
            </>
          )}
        </div>
      )}

      <div className="modal-actions">
        <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={saving || players.length === 0 || !discipline || nothingToRate}
          onClick={() => void apply()}
        >
          {saving ? "Saving…" : `Rate ${players.length} player${players.length === 1 ? "" : "s"}`}
        </button>
      </div>
    </Modal>
  );
}
