import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The two fields this hook returns are separate claims, and the difference is
 * the whole point of the three states.
 *
 *  - `persisted` is a *measurement*: is this origin's data in a persistent
 *    bucket right now. `true` and `false` are both answers the browser gave;
 *    `null` is "nobody answered" — the read has not settled, or the browser has
 *    no Storage API, or it refused to answer. Only a resolved boolean is a fact.
 *  - `granted` is a *permission*: the answer to the request this app made.
 *    `null` means the app has not asked, or that there is no API to ask. It
 *    does not mean the answer would be no.
 *
 * They are not the same value. An installed app is already persistent and was
 * granted it by the browser without anyone asking (`persisted: true, granted:
 * null`), and a grant can stop covering the data later, when the user clears
 * site data (`granted: true, persisted: false`). A consumer that renders
 * `granted` as "your data is safe" is reading a question and answering it with a
 * promise, which is the Phase B defect in a new place.
 */

const NUDGE_DISMISSED_KEY = "tb-export-nudge-dismissed";
/** Epoch ms of the last export. A file on disk is the backup; this is only the record that one was made. */
const LAST_EXPORT_KEY = "tb-last-export";

/** Nothing has been answered yet. Never mutated — every update replaces it. */
const UNKNOWN: PersistenceVerdict = { persisted: null, granted: null };

/**
 * The roster size below which the app does not *ask the user* to back up.
 *
 * A product choice, and it is one gate out of two. It governs whether this app
 * *asks the user* to back the data up: the nudge is not raised below it, and a
 * dismissal is scoped to it. It governs **nothing** about what this app asks the
 * *browser* for, which is ungated and happens on mount — see
 * {@link probePersistence} for why those two used to coincide and should not.
 * The reasoning the plan gives is sound and is kept: under five records there is
 * nothing in the app worth losing, so a prompt is noise.
 *
 * What would make a different number right: five is a guess made with no data.
 * If organizers turn out to build named, dated rosters they share with a league
 * at two players, the floor is too high; if a five-a-side is routinely typed in
 * once and never revisited, the floor is too low. Nothing the app can observe
 * today separates those cases, so the number sits on the safe side of the noise
 * — a prompt that fires too early is dismissed, and a dismissal is remembered.
 */
const MIN_PLAYERS_TO_NUDGE = 5;

/**
 * How long an export counts as recent enough not to ask about.
 *
 * A nudge cadence, not a risk model. Browsers evict under storage pressure
 * using an LRU policy, and Safari evicts origins it has not seen interacted with
 * in seven days; none of them evicts on a schedule. So "the last export was more
 * than fourteen days ago" predicts nothing about whether this user's data is
 * about to disappear. It decides only how often to remind, and a fortnight is
 * the shortest gap that still reads as a reminder to someone who exports monthly
 * rather than a nag.
 *
 * What would make a different number right: the observed cadence of real
 * exports. If organizers who export at all do it monthly, a fortnight asks twice
 * for every answer, and the number should follow the behaviour rather than
 * precede it.
 */
const NUDGE_AFTER_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * How long a dismissal keeps its cover.
 *
 * A dismissal is a snooze, never a silence. The user who closed the prompt has
 * backed nothing up, so a dismissal that never expired would leave someone who
 * dismissed at five players unasked for the rest of their life. A month outlives
 * one nudge cycle, so closing the prompt costs one cycle and not every cycle.
 *
 * What would make a different number right: whether dismissals are being read
 * as "stop asking" by real users. If they are, the fix is a shorter interval
 * between *asks*, not a permanent mute — see the size clause in {@link covers}.
 */
const DISMISSAL_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** localStorage, wrapped: a blocked store degrades to "no answer" rather than throwing. */
function readPref(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writePref(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* blocked; the in-memory value still drives this session */
  }
}

function removePref(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* blocked; the in-memory value still drives this session */
  }
}

/**
 * What `tb-export-nudge-dismissed` holds.
 *
 * When the nudge was closed *and* how big the roster was at that moment,
 * because a dismissal covers the stakes it was given for and no more — the
 * roster it was about, for as long as that roster is the roster. Someone who
 * closes the prompt about five players has not answered a question about the
 * five they add next month, and that is precisely the case the prompt exists
 * for. A bare `"1"` — the shape the plan proposed — cannot express the second
 * number, so it can only ever be permanent.
 */
export interface NudgeDismissal {
  at: number;
  playerCount: number;
}

/** The two members of `StorageManager` this hook uses, detected separately. */
export interface StorageProbe {
  /** Reads the bucket's mode. Never prompts. */
  persisted?: () => Promise<boolean>;
  /** Requests persistence. Firefox shows the user a popup when this is first called. */
  persist?: () => Promise<boolean>;
}

export interface PersistenceVerdict {
  /** Is the origin's data actually persistent. `null` = nobody answered. */
  persisted: boolean | null;
  /** Did the browser grant our request. `null` = we never asked. */
  granted: boolean | null;
}

export interface DurabilityVerdict extends PersistenceVerdict {
  shouldNudge: boolean;
}

export interface DurabilityFacts extends PersistenceVerdict {
  playerCount: number;
  lastExportAt: number | null;
  dismissed: NudgeDismissal | null;
  now: number;
}

/**
 * Epoch ms, or `null` for anything that is not one. A stored string is not a
 * date, and neither is an empty one: `Number("")` and `Number("  ")` are both
 * `0`, which would render as "last export in 1970" — a value this app wrote no
 * user into believing.
 */
function readEpoch(raw: string | null): number | null {
  if (raw === null || raw.trim() === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}
/**
 * The stored facts, read once. `localStorage` is the one place a user can hand
 * this app an arbitrary string — from devtools, from a restored profile, from a
 * future version that wrote a different shape — so the parse rejects anything
 * it does not recognise instead of letting it mean "dismissed forever".
 *
 * What it cannot do is reject a value that *parses* and is still wrong: a
 * hand-edited, restored-from-another-machine or clock-skewed timestamp is a
 * perfectly good number in the wrong place. That case is not this function's
 * to catch — it has no clock — so {@link decideDurability} takes `now` and
 * refuses a timestamp that lies about when it happened.
 */
export function readDurabilityPrefs(): { lastExportAt: number | null; dismissed: NudgeDismissal | null } {
  let dismissed: NudgeDismissal | null = null;
  const raw = readPref(NUDGE_DISMISSED_KEY);
  if (raw !== null) {
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }
    if (typeof parsed === "object" && parsed !== null) {
      const { at, playerCount } = parsed as Partial<NudgeDismissal>;
      const sound =
        typeof at === "number" && Number.isFinite(at) && typeof playerCount === "number" && Number.isFinite(playerCount);
      if (sound) dismissed = { at, playerCount };
    }
  }
  return { lastExportAt: readEpoch(readPref(LAST_EXPORT_KEY)), dismissed };
}
/** The bucket's current mode, or `null` when nobody answered. A rejected read is not an answer. */
async function readPersisted(storage: StorageProbe): Promise<boolean | null> {
  if (!storage.persisted) return null;
  try {
    return await storage.persisted();
  } catch {
    return null;
  }
}

/**
 * What the browser says, and — the product decision — when the app asks.
 *
 * Two gates live in this file and they answer different questions, and they are
 * deliberately **not** the same gate:
 *
  - *Does this app ask the browser to keep the data?* — this function, and the
 *    answer is **yes, on mount, unconditionally**. The gate is the Storage API
 *    existing, nothing else.
 *  - *Does this app ask the user to back the data up?* — `MIN_PLAYERS_TO_NUDGE`
 *    in {@link decideDurability}. That one is about data volume and nobody's
 *    attention.
 *
 * They used to coincide, and that was wrong. The browsers disagree about what
 * asking costs:
 *
 *  - **Firefox** puts a permission popup in front of the user the first time a
 *    site asks.
 *  - **Chrome, Edge and Safari** answer silently, "based on the user's history
 *    of interaction with the site".
 *
 * Read the second line again: what a browser is likely to *grant* is a function
 * of engagement, not of how much data there is. Gating the request on roster
 * size therefore does not protect a brand-new visitor — it spends the request
 * on whichever user happens to cross the floor, which for a one-shot game is
 * their first and only visit, the least-engaged moment there is. Asking on mount
 * is where the free-grant window is open.
 *
 * **The cost, owned rather than inherited:** on Firefox a user may get a
 * permission dialog they did not ask for, part-way through getting teams onto a
 * court, prompted by nothing they did. Once per origin. The product accepts that
 * rather than inheriting a floor that buys less protection than it appears to.
 *
 * `navigator.storage.persisted()` only reads and never prompts, so it runs
 * first and unconditionally; an origin that is already persistent is never asked
 * again, because a request that buys nothing still costs the popup.
 */
export async function probePersistence(storage: StorageProbe): Promise<PersistenceVerdict> {
  const known = await readPersisted(storage);
  if (known === true) {
    // Already persistent — an installed app gets this without being asked.
    // `granted` stays null: the app did not ask, so it has no answer to report.
    return { persisted: true, granted: null };
  }
  if (!storage.persist) {
    // Nowhere to ask. Still not a refusal: nobody refused anything.
    return { persisted: known, granted: null };
  }
  let granted: boolean;
  try {
    granted = await storage.persist();
  } catch {
    // `persist()` rejects when the origin cannot get a storage shelf at all —
    // storage switched off, or an opaque origin. That is a definite no. Reporting
    // it as a grant is how a refusal becomes a promise.
    return { persisted: false, granted: false };
  }
  // The grant answers our question; the bucket is the state of the world. They
  // agree on the happy path and stop agreeing the moment the user clears site
  // data, so the field the copy reads is the second one. Where the browser cannot
  // be read back, the spec resolves `persist()` to true only when permission was
  // granted *and* the bucket is persistent — so the grant is not a second
  // opinion outvoted by the first, it is the same fact in fewer words.
  return { persisted: (await readPersisted(storage)) ?? granted, granted };
}

/**
 * Whether a dismissal still covers the roster as it stands now. Three ways to
 * stop covering it, and the first is that it was never a real dismissal.
 */
function covers(dismissal: NudgeDismissal | null, playerCount: number, now: number): boolean {
  if (dismissal === null) return false;
  // A dismissal stamped in the future did not happen here: a restored profile, a
  // hand-edited key, a machine whose clock was ahead when it was written. Trusting
  // it would mute the nudge for good over a value that parses cleanly and is
  // still wrong — the exact shape of value a parse cannot catch.
  if (dismissal.at > now) return false;
  // Time: a snooze, not a silence.
  if (now - dismissal.at > DISMISSAL_TTL_MS) return false;
  // Size: the user closed a prompt about the roster they had. It says nothing
  // about the next batch of players, and the next batch is what makes this data
  // worth losing.
  if (playerCount >= dismissal.playerCount + MIN_PLAYERS_TO_NUDGE) return false;
  return true;
}

/**
 * The whole decision, as a pure function of what is known, so the truth table is
 * provable without a browser and the hook is left with nothing but gathering the
 * facts.
 *
 * The nudge requires `persisted === false`: a *measured* refusal. `null` is not
 * a refusal, so a browser that never answers is never nagged about a risk
 * nobody reported — and a browser that granted persistence, or was granted it
 * before this app asked, is never nagged either.
 *
 * `now` is a parameter rather than a call to the clock, for the same reason the
 * stored timestamps are checked here and not at parse time: a fact about *when*
 * something happened is only meaningful against a clock, and a clock in a test is
 * a lie waiting to happen.
 */
export function decideDurability(facts: DurabilityFacts): DurabilityVerdict {
  const { persisted, granted } = facts;
  // A future-dated export is not a recent export. It is a hand-edited key, a
  // restored profile or a clock that was ahead when it was written, and treating
  // it as fresh mutes the nudge for years over a number that parses perfectly.
  // Clock skew of a few seconds costs one extra prompt, which is the cheap way
  // to be wrong.
  const exportIsStale =
    facts.lastExportAt === null || facts.lastExportAt > facts.now || facts.now - facts.lastExportAt > NUDGE_AFTER_MS;
  const shouldNudge =
    facts.persisted === false &&
    facts.playerCount >= MIN_PLAYERS_TO_NUDGE &&
    exportIsStale &&
    !covers(facts.dismissed, facts.playerCount, facts.now);
  return { persisted, granted, shouldNudge };
}

/**
 * Whether this app's data can be evicted by the browser without the user asking,
 * and what to do about it.
 *
 * Two of the returned values are tri-state on purpose. `persisted` is `null`
 * until a browser has answered, and `granted` is `null` until this app has asked
 * — and a consumer that renders either `null` as `false` has turned an unknown
 * into a bad news story. What a consumer owes the user:
 *
 *  - `persisted === true` — the only basis for saying the data is safe from
 *    eviction. It is one reading from one page load, nothing re-checks it, and
 *    the user can still clear it, so say it in the present tense and never as a
 *    guarantee.
 *  - `persisted === false` — the only basis for saying the data is at risk, and
 *    the only thing that raises `shouldNudge`.
 *  - `persisted === null` — say nothing about durability, or say that the browser
 *    has not said. Never "at risk", never "safe".
 *  - `granted` alone is never a basis for any of those sentences. It reports our
 *    question, not the browser's state.
 *
 * `shouldNudge` is a permission to ask, not a warning: it is true only when the
 * data is measurably best-effort, is worth losing, has not just been backed up,
 * and has not just been dismissed.
 *
 * Two handoff notes, because both are invisible until they bite:
 *
 *  - **This object is fresh every render.** Putting `d` in a dependency array
 *    re-runs the effect that produced it. Depend on `d.shouldNudge` or on the
 *    callbacks, which are stable, never on `d`.
 *  - **`shouldNudge` is computed against the clock at render time**, so it does
 *    not flip on its own: a tab left open across the cadence boundary keeps the
 *    answer it rendered with. Re-evaluating on a timer is a consumer's call.
 */
export interface Durability extends DurabilityVerdict {
  lastExportAt: number | null;
  dismissNudge: () => void;
  recordExport: () => void;
}

/**
 * A later answer never un-learns an earlier one.
 *
 * `null` means "no news", not "no". Without this, a probe that returns less than
 * the last one — the read unavailable on the second pass, the API gone — would
 * overwrite a permission the browser had already granted with a `null` it never
 * had, and quietly un-nudge a user who was correctly being asked to back up.
 */
export function mergePersistence(previous: PersistenceVerdict, next: PersistenceVerdict): PersistenceVerdict {
  return { persisted: next.persisted ?? previous.persisted, granted: next.granted ?? previous.granted };
}

export function useDurability({ playerCount }: { playerCount: number }): Durability {
  const [prefs, setPrefs] = useState(readDurabilityPrefs);
  const [known, setKnown] = useState<PersistenceVerdict>(UNKNOWN);
  const asked = useRef(false);

  useEffect(() => {
    const storage = typeof navigator === "undefined" ? undefined : navigator.storage;
    // No Storage API at all: stay unknown. There is nothing to ask and nothing
    // was answered, so there is nothing to report.
    if (!storage || asked.current) return;
    // Once per page load, and the effect never re-runs. A second request would
    // be a second chance to spend a Firefox permission dialog on a user who has
    // already answered it, and a roster that grows must not re-prompt.
    asked.current = true;
    let live = true;
    void probePersistence(storage).then(
      (verdict) => {
        if (live) setKnown((previous) => mergePersistence(previous, verdict));
      },
      () => {
        // Unreachable by construction — every await inside is guarded — but a
        // rejected probe is not an answer either, and this runs in the app shell.
        // `UNKNOWN` merges to a no-op, so there is nothing to write.
      },
    );
    return () => {
      live = false;
    };
  }, []);

  const dismissNudge = useCallback(() => {
    const dismissal: NudgeDismissal = { at: Date.now(), playerCount };
    setPrefs((prev) => ({ ...prev, dismissed: dismissal }));
    writePref(NUDGE_DISMISSED_KEY, JSON.stringify(dismissal));
  }, [playerCount]);

  const recordExport = useCallback(() => {
    const at = Date.now();
    setPrefs((prev) => ({ ...prev, lastExportAt: at, dismissed: null }));
    writePref(LAST_EXPORT_KEY, String(at));
    // Exporting is the act the nudge was asking for, so it also lifts the
    // dismissal. Leaving it would silence the next cycle too, for a user who did
    // the one thing the prompt wanted.
    removePref(NUDGE_DISMISSED_KEY);
  }, []);

  const { persisted, granted, shouldNudge } = decideDurability({
    ...known,
    playerCount,
    lastExportAt: prefs.lastExportAt,
    dismissed: prefs.dismissed,
    now: Date.now(),
  });

  return { persisted, granted, lastExportAt: prefs.lastExportAt, shouldNudge, dismissNudge, recordExport };
}
