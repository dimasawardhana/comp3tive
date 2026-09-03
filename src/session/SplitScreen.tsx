import { useEffect, useRef, useState } from "react";
import type { Discipline, Id, Player, Session, SplitResult, TeamAssignment } from "../domain/types";
import { describeFlags, teamName } from "./flow";
import { freshSplit, swapPlayers } from "./edit";

interface Props {
  session: Session;
  discipline: Discipline;
  roster: Player[];
  onPersistResult: (result: SplitResult) => Promise<void>;
  /** Tournament mode: submit the current teams into the tournament. */
  onSubmitTournament?: (teams: TeamAssignment[]) => void;
}

const BIB = ["a", "b", "c", "d", "e"];

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
      <span className="tname">{teamName(team.index)}</span>
      <ul>
        {team.slots.map((slot) => {
          const player = roster.find((p) => p.id === slot.playerId);
          const role = slot.roleId ? discipline.roles.find((r) => r.id === slot.roleId)?.name : undefined;
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
              <span>{player?.name ?? "?"}</span>
              {role && <span className="role">{role}</span>}
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
        <div className="num left">{result.teams[0] ? result.teams[0].avgStrength.toFixed(1) : ''}</div>
        <div className="track" />
        <div className="tick" style={{ left: "25%" }} />
        <div className="tick" style={{ left: "75%" }} />
        <div className="tick center" style={{ left: "50%" }} />
        <div className="pivot" />
        <div
          className={`needle${balanced ? " balanced" : ""}`}
          style={{ transform: `translate(-50%,-100%) rotate(${deg}deg)` }}
        />
        <div className="num right">{result.teams[1] ? result.teams[1].avgStrength.toFixed(1) : ''}</div>
      </div>
      <div className="readout">
        {balanced ? (
          <>
            Dead even. <span className="fine">Fair game.</span>
          </>
        ) : (
          <>
            {teamName(leader!.index)} is {gap.toFixed(1)} ahead. <span className="fine">Swap to even it up.</span>
          </>
        )}
      </div>
    </>
  );
}

export function SplitScreen({ session, discipline, roster, onPersistResult, onSubmitTournament }: Props) {
  const [editable, setEditable] = useState<SplitResult>(session.result);
  const [swapMode, setSwapMode] = useState(false);
  const [pick, setPick] = useState<{ teamIndex: number; playerId: Id } | null>(null);
  const [rerollCount, setRerollCount] = useState(1);
  const pitchRef = useRef<HTMLDivElement>(null);

  // The one orchestrated moment: teams deal in (reduced-motion collapses this).
  useEffect(() => {
    const el = pitchRef.current;
    if (!el) return;
    el.classList.remove("in");
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("in")));
    return () => cancelAnimationFrame(raf);
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
    } catch {
      // Non-fatal: the on-screen result still stands.
    }
  };

  const handlePick = (teamIndex: number, playerId: Id) => {
    if (!pick) {
      setPick({ teamIndex, playerId });
      return;
    }
    if (pick.teamIndex === teamIndex && pick.playerId === playerId) {
      setPick(null); // tap again to unselect
      return;
    }
    if (pick.teamIndex === teamIndex) {
      setPick({ teamIndex, playerId }); // reselect within the same team
      return;
    }
    const next = swapPlayers(result, roster, discipline, pick, { teamIndex, playerId });
    setPick(null);
    void commit(next);
  };

  const reroll = () => {
    // A deterministic exact solver returns the same optimum; sample different
    // near-optimal splits and retry until the result actually changes.
    const sig = (result: SplitResult) =>
      result.teams
        .map((t) => t.slots.map((s) => s.playerId).sort().join(","))
        .sort()
        .join("|");
    const current = sig(editable);
    for (let attempt = 0; attempt < 6; attempt++) {
      const next = freshSplit(session.poolPlayerIds, roster, discipline, session.settings, {
        variety: rerollCount + attempt,
      });
      if (sig(next) !== current || attempt === 5) {
        setRerollCount((c) => c + attempt + 1);
        setPick(null);
        void commit(next);
        return;
      }
    }
  };

  const toggleSwapMode = () => {
    setSwapMode((on) => !on);
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

  return (
    <>
      <div className="breadcrumb">
        <a href="#" onClick={(e) => { e.preventDefault(); /* back handled via app */ }}>Match setup</a>
        <span className="sep">/</span>
        <span>Split result</span>
      </div>
      <h1>Tonight&apos;s teams</h1>
      {swapMode && (
        <p className="status">
          {pick
            ? `Now tap a player on the other team to swap with ${roster.find((p) => p.id === pick.playerId)?.name ?? "?"}.`
            : "Tap one player on each team to swap them."}
        </p>
      )}

      {result.teams.length === 2 ? (
        <div ref={pitchRef} className="pitch">
          <div className="vs">
            <TeamCard {...teamCardProps(result.teams[0])} />
            <div className="mid">
              <span className="tag">VS</span>
              <span className="tag">{balanced ? "OK" : result.gap.toFixed(1)}</span>
            </div>
            <TeamCard {...teamCardProps(result.teams[1])} />
          </div>
          <GapMeter result={result} balanced={balanced} />
        </div>
      ) : result.teams.length > 2 ? (
        <div ref={pitchRef} className="pitch">
          <div className="readout">
            {balanced ? (
              <>
                Dead even. <span className="fine">Fair game.</span>
              </>
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

      <div className="flags">
        {displayFlags.map((f, i) => (
          <div key={i} className="flag">
            {f}
          </div>
        ))}
      </div>

      <div className="bar">
        {swapMode ? (
          <button type="button" className="btn btn-primary" onClick={toggleSwapMode}>
            Done
          </button>
        ) : onSubmitTournament ? (
          <>
            <button type="button" className="btn btn-ghost" onClick={toggleSwapMode}>
              Swap
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => void reroll()}>
              Re-roll
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={result.teams.length < 2}
              onClick={() => onSubmitTournament(result.teams)}
            >
              Submit teams
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn btn-ghost" onClick={toggleSwapMode}>
              Swap
            </button>
            <button type="button" className="btn btn-primary" onClick={() => void reroll()}>
              Re-roll
            </button>
          </>
        )}
      </div>
    </>
  );
}
