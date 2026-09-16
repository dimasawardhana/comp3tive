import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { Discipline, Player, SplitResult } from "./domain/types";
import { strengthOf, teamName } from "./session/flow";

/**
 * The deal: the pool of players parting into the teams the solver assigned, on a
 * loop, because the mechanism is what this page has to prove.
 *
 * The assignment is real — `result` comes from the shipped solver — and so is
 * every strength figure.
 *
 * How it moves: the stage lays out invisible *anchor* cells that hold space in
 * normal flow, one per pool slot and one per team slot. Each chip is absolutely
 * positioned and its box is measured from whichever anchor it currently belongs
 * to, so a chip fits both containers without hard-coded sizes. Only `transform`
 * and `opacity` animate; nothing reflows mid-flight, and travel stays correct at
 * every width because the distance comes from the real layout.
 *
 * The loop: pool, deal, hold, clear, repeat. Timing lives in the constants below
 * and the chip's transition durations are written inline from those same
 * constants, so the scheduler and the animation cannot drift apart.
 *
 * Degradation: the animation is never the only way to see the teams. Reduced
 * motion shows the settled teams immediately and drops the loop; a client with
 * no IntersectionObserver does the same; the loop only runs while the stage is
 * on screen and the tab is visible; and the control lets anyone stop it.
 */

/** A chip's box, measured from whichever anchor it currently belongs to. */
interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Props {
  roster: Player[];
  result: SplitResult;
  discipline: Discipline;
}

/**
 * The loop's timeline. Deliberately unhurried: the deal is the page's one
 * authored moment and it should read as a sentence, not a flicker.
 */
/** One chip's travel. */
const TRAVEL_MS = 1500;
/** Each chip departs this long after the previous one. */
const STAGGER_MS = 85;
/** The fade out, and the matching fade back in. */
const FADE_MS = 420;
/** How long the settled teams are held before the board clears. */
const HOLD_MS = 2000;
/** A beat on the reassembled pool before the next deal. Long enough to read as
 *  a starting position, not a flicker. */
const POOL_MS = 900;
/**
 * The reposition, done while invisible. The chips are remounted on this phase
 * (their `cycle` key changes), so they arrive on the pool without travelling
 * back across the screen.
 */
const RESET_MS = 60;

type Phase = "pool" | "dealing" | "holding" | "clearing" | "reset";

/** Phase order and durations; `dealing` adds the stagger, so it is extended below. */
const TIMELINE: Record<Phase, { ms: number; next: Phase }> = {
  pool: { ms: POOL_MS, next: "dealing" },
  dealing: { ms: TRAVEL_MS, next: "holding" },
  holding: { ms: HOLD_MS, next: "clearing" },
  clearing: { ms: FADE_MS, next: "reset" },
  reset: { ms: RESET_MS, next: "pool" },
};

export function SplitDeal({ roster, result, discipline }: Props) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const poolRefs = useRef<(HTMLLIElement | null)[]>([]);
  const teamRefs = useRef(new Map<string, HTMLLIElement | null>());

  const [poolBoxes, setPoolBoxes] = useState<Box[]>([]);
  const [teamBoxes, setTeamBoxes] = useState<Record<string, Box>>({});
  const [cycle, setCycle] = useState(0);
  const [inView, setInView] = useState(false);
  const [tabVisible, setTabVisible] = useState(true);
  const [paused, setPaused] = useState(false);
  const [reduce, setReduce] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  const canObserve = typeof window !== "undefined" && "IntersectionObserver" in window;
  /** No loop, and the teams are simply shown. */
  const staticMode = reduce || !canObserve;

  const [phase, setPhase] = useState<Phase>(staticMode ? "holding" : "pool");

  /** True once the first measurement lands; chips stay invisible until then. */
  const measured = poolBoxes.length > 0;
  const dealt = phase === "dealing" || phase === "holding" || phase === "clearing";
  const chipsVisible = measured && phase !== "clearing" && phase !== "reset";

  // Where each player ended up, so a chip knows which anchor to fly to.
  const placement = new Map<string, { teamIndex: number; slot: number }>();
  for (const team of result.teams) {
    team.slots.forEach((slot, index) => {
      placement.set(slot.playerId, { teamIndex: team.index, slot: index });
    });
  }

  const measure = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const base = stage.getBoundingClientRect();
    const boxOf = (el: HTMLElement): Box => {
      const rect = el.getBoundingClientRect();
      return { x: rect.left - base.left, y: rect.top - base.top, w: rect.width, h: rect.height };
    };

    setPoolBoxes(poolRefs.current.flatMap((el) => (el ? [boxOf(el)] : [])));

    const next: Record<string, Box> = {};
    teamRefs.current.forEach((el, playerId) => {
      if (el) next[playerId] = boxOf(el);
    });
    setTeamBoxes(next);
  }, []);

  useLayoutEffect(() => {
    measure();
  }, [measure]);

  // Wrap-around and viewport changes move the anchors, so travel is re-measured.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    document.fonts?.ready.then(measure).catch(() => {});
    return () => observer.disconnect();
  }, [measure]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduce(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // The teams are the resting state when the loop cannot run.
  useEffect(() => {
    if (staticMode) setPhase("holding");
  }, [staticMode]);

  // Only deal while the stage is on screen.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !canObserve) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) setInView(entry.isIntersecting);
      },
      { threshold: 0.25 },
    );
    observer.observe(stage);
    return () => observer.disconnect();
  }, [canObserve]);

  // A backgrounded tab should not keep animating.
  useEffect(() => {
    const onChange = () => setTabVisible(!document.hidden);
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);

  const running = !staticMode && inView && tabVisible && !paused;

  /**
   * The loop itself: one timer per phase. A phase change reschedules the next
   * step, so the sequence is described in one place above and interrupted
   * cleanly whenever `running` goes false.
   */
  useEffect(() => {
    if (!running) return;
    const span =
      phase === "dealing"
        ? TIMELINE.dealing.ms + STAGGER_MS * Math.max(0, roster.length - 1)
        : TIMELINE[phase].ms;
    const next = TIMELINE[phase].next;
    const id = window.setTimeout(() => {
      // Remount the chips as they return to the pool, so the reposition is not
      // animated back across the screen.
      if (next === "reset") setCycle((n) => n + 1);
      setPhase(next);
    }, span);
    return () => window.clearTimeout(id);
  }, [phase, running, roster.length]);

  return (
    <figure className="deal">
      <div className="deal-stage" ref={stageRef} data-dealt={dealt} data-phase={phase} data-cycle={cycle}>
        {/* Geometry only: these cells hold the layout the chips travel between. */}
        <div className="deal-anchors" aria-hidden="true">
          <ul className="deal-pool">
            {roster.map((player, index) => (
              <li
                key={player.id}
                className="deal-anchor"
                ref={(el) => {
                  poolRefs.current[index] = el;
                }}
              />
            ))}
          </ul>
          <div className="deal-teams">
            {result.teams.map((team) => (
              <div key={team.index} className={`deal-team deal-team-${team.index}`}>
                <p className="deal-team-head">
                  <span className={`deal-dot deal-dot-${team.index}`} />
                  {teamName(team.index)}
                  <span className="deal-team-avg">
                    <span className="sr-only">average strength </span>
                    {team.avgStrength.toFixed(1)}
                  </span>
                </p>
                <ol className="deal-slots">
                  {team.slots.map((slot) => (
                    <li
                      key={slot.playerId}
                      className="deal-anchor"
                      ref={(el) => {
                        teamRefs.current.set(slot.playerId, el);
                      }}
                    />
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </div>

        <ul className="deal-chips">
          {roster.map((player, index) => {
            const place = placement.get(player.id);
            const box = (dealt && place ? teamBoxes[player.id] : poolBoxes[index]) ?? null;
            const strength = strengthOf(player, discipline);
            const style: CSSProperties = {
              width: box ? box.w : 0,
              height: box ? box.h : 0,
              transform: `translate3d(${box?.x ?? 0}px, ${box?.y ?? 0}px, 0)`,
              opacity: chipsVisible ? 1 : 0,
            };
            // Durations are set from the same constants the scheduler uses, so
            // the two cannot disagree. Omitted under reduced motion, which
            // leaves the chip without any transition at all.
            if (!reduce) {
              style.transitionProperty = "transform, opacity";
              style.transitionDuration = `${TRAVEL_MS}ms, ${FADE_MS}ms`;
              style.transitionDelay = `${dealt ? index * STAGGER_MS : 0}ms, 0ms`;
              style.transitionTimingFunction =
                "cubic-bezier(0.16, 1, 0.3, 1), cubic-bezier(0.22, 1, 0.36, 1)";
            }
            return (
              <li key={`${cycle}-${player.id}`} className="deal-chip" style={style}>
                <span
                  className={`deal-dot deal-dot-${place?.teamIndex ?? 0}`}
                  data-lit={dealt && place ? "yes" : "no"}
                />
                <span className="deal-chip-name">{player.name}</span>
                {strength !== null && <span className="deal-chip-str">{strength.toFixed(1)}</span>}
                {place && <span className="sr-only">on {teamName(place.teamIndex)}</span>}
              </li>
            );
          })}
        </ul>
      </div>

      <figcaption className="deal-caption">
        <span>
          Ten on the roster, two teams. The solver places every player, then measures the gap between
          the teams.
        </span>
        {!reduce && (
          <button
            type="button"
            className="deal-control"
            onClick={() => setPaused((value) => !value)}
            aria-pressed={paused}
          >
            {paused ? "Play" : "Pause"}
          </button>
        )}
      </figcaption>
    </figure>
  );
}
