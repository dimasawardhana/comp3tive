/**
 * The one name resolver, and the one list it prints.
 *
 * Eleven places under `src/` carried the ghost placeholder `?? "?"`. Nine of
 * them wrote the whole lookup, `roster.find((p) => p.id === id)?.name ?? "?"`,
 * and three of those nine were a local `nameOf` closure. Seven now call these
 * two functions.
 *
 * Four are held on purpose, and each for its own reason rather than as a
 * number: `SplitScreen.tsx:91` and `:397`, which `contracts.md` holds at zero
 * removed lines; `TournamentScreen.tsx:490`, which resolves a tournament
 * *team* and not a player, out of a different collection with a different
 * fallback; and `fairness.test.ts:304`, which must not build its oracle out
 * of the helper it is testing.
 *
 * Every expected string below is written out, never taken from these
 * functions, because a test that computed its oracle with the resolver would
 * pass for any wiring at all. The one thing being pinned is the shape of the
 * contract the other seven call sites now depend on.
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
