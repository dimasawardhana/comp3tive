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

/**
 * Split one CSV line into fields. `"` toggles in-quote, `""` inside quotes is a
 * literal quote, and a comma inside quotes is data — so `"Smith, John", futsal, 4`
 * is three fields, not four.
 */
function splitCsvLine(line: string): string[] {
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
  return fields;
}

/** A header row is one whose first field mentions "name"; it carries no player. */
function isHeader(fields: string[]): boolean {
  return (fields[0] ?? "").toLowerCase().includes("name");
}

/**
 * Parse a player CSV into rows and skips. The header is detected on the parsed
 * first row, so a quoted header still skips.
 */
export function parsePlayerCsv(text: string): { rows: CsvRow[]; skipped: ImportSkip[] } {
  const rows: CsvRow[] = [];
  const skipped: ImportSkip[] = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = i + 1;
    if (lines[i].trim() === "") continue;
    const fields = splitCsvLine(lines[i]);
    if (i === 0 && isHeader(fields)) continue;
    if (fields.length < 3) {
      skipped.push({
        line,
        reason: `Expected 3 columns (name, discipline, strength), found ${fields.length}.`,
      });
      continue;
    }
    const [name, discipline, rawStrength] = fields;
    if (name === "") {
      skipped.push({ line, reason: "The name column is empty." });
      continue;
    }
    const strength = rawStrength === "" ? 3 : Number(rawStrength);
    if (!Number.isFinite(strength)) {
      skipped.push({ line, reason: `Strength "${rawStrength}" is not a number.` });
      continue;
    }
    rows.push({ line, name, discipline: discipline.toLowerCase(), strength });
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
