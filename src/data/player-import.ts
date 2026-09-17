import type { Discipline, Id, Player } from "../domain/types";

/** Refuse a file too large to parse sensibly. A guard, not a security control. */
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
/**
 * Physical lines one record may span. A quoted value carrying one newline is
 * real; a longer run means an unbalanced quote. Keeping this at two is what
 * bounds the damage a single stray quote can do — at most the one line it drags
 * along — and reading resumes on the line after the bad record, never at EOF.
 */
const MAX_RECORD_LINES = 2;

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
    const firstLine = i;
    const start = firstLine + 1;
    const isFirstRecord = !seenRecord;
    // A quoted field may span lines: join them while the quote stays open, but for
    // at most MAX_RECORD_LINES. The joining is a candidate read — a record whose
    // quote never closes is reported once against its first line and the next line
    // is then read on its own, so one stray quote can never claim the rest of the
    // file. The cost is that the line such a candidate reached over is read as its
    // own record; losing rows would be the worse trade.
    let last = firstLine;
    let raw = lines[firstLine];
    let parsed = splitCsvLine(raw);
    while (parsed.open && last + 1 < lines.length && last < firstLine + MAX_RECORD_LINES - 1) {
      last++;
      raw += `\n${lines[last]}`;
      parsed = splitCsvLine(raw);
    }
    if (parsed.open) {
      i = firstLine + 1;
      skipped.push({ line: start, reason: "Unclosed quoted field; this record was not imported." });
      continue;
    }
    i = last + 1;
    seenRecord = true;
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
