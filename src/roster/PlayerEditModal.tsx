import { useState, useEffect } from "react";
import type { Capability, Discipline, Id, Player } from "../domain/types";
import { validatePlayer, type ValidationIssue } from "../domain/validation";

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

const emptyCap = (disciplineId: Id, discipline: Discipline | undefined): CapDraft => ({
  disciplineId,
  ratings: discipline
    ? Object.fromEntries(discipline.attributes.map((a) => [a.id, 3])) as Record<Id, number>
    : {},
  eligibleRoles: discipline ? discipline.roles.map((r) => r.id) : [],
  preferredRole: null,
});

const draftFromPlayer = (player: Player, disciplines: Discipline[]): CapDraft[] =>
  player.capabilities.map((c) => {
    const d = disciplines.find((x) => x.id === c.disciplineId);
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
    player ? draftFromPlayer(player, disciplines) : []
  );
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (player) {
      setName(player.name);
      setNotes(player.notes ?? "");
      setCaps(draftFromPlayer(player, disciplines));
    }
  }, [player, disciplines]);

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
    if (!window.confirm(`Delete player "${player.name}"?`)) return;
    setSaving(true);
    try {
      await onDelete(player.id);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
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

                  <div className="cap-ratings">
                    {d.attributes.map((a) => (
                      <div key={a.id} className="rating-row">
                        <span className="rating-label">{a.name}</span>
                        <div className="rating-buttons">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <button
                              key={n}
                              type="button"
                              className={`rating-btn ${(cap.ratings[a.id] ?? 3) === n ? "on" : ""}`}
                              onClick={() => setRating(cap.disciplineId, a.id, n)}
                              aria-label={`${a.name} ${n}`}
                              aria-pressed={(cap.ratings[a.id] ?? 3) === n}
                            >
                              {n}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
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
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => void remove()}
              disabled={saving}
            >
              Delete
            </button>
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
      </div>
    </div>
  );
}
