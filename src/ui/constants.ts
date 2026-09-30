import type { TournamentFormat, TournamentStatus } from "../domain/types";

/** Team stripe colours, in split order. Indexed modulo its own length. */
export const BIB: readonly ["a", "b", "c", "d", "e"] = ["a", "b", "c", "d", "e"];

/** Human labels per bracket format. D16 adds "round-robin" to the union and to this record. */
export const FORMAT_LABEL: Record<TournamentFormat, string> = {
  series: "Series",
  "single-elim": "Single elimination",
  swiss: "Swiss",
  "round-robin": "Round robin",
};

/** Human labels per tournament lifecycle state. */
export const STATUS_LABEL: Record<TournamentStatus, string> = {
  draft: "Draft",
  active: "In progress",
  complete: "Complete",
};

/**
 * The formats the create modal offers, in the order it shows them.
 *
 * This is a claim about the **app**; `TournamentFormat` is a claim about the
 * **domain**. The two are deliberately not the same size. A format joins this
 * list when a visitor can run it end to end — a chip in the create modal and a
 * tournament view that does not lie about what the bracket is. Round robin
 * joined in Task 8, on the chip and the count the Landing Page's Formats rail
 * states, and the same commit updated the rail and the sentence beside it: the
 * page must not claim a format the app cannot open, nor under-claim one it
 * can. Both directions are guarded in `e2e/tests/landing/landing.spec.ts`.
 */
export const SELECTABLE_FORMATS: readonly TournamentFormat[] = [
  "series",
  "single-elim",
  "swiss",
  "round-robin",
];
