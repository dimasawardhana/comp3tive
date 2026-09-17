import { describe, expect, it } from "vitest";
import { SEED_DISCIPLINES } from "../domain/seed";
import {
  MAX_IMPORT_BYTES,
  assertImportSize,
  csvRowsToPlayers,
  parsePlayerCsv,
} from "./player-import";

describe("parsePlayerCsv", () => {
  it("reads a quoted field containing a comma as one value", () => {
    const { rows, skipped } = parsePlayerCsv('name, discipline, strength\n"Smith, John", futsal, 4');
    expect(skipped).toEqual([]);
    expect(rows).toEqual([{ line: 2, name: "Smith, John", discipline: "futsal", strength: 4 }]);
  });

  it("unquotes a quoted field with no embedded comma", () => {
    const { rows } = parsePlayerCsv('name, discipline, strength\n"Budi", futsal, 4');
    expect(rows[0].name).toBe("Budi");
  });

  it("reads a doubled quote inside quotes as one literal quote", () => {
    const { rows } = parsePlayerCsv('name, discipline, strength\n"Say ""hi""", futsal, 4');
    expect(rows[0].name).toBe('Say "hi"');
  });

  it("reads a quoted field that spans a line as one value", () => {
    const { rows, skipped } = parsePlayerCsv('name,discipline,strength\n"Smith\nJohn", futsal, 4');
    expect(skipped).toEqual([]);
    expect(rows).toEqual([{ line: 2, name: "Smith\nJohn", discipline: "futsal", strength: 4 }]);
  });

  it("skips a quoted header", () => {
    const { rows, skipped } = parsePlayerCsv('"Name","Discipline","Strength"\nBudi,futsal,4');
    // `skipped` must be empty: the header is skipped, not rejected by a guard.
    expect(skipped).toEqual([]);
    expect(rows).toEqual([{ line: 2, name: "Budi", discipline: "futsal", strength: 4 }]);
  });

  it("skips an unquoted header", () => {
    const { rows, skipped } = parsePlayerCsv("Name,Discipline,Strength\nBudi,futsal,4");
    expect(skipped).toEqual([]);
    expect(rows).toEqual([{ line: 2, name: "Budi", discipline: "futsal", strength: 4 }]);
  });

  it("still detects the header after a leading blank line", () => {
    const { rows, skipped } = parsePlayerCsv("\nname,discipline,strength\nBudi, futsal, 4");
    expect(skipped).toEqual([]);
    expect(rows).toEqual([{ line: 3, name: "Budi", discipline: "futsal", strength: 4 }]);
  });

  it("imports a first-row player whose name merely contains the header word", () => {
    const { rows, skipped } = parsePlayerCsv("Nameer, futsal, 4");
    expect(skipped).toEqual([]);
    expect(rows).toEqual([{ line: 1, name: "Nameer", discipline: "futsal", strength: 4 }]);
  });

  it("imports a first-row player literally named Name", () => {
    const { rows, skipped } = parsePlayerCsv("Name, futsal, 4");
    expect(skipped).toEqual([]);
    expect(rows).toEqual([{ line: 1, name: "Name", discipline: "futsal", strength: 4 }]);
  });

  it("skips a row with fewer than three fields, by line number", () => {
    const { rows, skipped } = parsePlayerCsv("name, discipline, strength\nBudi, futsal\nAndi, futsal, 4");
    expect(rows.map((r) => r.line)).toEqual([3]);
    expect(skipped).toEqual([
      { line: 2, reason: "Expected 3 columns (name, discipline, strength), found 2." },
    ]);
  });

  it("skips a strength that is not a number rather than defaulting it", () => {
    const { skipped } = parsePlayerCsv("name, discipline, strength\nBudi, futsal, strong");
    expect(skipped).toEqual([{ line: 2, reason: 'Strength "strong" is not a number.' }]);
  });

  it("reports an unclosed quote once, and invents no player from its tail", () => {
    const { rows, skipped } = parsePlayerCsv('name,discipline,strength\n"Smith\nJohn, futsal, 4');
    expect(rows).toEqual([]);
    expect(skipped).toEqual([
      { line: 2, reason: "Unclosed quoted field; this record was not imported." },
    ]);
  });
});

describe("csvRowsToPlayers", () => {
  it("reports an unknown discipline by line and by the name as typed", () => {
    const { rows } = parsePlayerCsv("name, discipline, strength\nBudi, quidditch, 4");
    const { players, skipped } = csvRowsToPlayers(rows, SEED_DISCIPLINES, "c1");
    // Never a player with capabilities: [] — that is today's silent outcome.
    expect(players).toEqual([]);
    expect(skipped).toEqual([{ line: 2, reason: 'Unknown discipline "quidditch".' }]);
  });

  it("builds a full capability for a valid row", () => {
    const { rows } = parsePlayerCsv("Budi, futsal, 4");
    const { players, skipped } = csvRowsToPlayers(rows, SEED_DISCIPLINES, "c1");
    expect(skipped).toEqual([]);
    expect(players).toHaveLength(1);
    const cap = players[0].capabilities[0];
    expect(cap.disciplineId).toBe("futsal");
    expect(Object.keys(cap.attributeRatings).sort()).toEqual(["fitness", "game-iq", "technical"]);
    expect(cap.eligibleRoles).toHaveLength(4);
  });

  it("clamps a strength outside 1..5", () => {
    const { rows } = parsePlayerCsv("Budi, futsal, 9");
    const { players } = csvRowsToPlayers(rows, SEED_DISCIPLINES, "c1");
    expect(players[0].capabilities[0].attributeRatings.technical).toBe(5);
  });
});

describe("assertImportSize", () => {
  it("refuses a 6 MB file with the limit in the message", () => {
    expect(() => assertImportSize(6 * 1024 * 1024)).toThrow(
      /^Import refused: this file is 6\.0 MB; the limit is 5\.0 MB\.$/,
    );
  });

  it("accepts a file at the limit", () => {
    expect(() => assertImportSize(MAX_IMPORT_BYTES)).not.toThrow();
  });
});
