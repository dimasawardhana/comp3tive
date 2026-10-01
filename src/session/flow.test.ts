/**
 * The one name resolver, and the one list it prints.
 *
 * Eleven places under `src/` carried the ghost placeholder `?? "?"`. Nine of
 * them wrote the whole lookup, `roster.find((p) => p.id === id)?.name ?? "?"`,
 * and three of those nine were a local `nameOf` closure. **Eight** now call these
 * two functions: `SplitScreen.tsx:397` converted on 2026-10-01, which was the
 * last of the eight that was genuinely the same work in the same shape.
 *
 * Three are held on purpose, and each for its own reason rather than as a
 * number. These are recorded here because this file's subject is the decision,
 * so that the next sweep reads the reason before it re-reports the site.
 *
 * **`SplitScreen.tsx:91`, `{player?.name ?? "?"}`.** The reason usually given
 * is that it resolves a `Player | undefined` rather than an id, and that is true
 * of the expression but is not why the line is right. `player` is bound at `:71`
 * as `roster.find((p) => p.id === slot.playerId)` and is used again at `:73` for
 * `playerCapability(player, discipline)`. **The lookup has already happened**, by
 * the line that needs the whole `Player`, so `nameOf(roster, slot.playerId)`
 * would scan the same array a second time to reprint a value already in hand.
 * It is not a duplicate that survived the sweep; it is the shape the sweep
 * produces.
 *
 * **`TournamentScreen.tsx:490`, `{team?.name ?? "?"}`.** It resolves a
 * tournament `Team` via `teamOf(tournament, row.teamId)` at `:484`, out of the
 * tournament rather than a roster, and `nameOf`'s first parameter is a
 * `Player[]`. No conversion exists that is not a cast. The `"TBD"` fallback
 * often attributed to this line belongs to the separate local `nameOf` closure
 * at `TournamentScreen.tsx:479`, which resolves a `TournamentMatch`'s
 * `teamAId`/`teamBId` and is the one place a missing team is *expected* rather
 * than *ghosted*. That closure is not one of the `?? "?"` sites and stays.
 *
 * **`src/share/fairness.test.ts:304`.** It builds this repository's own oracle,
 * the benched names compared against `sitOuts(composedLine(WITH_SITS))`. Written
 * as `nameOf` or `namesOf` it would compare the resolver against itself and pass
 * for any wiring at all, including the wiring the file exists to catch.
 *
 * Every expected string below is written out, never taken from these
 * functions, for that same reason. The one thing being pinned is the shape of
 * the contract the other eight call sites now depend on.
 */
import { describe, expect, it } from "vitest";
import { nameOf, namesOf } from "./flow";
import type { Player } from "../domain/types";

/** A roster entry, reduced to the two fields the resolver reads. */
const person = (id: string, name: string): Player => ({ id, name }) as unknown as Player;

const ROSTER: Player[] = [person("p1", "Dewi"), person("p2", "Citra"), person("p3", "Kresna Rangga")];

describe("nameOf", () => {
  it("prints the name the roster holds for the id", () => {
    expect(nameOf(ROSTER, "p2")).toBe("Citra");
  });

  it("prints the ghost, not an empty entry, for an id the roster no longer holds", () => {
    // The `?` is a name-shaped hole, not punctuation. A reader counts an entry
    // there, so a parse that stopped at it would report a name that was never
    // missing. It is also why no surface may put a sentence mark straight after
    // one: `fairness.ts` closes its list with a semicolon for exactly that, and
    // a full stop would print "?." on the chat paste and on the painted poster,
    // which cannot be corrected once it has been sent.
    expect(nameOf(ROSTER, "gone")).toBe("?");
  });

  it("finds the id wherever the roster holds it", () => {
    // Not "the first match": `result.unassigned` and `advice.insteadOf` are
    // both ordered by strength, not by the roster, so a resolver that assumed
    // position would name the wrong person on every pool where the two orders
    // differ.
    expect(nameOf(ROSTER, "p3")).toBe("Kresna Rangga");
  });

  it("is the same answer on an empty roster as on one missing that id", () => {
    expect(nameOf([], "p1")).toBe("?");
  });
});

describe("namesOf", () => {
  it("joins the names in the order the ids come, not the order the roster holds", () => {
    // This is the order the three not-playing surfaces print, and it is the
    // order `result.unassigned` arrives in. Re-sorting by strength here would
    // quietly reorder every sit-out list on the screen, in the chat paste and
    // on the poster.
    expect(namesOf(ROSTER, ["p3", "p1"])).toBe("Kresna Rangga, Dewi");
  });

  it("is the empty string for no ids, which is what drops the 'instead of' clause", () => {
    // `benchAdvice.ts` branches on `instead === ""` to drop "instead of" when
    // the alternative has nobody of its own on the bench. A resolver returning
    // `undefined` or a bare `", "` there would print the clause with nothing
    // after it.
    expect(namesOf(ROSTER, [])).toBe("");
  });

  it("keeps a ghost as its own entry in the list", () => {
    // A list of three where the middle id is stale reads as three names to a
    // reader, so the entry is counted; dropping it would read as a two-person
    // bench when three people sat out.
    expect(namesOf(ROSTER, ["p1", "gone", "p2"])).toBe("Dewi, ?, Citra");
  });

  it("agrees with `nameOf` on every id, so a caller cannot get two answers", () => {
    // The pair is one concept at two lengths. A future edit to one that misses
    // the other is a list and its own members disagreeing about who sat out.
    for (const id of ["p1", "p2", "p3", "gone"]) {
      expect(namesOf(ROSTER, [id])).toBe(nameOf(ROSTER, id));
    }
  });
});
