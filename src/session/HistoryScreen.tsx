import type { Discipline, Session } from "../domain/types";

interface Props {
  sessions: Session[];
  loading: boolean;
  disciplines: Discipline[];
  onReopen: (session: Session) => void;
  onDelete: (id: string) => void;
}

function relativeTime(ts: number): string {
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function HistoryScreen({ sessions, loading, disciplines, onReopen, onDelete }: Props) {
  return (
    <div className="screen">
      <div className="kicker">Game tape</div>
      <h1>History</h1>
      <p className="lede">Every team-building run you&apos;ve done. Reopen one to re-split the same pool.</p>

      {loading ? (
        <p className="status">Loading&hellip;</p>
      ) : sessions.length === 0 ? (
        <div className="empty">
          <div className="kicker">No history</div>
          <div className="big">Sessions appear here</div>
          <p>Split your first teams and they&apos;ll be saved automatically.</p>
        </div>
      ) : (
        <ul className="roster history-list">
          {sessions.map((s) => {
            const discipline = disciplines.find((d) => d.id === s.disciplineId);
            const sizes = s.result.teams.map((t) => t.slots.length);
            const summary =
              sizes.length === 2 ? `${sizes[0]} v ${sizes[1]}` : sizes.length > 0 ? sizes.join(" / ") : "no teams";
            const stripeVar = discipline
              ? `var(--bib-${discipline.shortName.toLowerCase().charAt(0)})`
              : "var(--text-2)";
            return (
              <li
                key={s.id}
                className="row row-clickable history-row"
                style={{ ["--stripe" as string]: stripeVar }}
                onClick={() => onReopen(s)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onReopen(s);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <div className="who">
                  <div className="name">
                    {discipline?.shortName ?? "Unknown"} session
                    <span className="history-time" title={new Date(s.createdAt).toLocaleString()}>
                      {relativeTime(s.createdAt)} · {formatTime(s.createdAt)}
                    </span>
                  </div>
                  <div className="badges">
                    <span className="badge badge--generic">
                      {sizes.length} teams ({summary})
                    </span>
                    <span className="badge badge--generic">
                      gap {s.result.gap.toFixed(1)}
                    </span>
                    <span className="badge badge--generic">
                      {s.poolPlayerIds.length} players
                    </span>
                  </div>
                </div>
                <span className="row-actions">
                  <span className="row-edit" aria-hidden="true">›</span>
                  <button
                    type="button"
                    className="link danger"
                    aria-label="Delete session"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm("Delete this session?")) onDelete(s.id);
                    }}
                  >
                    Delete
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
