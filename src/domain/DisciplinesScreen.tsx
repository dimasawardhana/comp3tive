import { useState } from "react";
import type { Discipline, Id } from "../domain/types";
import { DisciplineEditModal } from "./DisciplineEditModal";

interface Props {
  disciplines: Discipline[];
  loading: boolean;
  onSave: (discipline: Discipline) => Promise<void>;
  onDelete: (id: Id) => Promise<void>;
  onBack: () => void;
  onDownloadSample?: (disciplineId: Id) => void;
  downloadingId?: string | null;
}

export function DisciplinesScreen({ disciplines, loading, onSave, onDelete, onBack, onDownloadSample, downloadingId }: Props) {
  const [editing, setEditing] = useState<Discipline | null | "new">(null);

  return (
    <div className="screen">
      <div className="kicker">Catalog</div>
      <h1>Disciplines</h1>
      <p className="lede">The activities you build teams for. Futsal and MLBB ship built-in; add your own.</p>

      {loading ? (
        <p className="status">Loading&hellip;</p>
      ) : (
        <ul className="roster">
          {disciplines.map((d) => {
            const stripeVar = `var(--bib-${d.shortName.toLowerCase().charAt(0)})`;
            return (
              <li
                key={d.id}
                className="row row-clickable"
                style={{ ["--stripe" as string]: stripeVar }}
                onClick={() => setEditing(d)}
              >
                <div className="who">
                  <div className="name">
                    {d.name}
                    {d.builtIn && <span className="badge badge--generic">Built in</span>}
                  </div>
                  <div className="badges">
                    <span className="badge badge--generic">
                      {d.roles.length} role{d.roles.length === 1 ? "" : "s"}
                    </span>
                    <span className="badge badge--generic">
                      {d.attributes.length} attribute{d.attributes.length === 1 ? "" : "s"}
                    </span>
                    <span className="badge badge--generic">
                      {d.team.minTeamSize}–{d.team.maxTeamSize ?? "∞"} per team
                    </span>
                  </div>
                </div>
                <div className="row-actions">
                  {onDownloadSample && (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ fontSize: 12, padding: "4px 8px" }}
                      aria-label={`Download sample data for ${d.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDownloadSample(d.id);
                      }}
                    >
                      ⬇ {downloadingId === d.id ? "..." : "Sample"}
                    </button>
                  )}
                  <span className="row-edit" aria-hidden="true">✎</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="bar">
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          Back
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setEditing("new")}
        >
          + New Discipline
        </button>
      </div>

      {editing !== null && (
        <DisciplineEditModal
          discipline={editing === "new" ? null : editing}
          existingIds={disciplines.map((d) => d.id)}
          onClose={() => setEditing(null)}
          onSave={async (d) => {
            await onSave(d);
            setEditing(null);
          }}
          onDelete={async (id) => {
            await onDelete(id);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
