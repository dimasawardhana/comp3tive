import { useState } from "react";
import type { Capability, Discipline, Id, Player } from "../domain/types";
import { validatePlayer, type ValidationIssue } from "../domain/validation";

interface CapabilityDraft {
  disciplineId: string;
  enabled: boolean;
  ratings: Record<string, number | null>; // attributeId -> 1-5 or null
  eligibleRoles: string[];
  preferredRole: string | null;
}

export interface PlayerFormProps {
  disciplines: Discipline[];
  /** The community a new player is created in (edits keep their own). */
  communityId: Id;
  player: Player | null; // null = new player
  onSave: (player: Player) => Promise<void>;
  onCancel: () => void;
  onDelete?: (id: string) => Promise<void>;
}

function initialDrafts(player: Player | null, disciplines: Discipline[]): CapabilityDraft[] {
  return disciplines.map((d) => {
    const cap = player?.capabilities.find((c) => c.disciplineId === d.id);
    return {
      disciplineId: d.id,
      enabled: cap !== undefined,
      ratings: Object.fromEntries(d.attributes.map((a) => [a.id, cap?.attributeRatings[a.id] ?? null])),
      eligibleRoles: cap ? [...cap.eligibleRoles] : [],
      preferredRole: cap?.preferredRole ?? null,
    };
  });
}

const RATING_SCALE = [1, 2, 3, 4, 5];

export function PlayerForm({ disciplines, communityId, player, onSave, onCancel, onDelete }: PlayerFormProps) {
  const [name, setName] = useState(player?.name ?? "");
  const [notes, setNotes] = useState(player?.notes ?? "");
  const [drafts, setDrafts] = useState<CapabilityDraft[]>(() => initialDrafts(player, disciplines));
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [nameError, setNameError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const updateDraft = (index: number, patch: Partial<CapabilityDraft>) =>
    setDrafts((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));

  const toggleEligible = (index: number, roleId: string) => {
    const d = drafts[index];
    const has = d.eligibleRoles.includes(roleId);
    const eligibleRoles = has ? d.eligibleRoles.filter((r) => r !== roleId) : [...d.eligibleRoles, roleId];
    const preferredRole = d.preferredRole === roleId ? null : d.preferredRole;
    updateDraft(index, { eligibleRoles, preferredRole });
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setNameError("Give them a name so you can tell them apart.");
      return;
    }
    setNameError(null);

    const capabilities: Capability[] = drafts
      .filter((d) => d.enabled)
      .map((d) => ({
        disciplineId: d.disciplineId,
        attributeRatings: Object.fromEntries(
          (Object.entries(d.ratings).filter(([, v]) => v !== null) as [string, number][]),
        ),
        eligibleRoles: d.eligibleRoles,
        preferredRole: d.preferredRole,
      }));

    const candidate: Player = {
      id: player?.id ?? crypto.randomUUID(),
      communityId: player?.communityId ?? communityId,
      name: name.trim(),
      notes: notes.trim() || undefined,
      capabilities,
    };

    const found = validatePlayer(candidate, disciplines);
    if (found.length > 0) {
      setIssues(found);
      return;
    }
    setIssues([]);
    setSaving(true);
    try {
      await onSave(candidate);
    } finally {
      setSaving(false);
    }
  };

  const issuesFor = (disciplineId: string): ValidationIssue[] =>
    issues.filter((i) => i.path === `capabilities[${disciplineId}]`);

  const handleDelete = () => {
    if (!player || !onDelete) return;
    if (window.confirm(`Remove ${player.name} from the squad?`)) {
      void onDelete(player.id);
    }
  };

  return (
    <>
      <h1>{player ? "Edit player" : "Add a player"}</h1>

      <div className="field">
        <label className="field-label" htmlFor="player-name">
          Name
        </label>
        <input
          id="player-name"
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Budi"
          autoComplete="off"
        />
        {nameError && <p className="field-error">{nameError}</p>}
      </div>

      <div className="field">
        <label className="field-label" htmlFor="player-notes">
          Notes
        </label>
        <input
          id="player-notes"
          className="input"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="optional"
          autoComplete="off"
        />
      </div>

      <span className="sec">Capabilities</span>
      {disciplines.map((d, index) => {
        const draft = drafts[index];
        const blockIssues = issuesFor(d.id);
        return (
          <div key={d.id} className="discipline-block">
            <label className="discipline-head">
              <input
                type="checkbox"
                checked={draft.enabled}
                onChange={(e) => updateDraft(index, { enabled: e.target.checked })}
              />
              <span>
                <span className="discipline-name">{d.name}</span>
                <span className="discipline-sub">{d.roles.map((r) => r.name).join(", ")}</span>
              </span>
            </label>

            {draft.enabled && (
              <div className="discipline-body">
                {d.attributes.map((a) => (
                  <div key={a.id} className="attr">
                    <span className="attr-label">
                      {a.name} <span className="attr-range">{a.min ?? 1}-{a.max ?? 5}</span>
                    </span>
                    <div className="rating">
                      {RATING_SCALE.map((v) => (
                        <button
                          key={v}
                          type="button"
                          className={draft.ratings[a.id] === v ? "on" : ""}
                          aria-pressed={draft.ratings[a.id] === v}
                          onClick={() => updateDraft(index, { ratings: { ...draft.ratings, [a.id]: v } })}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}

                <span className="field-label">Roles they can play</span>
                <div className="chips">
                  {d.roles.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      className="chip"
                      aria-pressed={draft.eligibleRoles.includes(r.id)}
                      onClick={() => toggleEligible(index, r.id)}
                    >
                      {r.name}
                    </button>
                  ))}
                </div>

                {draft.eligibleRoles.length > 0 && (
                  <>
                    <span className="field-label">Preferred role</span>
                    <div className="chips">
                      <button
                        type="button"
                        className="chip"
                        aria-pressed={draft.preferredRole === null}
                        onClick={() => updateDraft(index, { preferredRole: null })}
                      >
                        Any
                      </button>
                      {draft.eligibleRoles.map((roleId) => {
                        const role = d.roles.find((r) => r.id === roleId);
                        if (!role) return null;
                        return (
                          <button
                            key={roleId}
                            type="button"
                            className="chip"
                            aria-pressed={draft.preferredRole === roleId}
                            onClick={() =>
                              updateDraft(index, {
                                preferredRole: draft.preferredRole === roleId ? null : roleId,
                              })
                            }
                          >
                            {role.name}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}

                {blockIssues.length > 0 && (
                  <ul className="field-error-list">
                    {blockIssues.map((issue, i) => (
                      <li key={i}>{issue.message}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        );
      })}

      {player && onDelete && (
        <button type="button" className="btn btn-danger-ghost" onClick={handleDelete}>
          Remove {player.name}
        </button>
      )}

      <div className="bar">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save player"}
        </button>
      </div>
    </>
  );
}
