import { useState, useEffect } from "react";
import type { Capability, Discipline, Id, Player } from "../domain/types";
import { ConfirmButton } from "../ui/ConfirmButton";
import { validatePlayer, type ValidationIssue } from "../domain/validation";
import { Modal } from "../ui/Modal";
import { attributeBounds, attributeScale, middleOf } from "./BulkRateModal";

interface Props {
  player: Player | null; // null = new player
  disciplines: Discipline[];
  communityId: Id;
  onClose: () => void;
  onSave: (player: Player) => Promise<void>;
  onDelete?: (id: Id) => Promise<void>;
}

type CapDraft = {
  disciplineId: Id;
  ratings: Record<Id, number>;
  eligibleRoles: Id[];
  preferredRole: Id | null;
};

/**
 * A new capability opens on the middle of each attribute's own scale, not on a
 * literal `3`.
 *
 * The `3` this replaces was correct for all three seeded disciplines and wrong
 * for any other: `DisciplineEditModal` lets a person add a discipline whose
 * attributes start at `4` (`src/domain/DisciplineEditModal.tsx:67` hardcodes
 * `{min:1,max:5}` today and offers no bounds input), and then this wrote a
 * rating that `validateCapability` refuses — so a player who was given a
 * capability in that discipline could not be saved at all until someone guessed
 * which button to press. A rating the discipline never declared is not a
 * default, it is a blocked save.
 */
const emptyCap = (disciplineId: Id, discipline: Discipline | undefined): CapDraft => ({
  disciplineId,
  ratings: discipline
    ? Object.fromEntries(discipline.attributes.map((a) => [a.id, middleOf(a)])) as Record<Id, number>
    : {},
  eligibleRoles: discipline ? discipline.roles.map((r) => r.id) : [],
  preferredRole: null,
});

const draftFromPlayer = (player: Player): CapDraft[] =>
  player.capabilities.map((c) => {
    return {
      disciplineId: c.disciplineId,
      ratings: { ...c.attributeRatings },
      eligibleRoles: [...c.eligibleRoles],
      preferredRole: c.preferredRole,
    };
  });

export function PlayerEditModal({ player, disciplines, communityId, onClose, onSave, onDelete }: Props) {
  const isEdit = player !== null;
  const [name, setName] = useState(player?.name ?? "");
  const [notes, setNotes] = useState(player?.notes ?? "");
  const [caps, setCaps] = useState<CapDraft[]>(
    player ? draftFromPlayer(player) : []
  );
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (player) {
      setName(player.name);
      setNotes(player.notes ?? "");
      setCaps(draftFromPlayer(player));
    }
  }, [player]);

  const usedDisciplineIds = new Set(caps.map((c) => c.disciplineId));
  const availableDisciplines = disciplines.filter((d) => !usedDisciplineIds.has(d.id));

  const addCapability = (disciplineId: Id) => {
    const d = disciplines.find((x) => x.id === disciplineId);
    if (!d) return;
    setCaps((prev) => [...prev, emptyCap(disciplineId, d)]);
  };

  const removeCapability = (disciplineId: Id) => {
    setCaps((prev) => prev.filter((c) => c.disciplineId !== disciplineId));
  };

  const setRating = (disciplineId: Id, attributeId: Id, value: number) => {
    setCaps((prev) =>
      prev.map((c) =>
        c.disciplineId === disciplineId
          ? { ...c, ratings: { ...c.ratings, [attributeId]: value } }
          : c,
      ),
    );
  };

  const toggleRole = (disciplineId: Id, roleId: Id) => {
    setCaps((prev) =>
      prev.map((c) => {
        if (c.disciplineId !== disciplineId) return c;
        const has = c.eligibleRoles.includes(roleId);
        const eligibleRoles = has
          ? c.eligibleRoles.filter((r) => r !== roleId)
          : [...c.eligibleRoles, roleId];
        const preferredRole = has && c.preferredRole === roleId ? null : c.preferredRole;
        return { ...c, eligibleRoles, preferredRole };
      }),
    );
  };

  const setPreferred = (disciplineId: Id, roleId: Id | null) => {
    setCaps((prev) =>
      prev.map((c) => (c.disciplineId === disciplineId ? { ...c, preferredRole: roleId } : c)),
    );
  };

  const buildCapabilities = (): Capability[] =>
    caps.map((c) => {
      const eligibleRoles = c.eligibleRoles.length > 0
        ? c.eligibleRoles
        : (disciplines.find((d) => d.id === c.disciplineId)?.roles.map((r) => r.id) ?? []);
      const preferredRole =
        c.preferredRole && eligibleRoles.includes(c.preferredRole) ? c.preferredRole : null;
      return {
        disciplineId: c.disciplineId,
        attributeRatings: c.ratings,
        eligibleRoles,
        preferredRole,
      };
    });

  const save = async () => {
    const capabilities = buildCapabilities();
    const draft: Player = {
      id: player?.id ?? crypto.randomUUID(),
      communityId,
      name: name.trim(),
      notes: notes.trim() || undefined,
      capabilities,
    };
    const problems = validatePlayer(draft, disciplines);
    if (problems.length > 0) {
      setIssues(problems);
      return;
    }
    setIssues([]);
    setSaving(true);
    try {
      await onSave(draft);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!player || !onDelete) return;
    setSaving(true);
    try {
      await onDelete(player.id);
      onClose();
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
          {isEdit ? "Edit player" : "Add player"}
        </h1>

        <div className="field">
          <label className="field-label" htmlFor="player-name">Name</label>
          <input
            id="player-name"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Kairi"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && void save()}
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="player-notes">Notes (optional)</label>
          <input
            id="player-notes"
            className="input"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. ONIC · Jungle"
          />
        </div>
        <div className="modal-section">
          <div className="modal-section-title">
            <span>Capabilities</span>
            <span className="count">{caps.length} added</span>
          </div>
          {caps.length === 0 ? (
            <p className="status">No capabilities yet. Add one to enable splitting in that discipline.</p>
          ) : (
          <div className="cap-list">
            {caps.map((cap) => {
              const d = disciplines.find((x) => x.id === cap.disciplineId);
              if (!d) return null;
              return (
                <div key={cap.disciplineId} className="cap-card">
                  <div className="cap-head">
                    <span className="chip chip--tag">{d.shortName}</span>
                    <button
                      type="button"
                      className="icon-btn icon-btn-danger small"
                      aria-label={`Remove ${d.shortName} capability`}
                      onClick={() => removeCapability(cap.disciplineId)}
                    >
                      ✕
                    </button>
                  </div>

                  {/*
                   * The scale is the discipline's, read through the same three
                   * helpers the bulk rate uses, so the two rating surfaces
                   * cannot answer differently for the same person. Both the
                   * buttons and the `?? middleOf(a)` fallbacks moved: a
                   * capability whose ratings lack the attribute — a record from
                   * a hand-edited backup, or one the app did not write — used
                   * to display as `3` and press no button at all on a scale
                   * that does not contain 3. `middleOf` is always a step the
                   * scale can show, or the midpoint of bounds the discipline
                   * declared, so one of the two controls is always pressed.
                   */}
                  <div className="cap-ratings">
                    {d.attributes.map((a) => {
                      const steps = attributeScale(a);
                      const { min, max } = attributeBounds(a);
                      const current = cap.ratings[a.id] ?? middleOf(a);
                      return (
                        <div key={a.id} className="rating-row">
                          <span className="rating-label">{a.name}</span>
                          {steps.length > 0 ? (
                            <div className="rating-buttons">
                              {steps.map((n) => (
                                <button
                                  key={n}
                                  type="button"
                                  className={`rating-btn ${current === n ? "on" : ""}`}
                                  onClick={() => setRating(cap.disciplineId, a.id, n)}
                                  aria-label={`${a.name} ${n}`}
                                  aria-pressed={current === n}
                                >
                                  {n}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <input
                              className="input rating-number"
                              type="number"
                              min={min}
                              max={max}
                              value={current}
                              aria-label={`${a.name} rating`}
                              onChange={(e) => {
                                const next = Number(e.target.value);
                                if (e.target.value.trim() === "" || !Number.isFinite(next)) return;
                                setRating(cap.disciplineId, a.id, next);
                              }}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="cap-roles">
                    <span className="field-label">Eligible roles</span>
                    <div className="chips">
                      {d.roles.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          className="chip"
                          aria-pressed={cap.eligibleRoles.includes(r.id)}
                          onClick={() => toggleRole(cap.disciplineId, r.id)}
                        >
                          {r.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="cap-pref">
                    <label className="field-label" htmlFor={`pref-${cap.disciplineId}`}>
                      Preferred role
                    </label>
                    <select
                      id={`pref-${cap.disciplineId}`}
                      className="input"
                      value={cap.preferredRole ?? ""}
                      onChange={(e) =>
                        setPreferred(cap.disciplineId, e.target.value || null)
                      }
                    >
                      <option value="">— None —</option>
                      {cap.eligibleRoles.map((rid) => {
                        const r = d.roles.find((x) => x.id === rid);
                        return r ? <option key={r.id} value={r.id}>{r.name}</option> : null;
                      })}
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        </div>

        {availableDisciplines.length > 0 && (
          <div className="add-cap">
            <span className="field-label">Add a capability</span>
            <div className="chips">
              {availableDisciplines.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className="chip"
                  onClick={() => addCapability(d.id)}
                >
                  + {d.shortName}
                </button>
              ))}
            </div>
          </div>
        )}

        {issues.length > 0 && (
          <ul className="field-errors">
            {issues.map((iss, i) => (
              <li key={i} className="field-error">{iss.message}</li>
            ))}
          </ul>
        )}

        <div className="bar">
          {isEdit && onDelete ? (
            <ConfirmButton
              disabled={saving}
              label="Delete"
              confirmLabel="Delete player"
              message={`Delete player "${player.name}"?`}
              onConfirm={() => void remove()}
            />
          ) : (
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
              Cancel
            </button>
          )}
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void save()}
            disabled={saving || !name.trim()}
          >
            {saving ? "Saving…" : isEdit ? "Save changes" : "Add player"}
          </button>
        </div>
    </Modal>
  );
}
