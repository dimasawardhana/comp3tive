import type { Discipline, Id, Player } from "../domain/types";

/** Refuse a file too large to parse sensibly. A guard, not a security control. */
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

/** One successfully parsed CSV line, with its 1-based line number preserved. */
export interface CsvRow {
  line: number;
  name: string;
  discipline: string;
  strength: number;
}

/** One line that could not be imported, with the reason to show the user. */
export interface ImportSkip {
  line: number;
  reason: string;
}

/** Throw when a file is larger than the import limit, naming both numbers. */
export function assertImportSize(bytes: number): void {
  if (bytes <= MAX_IMPORT_BYTES) return;
  const mb = (n: number) => (n / (1024 * 1024)).toFixed(1);
  throw new Error(`Import refused: this file is ${mb(bytes)} MB; the limit is ${mb(MAX_IMPORT_BYTES)} MB.`);
}

/** One parsed line: the fields, and whether a quoted field was left open. */
interface ParsedLine {
  fields: string[];
  /** True when the line ends inside quotes, so its record continues on the next. */
  open: boolean;
}

/**
 * Split one CSV line into fields. `"` toggles in-quote, `""` inside quotes is a
 * literal quote, and a comma inside quotes is data — so `"Smith, John", futsal, 4`
 * is three fields, not four. `open` reports a quote that never closed, which
 * means the record runs on to the following line.
 */
function splitCsvLine(line: string): ParsedLine {
  const fields: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') inQuotes = true;
    else if (ch === ",") {
      fields.push(field.trim());
      field = "";
    } else field += ch;
  }
  fields.push(field.trim());
  return { fields, open: inQuotes };
}

/**
 * A header row is the header triple: `name` alone in column one, plus either the
 * heading word `discipline` in column two or a third column that is not a
 * rating. Comparing the whole first field instead of searching it for the
 * substring `name` is the point — the old heuristic silently swallowed a
 * first-row player called `Nameer`, `Surname` or `Renamed`, importing nothing and
 * reporting nothing. A player literally named `Name` imports too, since a data
 * row has a numeric third column.
 *
 * Reading a heading as a header can lose no player: a row with a non-numeric
 * strength column was already refused by the strength guard, and a row whose
 * discipline column is the literal word `discipline` was already refused as an
 * unknown discipline. Both would have been skips, not players.
 */
function isHeader(fields: string[]): boolean {
  if ((fields[0] ?? "").trim().toLowerCase() !== "name") return false;
  if (!Number.isFinite(Number((fields[2] ?? "").trim()))) return true;
  return (fields[1] ?? "").trim().toLowerCase() === "discipline";
}

/**
 * Parse a player CSV into rows and skips. The header is read off the first
 * logical record, so a quoted header and a leading blank line both still skip,
 * and a quoted field may carry a newline.
 */
export function parsePlayerCsv(text: string): { rows: CsvRow[]; skipped: ImportSkip[] } {
  const rows: CsvRow[] = [];
  const skipped: ImportSkip[] = [];
  const lines = text.split(/\r?\n/);
  let seenRecord = false;
  let i = 0;
  while (i < lines.length) {
    if (lines[i].trim() === "") {
      i++;
      continue;
    }
    const start = i + 1;
    const isFirstRecord = !seenRecord;
    seenRecord = true;
    // A quoted field may span lines: keep reading while a quote stays open.
    let raw = lines[i];
    let parsed = splitCsvLine(raw);
    while (parsed.open && i + 1 < lines.length) {
      i++;
      raw += `\n${lines[i]}`;
      parsed = splitCsvLine(raw);
    }
    i++;
    if (parsed.open) {
      // A quote that never closes is one bad record, reported once — its trailing
      // lines must not be imported as a fragment of its name.
      skipped.push({ line: start, reason: "Unclosed quoted field; this record was not imported." });
      continue;
    }
    const fields = parsed.fields;
    if (isFirstRecord && isHeader(fields)) continue;
    if (fields.length < 3) {
      skipped.push({
        line: start,
        reason: `Expected 3 columns (name, discipline, strength), found ${fields.length}.`,
      });
      continue;
    }
    const [name, discipline, rawStrength] = fields;
    if (name === "") {
      skipped.push({ line: start, reason: "The name column is empty." });
      continue;
    }
    const strength = rawStrength === "" ? 3 : Number(rawStrength);
    if (!Number.isFinite(strength)) {
      skipped.push({ line: start, reason: `Strength "${rawStrength}" is not a number.` });
      continue;
    }
    rows.push({ line: start, name, discipline: discipline.toLowerCase(), strength });
  }
  return { rows, skipped };
}

/**
 * Turn parsed rows into Players. A discipline that matches nothing goes to
 * `skipped` with its line number — never to a player who cannot play anything.
 */
export function csvRowsToPlayers(
  rows: CsvRow[],
  disciplines: Discipline[],
  communityId: Id,
): { players: Player[]; skipped: ImportSkip[] } {
  const players: Player[] = [];
  const skipped: ImportSkip[] = [];
  for (const row of rows) {
    const discipline = disciplines.find(
      (d) => d.shortName.toLowerCase() === row.discipline || d.name.toLowerCase() === row.discipline,
    );
    if (!discipline) {
      skipped.push({ line: row.line, reason: `Unknown discipline "${row.discipline}".` });
      continue;
    }
    const rating = Math.max(1, Math.min(5, row.strength)) as 1 | 2 | 3 | 4 | 5;
    players.push({
      id: crypto.randomUUID(),
      communityId,
      name: row.name,
      capabilities: [
        {
          disciplineId: discipline.id,
          attributeRatings: Object.fromEntries(discipline.attributes.map((a) => [a.id, rating])),
          eligibleRoles: discipline.roles.map((r) => r.id),
          preferredRole: null,
        },
      ],
    });
  }
  return { players, skipped };
}
