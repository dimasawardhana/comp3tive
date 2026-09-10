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
