import { describe, expect, it } from "vitest";
import { parseBackup } from "./transfer";
import { validatePlayer } from "../domain/validation";
import { SEED_DISCIPLINES } from "../domain/seed";
import futsalRoster from "../../sample-data/futsal-roster.json";
import mplRoster from "../../sample-data/mpl-id-roster.json";

/**
 * The files the app hands the user itself: `DisciplinesScreen` renders a
 * "Sample" button per discipline and `sample-data.ts` serves these two, so the
 * import feature consumes the output of the download feature. A file that fails
 * `validatePlayer` is refused by `parseBackup` (App.tsx passes the catalog), and
 * the round trip the app advertises breaks with no test noticing — which is
 * exactly what shipped before this file existed: 7 of the 25 futsal players
 * preferred a role outside their own eligibility list (`pivot` appears in no
 * player's `eligibleRoles`), so "Sample -> Import players" aborted on the first
 * one with `Backup player "CW" is invalid: Preferred role "pivot" must be
 * inside the eligibility list.`
 *
 * Both files are imported the way `sample-data.ts` imports them, so this covers
 * the shipped bytes rather than a hand-copied fixture.
 */
const samples = [
  { fileName: "futsal-roster.json", roster: futsalRoster, playerCount: 25 },
  { fileName: "mpl-id-roster.json", roster: mplRoster, playerCount: 25 },
] as const;

describe("shipped sample data round-trips through the import it feeds", () => {
  for (const { fileName, roster, playerCount } of samples) {
    it(`parses sample-data/${fileName} with the seeded catalog`, () => {
      const parsed = parseBackup(JSON.stringify(roster), SEED_DISCIPLINES);

      // A thrown error is the failure mode: the sample was refused.
      expect(parsed.players).toHaveLength(playerCount);
      // parseBackup drops only the unknown-discipline rule; a sample for a
      // seeded discipline is held to every invariant, so this is the same
      // check the importer ran, spelled out per player.
      for (const player of parsed.players) {
        expect(validatePlayer(player, SEED_DISCIPLINES)).toEqual([]);
      }
    });
  }
});
