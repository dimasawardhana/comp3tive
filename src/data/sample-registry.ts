import type { Discipline } from "../domain/types";
import { SEED_DISCIPLINES } from "../domain/seed";

/**
 * Which disciplines have a sample roster, and the text registered for one —
 * with no roster bytes in this file.
 *
 * The three shipped rosters are 28 kB of JSON, and a user who never presses
 * "Sample" never wants them. So the JSON lives behind `await import()` in
 * ./sample-data, and this module is the half that is safe to import statically:
 * `useDisciplines` needs it on every discipline add, and it is what the app
 * bundle therefore still pays for.
 *
 * The seeded ids are *derived* from SEED_DISCIPLINES, not written out again
 * here. Every seeded discipline ships a roster in /sample-data (asserted in
 * sample-data.test.ts, which loads each one), and a hand-kept third copy of
 * that list is a list that goes stale the moment someone adds a discipline.
 */

/** Every seeded discipline ships a roster; the files themselves are in ./sample-data. */
const SEEDED_IDS: readonly string[] = SEED_DISCIPLINES.map((d) => d.id);

/** Roster text registered at runtime: a custom discipline, or a re-import. */
const SAMPLE_DATA: Record<string, string> = {};

/** One object URL per discipline, dropped when its roster is re-registered. */
const BLOB_URLS: Record<string, string> = {};

export function hasSampleData(disciplineId: string): boolean {
  return SEEDED_IDS.includes(disciplineId) || disciplineId in SAMPLE_DATA;
}

export function addSampleData(disciplineId: string, jsonText: string): void {
  SAMPLE_DATA[disciplineId] = jsonText;
  if (BLOB_URLS[disciplineId]) {
    URL.revokeObjectURL(BLOB_URLS[disciplineId]);
    delete BLOB_URLS[disciplineId];
  }
}

export function listDisciplinesWithSampleData(): string[] {
  return [...SEEDED_IDS, ...Object.keys(SAMPLE_DATA)];
}

/** The roster JSON text registered for a discipline, or null if none is. */
export function registeredSampleData(disciplineId: string): string | null {
  return SAMPLE_DATA[disciplineId] ?? null;
}

/**
 * The download URL for a roster's text, one object URL per discipline.
 *
 * The cache lives beside the text it was built from: re-registering a roster
 * has to revoke the URL already handed to the browser, and the loader that
 * mints the URL cannot see the registry's other half.
 */
export function sampleDataUrl(disciplineId: string, text: string): string {
  if (!BLOB_URLS[disciplineId]) {
    const blob = new Blob([text], { type: "application/json" });
    BLOB_URLS[disciplineId] = URL.createObjectURL(blob);
  }
  return BLOB_URLS[disciplineId];
}

export function detectDisciplineFromSampleData(text: string): string | null {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null) return null;
  const players = (data as Record<string, unknown>).players;
  if (!Array.isArray(players) || players.length === 0) return null;
  const firstPlayer = players[0] as Record<string, unknown>;
  const caps = firstPlayer?.capabilities;
  if (!Array.isArray(caps) || caps.length === 0) return null;
  const disciplineId = caps[0]?.disciplineId;
  if (typeof disciplineId !== "string") return null;
  return disciplineId;
}

const PLAYER_NAMES = [
  "Dragon", "Shadow", "Blaze", "Frost", "Storm", "Ember",
  "Void", "Nova", "Apex", "Pulse", "Iron", "Crimson",
  "Haze", "Rune", "Bolt", "Wraith", "Spark", "Titan",
  "Drift", "Flux", "Zenith", "Prism", "Onyx", "Viper",
];

const randInt = (min: number, max: number): number =>
  Math.floor(Math.random() * (max - min + 1)) + min;

/** Generate a sample roster JSON for a discipline based on its roles and attributes. */
export function autoGenerateSampleData(discipline: Discipline): string {
  const playerCount = discipline.team.minTeamSize * 5; // ~25 players for minTeamSize=5
  const players = Array.from({ length: playerCount }, (_, i) => {
    const roleCount = randInt(1, Math.min(3, discipline.roles.length));
    const eligibleRoles = [...discipline.roles]
      .sort(() => Math.random() - 0.5)
      .slice(0, roleCount);
    const preferredRole = eligibleRoles[Math.floor(Math.random() * eligibleRoles.length)];
    const attributeRatings: Record<string, number> = {};
    for (const attr of discipline.attributes) {
      attributeRatings[attr.id] = randInt(attr.min ?? 1, attr.max ?? 5);
    }
    return {
      id: `p${i + 1}`,
      name: PLAYER_NAMES[i % PLAYER_NAMES.length],
      notes: "",
      capabilities: [{
        disciplineId: discipline.id,
        attributeRatings,
        eligibleRoles: eligibleRoles.map((r) => r.id),
        preferredRole: preferredRole ? preferredRole.id : null,
      }],
    };
  });

  const data = {
    version: 1 as const,
    exportedAt: new Date().toISOString(),
    players,
    sessions: [] as unknown[],
  };
  return JSON.stringify(data, null, 2);
}
