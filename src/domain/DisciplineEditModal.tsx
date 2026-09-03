import { useState, useEffect } from "react";
import type { Attribute, Discipline, Id, Role } from "../domain/types";

interface Props {
  discipline: Discipline | null; // null = new
  existingIds: Id[]; // for slug uniqueness
  onClose: () => void;
  onSave: (d: Discipline) => Promise<void>;
  onDelete?: (id: Id) => Promise<void>;
}

const slugify = (s: string): string =>
  s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const uniqueSlug = (base: string, existingIds: Id[], excludeId?: Id): string => {
  const baseSlug = base || "discipline";
  if (!existingIds.includes(baseSlug) || baseSlug === excludeId) return baseSlug;
  let n = 2;
  while (existingIds.includes(`${baseSlug}-${n}`)) n++;
  return `${baseSlug}-${n}`;
};

export function DisciplineEditModal({
  discipline,
  existingIds,
  onClose,
  onSave,
  onDelete,
}: Props) {
  const isEdit = discipline !== null;
  const isBuiltIn = discipline?.builtIn === true;

  const [name, setName] = useState(discipline?.name ?? "");
  const [shortName, setShortName] = useState(discipline?.shortName ?? "");
  const [minTeamSize, setMinTeamSize] = useState(String(discipline?.team.minTeamSize ?? 5));
  const [maxTeamSize, setMaxTeamSize] = useState(
    discipline?.team.maxTeamSize == null ? "" : String(discipline.team.maxTeamSize),
  );
  const [rolesRequired, setRolesRequired] = useState(
    discipline?.team.rolesRequired ?? true,
  );
  const [roles, setRoles] = useState<Role[]>(discipline?.roles ?? []);
  const [attributes, setAttributes] = useState<Attribute[]>(
    discipline?.attributes ?? [],
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (discipline) {
      setName(discipline.name);
      setShortName(discipline.shortName);
      setMinTeamSize(String(discipline.team.minTeamSize));
      setMaxTeamSize(
        discipline.team.maxTeamSize == null ? "" : String(discipline.team.maxTeamSize),
      );
      setRolesRequired(discipline.team.rolesRequired);
      setRoles([...discipline.roles]);
      setAttributes([...discipline.attributes]);
    }
  }, [discipline]);

  const addRole = () => setRoles((prev) => [...prev, { id: "", name: "" }]);
  const addAttribute = () =>
    setAttributes((prev) => [...prev, { id: "", name: "", min: 1, max: 5 }]);

  const updateRole = (i: number, patch: Partial<Role>) =>
    setRoles((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const updateAttribute = (i: number, patch: Partial<Attribute>) =>
    setAttributes((prev) => prev.map((a, j) => (j === i ? { ...a, ...patch } : a)));

  const removeRole = (i: number) =>
    setRoles((prev) => prev.filter((_, j) => j !== i));
  const removeAttribute = (i: number) =>
    setAttributes((prev) => prev.filter((_, j) => j !== i));

  const buildRoles = (): Role[] =>
    roles
      .map((r, i) => ({
        id: r.id || slugify(r.name) || `role-${i}`,
        name: r.name.trim(),
      }))
      .filter((r) => r.name.length > 0);

  const buildAttributes = (): Attribute[] =>
    attributes
      .map((a, i) => ({
        id: a.id || slugify(a.name) || `attr-${i}`,
        name: a.name.trim(),
        min: a.min ?? 1,
        max: a.max ?? 5,
      }))
      .filter((a) => a.name.length > 0);

  const save = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Discipline needs a name.");
      return;
    }
    const min = Number.parseInt(minTeamSize, 10);
    if (!Number.isFinite(min) || min < 1 || min > 20) {
      setError("Min team size must be between 1 and 20.");
      return;
    }
    const max = maxTeamSize.trim() === "" ? null : Number.parseInt(maxTeamSize, 10);
    if (max != null && (!Number.isFinite(max) || max < min)) {
      setError("Max team size must be empty (unlimited) or at least the min.");
      return;
    }
    const finalRoles = buildRoles();
    const finalAttributes = buildAttributes();
    if (finalAttributes.length === 0) {
      setError("At least one attribute is required.");
      return;
    }
    if (rolesRequired && finalRoles.length === 0) {
      setError("This discipline requires roles but none are defined.");
      return;
    }

    const baseId = (discipline?.id ?? slugify(trimmedName)) || "discipline";
    const id = uniqueSlug(baseId, existingIds, discipline?.id);
    const finalShort = shortName.trim() || trimmedName.slice(0, 6).toUpperCase();

    const next: Discipline = {
      id,
      name: trimmedName,
      shortName: finalShort,
      roles: finalRoles,
      attributes: finalAttributes,
      strengthModel: discipline?.strengthModel ?? { kind: "mean" },
      team: {
        minTeamSize: min,
        maxTeamSize: max,
        rolesRequired,
      },
      ...(isBuiltIn ? { builtIn: true } : {}),
    };

    setError(null);
    setSaving(true);
    try {
      await onSave(next);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!discipline || !onDelete || isBuiltIn) return;
    if (!window.confirm(`Delete discipline "${discipline.name}"? Players with capabilities in it will still have those ratings, but the discipline won't be available for splitting.`)) return;
    setSaving(true);
    try {
      await onDelete(discipline.id);
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
          {isEdit ? (isBuiltIn ? "View discipline" : "Edit discipline") : "New discipline"}
        </h1>
        {isBuiltIn && (
          <p className="modal-banner modal-banner-info">
            Built-in discipline — review only, not editable.
          </p>
        )}

        <div className="field">
          <label className="field-label" htmlFor="disc-name">Name</label>
          <input
            id="disc-name"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Badminton"
            disabled={isBuiltIn}
            autoFocus={!isEdit}
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="disc-short">Short name (badges)</label>
          <input
            id="disc-short"
            className="input"
            value={shortName}
            onChange={(e) => setShortName(e.target.value)}
            placeholder="e.g. BDMT"
            maxLength={8}
            disabled={isBuiltIn}
          />
        </div>

        <div className="field-row">
          <div className="field">
            <label className="field-label" htmlFor="disc-min">Min team size</label>
            <input
              id="disc-min"
              className="input"
              type="number"
              min={1}
              max={20}
              value={minTeamSize}
              onChange={(e) => setMinTeamSize(e.target.value)}
              disabled={isBuiltIn}
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="disc-max">Max team size (empty = unlimited)</label>
            <input
              id="disc-max"
              className="input"
              type="number"
              min={1}
              max={20}
              value={maxTeamSize}
              onChange={(e) => setMaxTeamSize(e.target.value)}
              disabled={isBuiltIn}
            />
          </div>
        </div>

        <label className="opt-row">
          <input
            type="checkbox"
            checked={rolesRequired}
            onChange={(e) => setRolesRequired(e.target.checked)}
            disabled={isBuiltIn}
          />
          <span>Roles are required on every team (hard coverage)</span>
        </label>

        <span className="sec">Roles</span>
        {roles.length === 0 && (
          <p className="status">No roles yet.</p>
        )}
        {roles.map((role, i) => (
          <div key={i} className="list-row">
            <input
              className="input"
              value={role.name}
              onChange={(e) => updateRole(i, { name: e.target.value })}
              placeholder="e.g. Goalkeeper"
              disabled={isBuiltIn}
            />
            {!isBuiltIn && (
              <button
                type="button"
                className="btn btn-ghost small"
                onClick={() => removeRole(i)}
              >
                Remove
              </button>
            )}
          </div>
        ))}
        {!isBuiltIn && (
          <button type="button" className="link" onClick={addRole}>
            + Add role
          </button>
        )}

        <span className="sec">Attributes (rated per capability)</span>
        {attributes.length === 0 && (
          <p className="status">No attributes yet.</p>
        )}
        {attributes.map((attr, i) => (
          <div key={i} className="list-row">
            <input
              className="input"
              value={attr.name}
              onChange={(e) => updateAttribute(i, { name: e.target.value })}
              placeholder="e.g. Skill"
              disabled={isBuiltIn}
            />
            {!isBuiltIn && (
              <button
                type="button"
                className="btn btn-ghost small"
                onClick={() => removeAttribute(i)}
              >
                Remove
              </button>
            )}
          </div>
        ))}
        {!isBuiltIn && (
          <button type="button" className="link" onClick={addAttribute}>
            + Add attribute
          </button>
        )}

        {error && <p className="field-error">{error}</p>}

        <div className="bar">
          {isEdit && onDelete && !isBuiltIn ? (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => void remove()}
              disabled={saving}
            >
              Delete
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onClose}
              disabled={saving}
            >
              {isBuiltIn ? "Close" : "Cancel"}
            </button>
          )}
          {!isBuiltIn && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void save()}
              disabled={saving || !name.trim()}
            >
              {saving ? "Saving…" : isEdit ? "Save changes" : "Add discipline"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
