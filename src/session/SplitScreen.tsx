import { useEffect, useRef, useState } from "react";
import type { Capability, Discipline, Id, Player, Session, SplitResult, TeamAssignment } from "../domain/types";
type SplitSource = "ad-hoc" | "tournament" | "session" | "squad";
import { describeFlags, teamName } from "./flow";
import { freshSplit, swapPlayers } from "./edit";

interface Props {
  session: Session;
  discipline: Discipline;
  roster: Player[];
  onPersistResult: (result: SplitResult) => Promise<void>;
  onSubmitTournament?: (teams: TeamAssignment[]) => void;
  /** Save the current teams as a named Saved Squad. */
  onSaveSquad?: (name: string, result: SplitResult) => Promise<void> | void;
  /** Source of this split: drives header, breadcrumbs, persistence, forward action. */
  source: SplitSource;
  /** Go back to the match setup screen to change the roster. */
  onBack?: () => void;
}

const BIB = ["a", "b", "c", "d", "e"];

function playerCapability(player: Player, discipline: Discipline): Capability | undefined {
  return player.capabilities.find((c) => c.disciplineId === discipline.id);
}

function strengthFromRatings(cap: Capability, discipline: Discipline): number {
  const vals = discipline.attributes.map((a) => cap.attributeRatings[a.id] ?? 0);
  if (vals.length === 0) return 0;
  return vals.reduce((s, v) => s + v, 0) / vals.length;
}

interface TeamCardProps {
  team: TeamAssignment;
  discipline: Discipline;
  roster: Player[];
  swapMode: boolean;
  pick: { teamIndex: number; playerId: Id } | null;
  onPick: (teamIndex: number, playerId: Id) => void;
}

function TeamCard({ team, discipline, roster, swapMode, pick, onPick }: TeamCardProps) {
  return (
    <div className={`team ${BIB[team.index % BIB.length] ?? "a"}`}>
      <div className="tname">
        <span className="tname-label">{teamName(team.index)}</span>
        <span className="tname-avg">{team.avgStrength.toFixed(1)}</span>
      </div>
      <ul>
        {team.slots.map((slot) => {
          const player = roster.find((p) => p.id === slot.playerId);
          const role = slot.roleId ? discipline.roles.find((r) => r.id === slot.roleId)?.name : undefined;
          const cap = player ? playerCapability(player, discipline) : undefined;
          const picked = pick?.teamIndex === team.index && pick.playerId === slot.playerId;
          return (
            <li
              key={slot.playerId}
              className={swapMode ? `swappable${picked ? " picked" : ""}` : ""}
              role={swapMode ? "button" : undefined}
              tabIndex={swapMode ? 0 : undefined}
              onClick={() => swapMode && onPick(team.index, slot.playerId)}
              onKeyDown={(e) => {
                if (swapMode && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  onPick(team.index, slot.playerId);
                }
              }}
            >
              <div className="player-row">
                <div className="player-head">
                  <span className="player-name">{player?.name ?? "?"}</span>
                  {cap && (
                    <span className="player-overall" title="Overall rating (avg of all attributes)">
                      {strengthFromRatings(cap, discipline).toFixed(1)}
                    </span>
                  )}
                </div>
                {role && <span className="role">{role}</span>}
                {cap && (
                  <div className="player-ratings" aria-label="Attribute ratings">
                    {discipline.attributes.map((a) => {
                      const v = cap.attributeRatings[a.id] ?? 0;
                      return (
                        <div key={a.id} className="rating-cell" title={`${a.name}: ${v}/5`}>
                          <span className="rating-label">{a.name.slice(0, 3).toUpperCase()}</span>
                          <span className="rating-dots">
                            {[1, 2, 3, 4, 5].map((n) => (
                              <span key={n} className={`dot ${n <= v ? "on" : ""}`} />
                            ))}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <div className="avg">
        <span>Avg strength</span>
        <b>{team.avgStrength.toFixed(1)}</b>
      </div>
    </div>
  );
}

function GapMeter({ result, balanced }: { result: SplitResult; balanced: boolean }) {
  const gap = result.gap;
  const deg =
    balanced || result.teams.length < 2
      ? 0
      : (result.teams[0].avgStrength > result.teams[1].avgStrength ? -1 : 1) * Math.min(28, gap * 45);
  const leader = result.teams.length > 0 ? result.teams.reduce((a, b) => (a.avgStrength > b.avgStrength ? a : b)) : null;

  return (
    <>
      <div className="scale">
        <div className="track">
          <div className="tick left" />
          <div className="tick center" />
          <div className="tick right" />
          <div className="pivot" />
          <div className={`needle ${balanced ? "balanced" : ""}`} style={{ transform: `translateX(-50%) rotate(${deg}deg)` }} />
        </div>
        <div className="num left">{gap.toFixed(1)}</div>
        <div className="num right">{gap.toFixed(1)}</div>
      </div>
      <div className="readout">
        {balanced ? (
          <>Dead even. <span className="fine">Fair game.</span></>
        ) : (
          <>
            Gap {gap.toFixed(1)}.{" "}
            <span className="fine">
              {leader ? teamName(leader.index) : "?"} leads.
            </span>
          </>
        )}
      </div>
    </>
  );
}

function SaveSquadModal({
  defaultName,
  saving,
  onCancel,
  onSave,
}: {
  defaultName: string;
  saving: boolean;
  onCancel: () => void;
  onSave: (name: string) => void;
}) {
  const [name, setName] = useState(defaultName);
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal-close" aria-label="Close" onClick={onCancel}>
          &times;
        </button>
        <h1 className="modal-title">Save squad</h1>
        <div className="modal-section">
          <div className="field-label">Name</div>
          <input
            id="squad-name"
            className="input"
            value={name}
            autoFocus
            autoComplete="off"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && name.trim()) onSave(name.trim());
              if (e.key === "Escape") onCancel();
            }}
          />
          <p className="modal-section-hint">Saved squads are yours to drop into any matching tournament.</p>
        </div>
        <div className="bar">
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={saving || !name.trim()}
            onClick={() => onSave(name.trim())}
          >
            {saving ? "Saving\u2026" : "Save squad"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function SplitScreen({ session, discipline, roster, onPersistResult, onSubmitTournament, onSaveSquad, source, onBack }: Props) {
  const [editable, setEditable] = useState<SplitResult>(session.result);
  const [swapMode, setSwapMode] = useState(false);
  const [pick, setPick] = useState<{ teamIndex: number; playerId: Id } | null>(null);
  const [rerollCount, setRerollCount] = useState(1);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [persistError, setPersistError] = useState<string | null>(null);
  const pitchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pitchRef.current) return;
    const el = pitchRef.current;
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      el.classList.add("in");
      return;
    }
    el.classList.remove("in");
    const t = window.setTimeout(() => el.classList.add("in"), 20);
    return () => window.clearTimeout(t);
  }, [editable]);

  const result = editable;
  const balanced = result.gap <= 0.1;
  const flags = describeFlags(result, discipline, roster);
  const displayFlags =
    flags.length > 0 ? flags : balanced ? ["All roles covered. Fair game."] : [];

  const commit = async (next: SplitResult) => {
    setEditable(next);
    try {
      await onPersistResult(next);
      setPersistError(null);
    } catch (err) {
      // The board shows the new arrangement either way, so say plainly that it
      // was not stored rather than letting the user assume it was.
      setPersistError(err instanceof Error ? err.message : String(err));
    }
  };

  const handlePick = (teamIndex: number, playerId: Id) => {
    if (!pick) {
      setPick({ teamIndex, playerId });
      return;
    }
    if (pick.teamIndex === teamIndex) {
      setPick(null);
      return;
    }
    const a = { teamIndex: pick.teamIndex, playerId: pick.playerId };
    const b = { teamIndex, playerId };
    const next = swapPlayers(result, roster, discipline, a, b);
    void commit(next);
    setPick(null);
  };

  const reroll = () => {
    const next = freshSplit(
      result.teams.flatMap((t) => t.slots.map((s) => s.playerId)),
      roster,
      discipline,
      { teamCount: result.teams.length },
    );
    void commit(next);
    setRerollCount((n) => n + 1);
  };

  const toggleSwapMode = () => {
    setSwapMode((s) => !s);
    setPick(null);
  };

  const teamCardProps = (team: TeamAssignment) => ({
    team,
    discipline,
    roster,
    swapMode,
    pick,
    onPick: handlePick,
  });

  const doSave = (name: string) => {
    setSaving(true);
    const done = () => {
      setSaving(false);
      setSaveOpen(false);
    };
    Promise.resolve(onSaveSquad ? onSaveSquad(name, result) : undefined).then(done, done);
  };

  const defaultName = `${discipline.name} · ${result.teams.length} teams · ${new Date().toLocaleDateString()}`;

  return (
    <div className="screen split-screen">
      <div className="breadcrumb">
        <a href="#" onClick={(e) => { e.preventDefault(); /* back handled via app */ }}>Match setup</a>
        <span className="sep">/</span>
        <span>Split result</span>
      </div>

      <div className="split-head">
        <h1>Tonight&apos;s teams</h1>
        <div className="split-head-meta">
          <span className="badge badge--generic">{discipline.name}</span>
          <span className="badge badge--generic">{result.teams.length} teams</span>
          {source === "tournament" && <span className="badge badge--generic badge--tournament">Tournament squad</span>}
          {rerollCount > 1 && <span className="badge badge--generic">Roll #{rerollCount}</span>}
        </div>
      </div>

      {swapMode && (
        <div className="swap-banner">
          <span className="swap-banner-icon" aria-hidden="true">⇄</span>
          <span>
            {pick
              ? `Now tap a player on the other team to swap with ${roster.find((p) => p.id === pick.playerId)?.name ?? "?"}.`
              : "Tap one player on each team to swap them."}
          </span>
        </div>
      )}

      {result.teams.length === 2 ? (
        <div ref={pitchRef} className="pitch">
          <div className="vs">
            <TeamCard {...teamCardProps(result.teams[0])} />
            <div className="mid">
              <span className="tag">VS</span>
              <span className="tag tag-gap">{balanced ? "OK" : result.gap.toFixed(1)}</span>
            </div>
            <TeamCard {...teamCardProps(result.teams[1])} />
          </div>
          <GapMeter result={result} balanced={balanced} />
        </div>
      ) : result.teams.length > 2 ? (
        <div ref={pitchRef} className="pitch">
          <div className="readout">
            {balanced ? (
              <>Dead even. <span className="fine">Fair game.</span></>
            ) : (
              <>
                Gap {result.gap.toFixed(1)}.{" "}
                <span className="fine">
                  {teamName(result.teams.reduce((a, b) => (a.avgStrength > b.avgStrength ? a : b)).index)} leads.
                </span>
              </>
            )}
          </div>
          <div className="team-stack">{result.teams.map((t) => <TeamCard key={t.index} {...teamCardProps(t)} />)}</div>
        </div>
      ) : (
        <div className="empty">
          <div className="kicker">Solver failed</div>
          <div className="big">Couldn&apos;t build teams</div>
          <p>Not enough eligible players for this game. Adjust the pool or change the discipline.</p>
        </div>
      )}

      {persistError && (
        <div className="load-error" role="alert">
          <strong>This arrangement wasn&apos;t saved.</strong> {persistError}
        </div>
      )}

      {displayFlags.length > 0 && (
        <div className="flags">
          {displayFlags.map((f, i) => (
            <div key={i} className="flag">
              {f}
            </div>
          ))}
        </div>
      )}

      <div className="bar split-bar">
        {onBack && !swapMode && (
          <button type="button" className="btn btn-ghost" onClick={onBack} data-testid="back-button">
            ← {source === "session" ? "History" : source === "squad" ? "Squad detail" : "Match setup"}
          </button>
        )}
        {onSaveSquad && !swapMode && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setSaveOpen(true)}
            data-testid="save-squad-button"
          >
            Save squad
          </button>
        )}
        {swapMode ? (
          <button type="button" className="btn btn-primary" onClick={toggleSwapMode}>
            Done swapping
          </button>
        ) : onSubmitTournament ? (
          <button
            type="button"
            className="btn btn-primary"
            disabled={result.teams.length < 2}
            onClick={() => onSubmitTournament(result.teams)}
            data-testid="submit-tournament-squad"
          >
            Save tournament squad →
          </button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={() => void reroll()}>
            Re-roll
          </button>
        )}
      </div>

      {saveOpen && onSaveSquad && (
        <SaveSquadModal
          defaultName={defaultName}
          saving={saving}
          onCancel={() => setSaveOpen(false)}
          onSave={doSave}
        />
      )}
    </div>
  );
}
