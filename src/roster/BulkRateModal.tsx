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
 * **`[]` means the discipline wants a number field, and it covers three cases.**
 * A range with no whole number in it (`0.5`-`0.75` is a scale nobody can tick);
 * a range too wide to be a row of buttons (`0`-`1000` is a thousand buttons in a
 * dialog); and a range with a *fractional* end — `1`-`3.5` is the one that bites.
 * Its whole steps are `1, 2, 3`, so `3.5` is legal to `validateCapability` and
 * unreachable by any button, and a capability already holding `3.5` would open
 * with nothing pressed while this module's own comment promised a pressed step.
 * A scale the buttons cannot say all of is a scale the buttons must not claim to
 * say, so a fractional end sends the whole attribute to the field.
 *
 * None of the three is reachable from the seeded catalog and all three are legal
 * on `Attribute`, which is the whole reason the control asks the discipline
 * instead of assuming the range it ships with today.
 */
export function attributeScale(attribute: Attribute): number[] {
  const { min, max } = attributeBounds(attribute);
  if (!Number.isInteger(min) || !Number.isInteger(max)) return [];
  if (max - min >= MAX_SCALE_BUTTONS) return [];
  const steps: number[] = [];
  for (let n = min; n <= max; n++) steps.push(n);
  return steps;
}

/**
 * The step halfway up an attribute's own scale: the value a rating control
 * opens on when there is nothing better to open on.
 *
 * Exported because the single-player editor opens on it too, for the same
 * reason: a literal `3` is a rating the discipline never declared, and on a
 * discipline whose scale starts at `4` it is a rating `validateCapability`
 * refuses — so a player who was given a new capability could not save at all
 * until someone guessed which button to press. A step on the scale, or, when
 * there is no step, the midpoint of the bounds the discipline did declare.
 */
export function middleOf(attribute: Attribute): number {
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
 *
 * **The clause is a property of the rating set, not of today's strength model,
 * and it is the one sentence here that could quietly become false.** Every
 * selected player ends this write holding the same ratings for this discipline,
 * and `StrengthModel` is a union of pure functions of those ratings
 * (`src/domain/types.ts:101-105`) — equal inputs, equal output, whichever arm
 * runs. That is why no guard is written here: with `kind: "mean"` the only
 * member (`src/domain/types.ts:105`), a `kind === "mean"` test could not be
 * exercised by any test, so it would ship as an assertion nothing could fail.
 *
 * **To whoever adds the second kind — a weighted model, a positional penalty:**
 * re-read this. If a new `StrengthModel` is still a pure function of one
 * capability's ratings, this sentence stands as written and there is nothing to
 * do. If the new kind reads anything else — a roster, a role, the number of
 * players, a state outside `Capability` — then "their strength there is now the
 * same" is a false claim, and the fix is to say what is actually true rather
 * than to delete the clause: the ratings are identical, so the sentence must
 * name the ratings and drop the consequence. Nothing in the test suite will fail
 * on that day, which is exactly why the warning is here.
 */
export function rateConfirmation(discipline: Discipline, ratings: Record<Id, number>, count: number): string {
  const what = discipline.attributes.map((a) => `${a.name} ${ratings[a.id]}`).join(", ");
  const scope = `on the ${count} selected player${count === 1 ? "" : "s"} in ${discipline.name}`;
  return count === 1
    ? `This app set ${what} ${scope}.`
    : `This app set ${what} ${scope}, so their strength there is now the same.`;
}

/**
 * Every reason this write would be refused, as `validatePlayer` wrote it.
 *
 * This is the *messages* half of the refusal, and it is kept separate from the
 * half a person sees because the two are checkable in different ways:
 * `RefusalAlert` below renders what these strings become, and that is the part
 * a test asserts with `renderToStaticMarkup`. Splitting them is what lets the
 * rendered surface be covered at all — the list is gated on a click, and node
 * has no click.
 *
 * It takes the players `ratePlayers` already built, not the inputs to build
 * them, so the dialog rates a set once and validates that same set and a test
 * can drive the pair exactly the way `apply` does.
 *
 * **The message is pushed verbatim, with no player name in front of it**, the
 * way `PlayerEditModal` renders it (`src/roster/PlayerEditModal.tsx:294-299`).
 * This dialog builds every capability it writes from one discipline and one set
 * of numbers, so a name would prefix one sentence once per selected player, and
 * twelve lines of the same sentence is how a refusal gets skimmed.
 */
export function rateProblems(updated: Player[], disciplines: Discipline[]): string[] {
  const messages = updated.flatMap((player) => validatePlayer(player, disciplines).map((issue) => issue.message));
  // Distinct, in the order they were met. One write from one discipline's
  // numbers fails the same way for every player it touches, so twelve
  // identical lines is a list that reads as twelve problems and is one.
  return [...new Set(messages)];
}

/**
 * The refusal list — the one thing on this surface that tells a user their input
 * was not accepted.
 *
 * **It is its own component because it is the only part of a refusal a test can
 * see, and that is not the same as the only part that matters.** The list is
 * gated on state that only a click reaches, and this project's unit environment
 * is `node` (`vitest.config.ts`), where `renderToStaticMarkup` runs a component
 * but no effect and no handler — so a test cannot press the button that fills
 * this list. It *can* render this element, which is why the markup a refused
 * write puts in front of a user is pinned here in `BulkRateModal.test.ts`
 * rather than left to be checked by the two functions that produce it: a test
 * that only asserted `rateProblems` would still pass if `role="alert"` were
 * deleted, and a refusal nothing announces is not a refusal the user was told.
 *
 * `role="alert"` is what makes it announced; the class is the app's own, shared
 * with the single-player editor (`src/roster/PlayerEditModal.tsx:340-345`), so
 * the two refusals are styled and read by one set of rules.
 */
export function RefusalAlert({ issues }: { issues: readonly string[] }) {
  if (issues.length === 0) return null;
  return (
    <ul className="field-errors" role="alert">
      {issues.map((issue, i) => (
        <li key={i} className="field-error">{issue}</li>
      ))}
    </ul>
  );
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
    // Every touched player is validated before the first one is written, so a
    // refusal is a refusal of the whole set.
    const updated = ratePlayers(players, discipline, ratings);
    const problems = rateProblems(updated, disciplines);
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

      <RefusalAlert issues={issues} />

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
                with every role open and no preferred role, the same as a row from a CSV import.
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
                  <span className="derived-label">Strength after applying</span>
                  <span className="derived-value" aria-live="polite">{strength.toFixed(1)}</span>
                </div>
              )}
              {/* The label says *after applying* because with a set that
                  disagrees with itself the number belongs to nobody on screen:
                  it is what the roster will say once these numbers are saved,
                  not what any one selected player has today. The note below
                  repeats the derivation, and the two together are one claim. */}
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
