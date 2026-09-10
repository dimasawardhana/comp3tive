import type { Discipline } from "../domain/types";
import mplRoster from "../../sample-data/mpl-id-roster.json";
import futsalRoster from "../../sample-data/futsal-roster.json";
const SAMPLE_DATA: Record<string, string> = {
  mlbb: JSON.stringify(mplRoster),
  futsal: JSON.stringify(futsalRoster),
};

const BLOB_URLS: Record<string, string> = {};

export function hasSampleData(disciplineId: string): boolean {
  return disciplineId in SAMPLE_DATA;
}

export function addSampleData(disciplineId: string, jsonText: string): void {
  SAMPLE_DATA[disciplineId] = jsonText;
  if (BLOB_URLS[disciplineId]) {
    URL.revokeObjectURL(BLOB_URLS[disciplineId]);
    delete BLOB_URLS[disciplineId];
  }
}

export function listDisciplinesWithSampleData(): string[] {
  return Object.keys(SAMPLE_DATA);
}

export function getSampleDataInfo(disciplineId: string): { fileName: string; playerCount: number } | null {
  const text = SAMPLE_DATA[disciplineId];
  if (!text) return null;
  const data = JSON.parse(text);
  return {
    fileName: `${disciplineId}-roster.json`,
    playerCount: data.players?.length ?? 0,
  };
}

export function getSampleDataUrl(disciplineId: string): string | null {
  if (!hasSampleData(disciplineId)) return null;
  if (!BLOB_URLS[disciplineId]) {
    const blob = new Blob([SAMPLE_DATA[disciplineId]], { type: "application/json" });
    BLOB_URLS[disciplineId] = URL.createObjectURL(blob);
  }
  return BLOB_URLS[disciplineId];
}

export function downloadSampleData(disciplineId: string): void {
  const url = getSampleDataUrl(disciplineId);
  if (!url) return;
  const info = getSampleDataInfo(disciplineId);
  const a = document.createElement("a");
  a.href = url;
  a.download = info?.fileName ?? `${disciplineId}-roster.json`;
  a.click();
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

const ROLE_NAMES = [
  "Tank", "Assassin", "Mage", "Marksman", "Fighter", "Support",
  "Guardian", "Controller", "Eraser", "Durable",
];
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
