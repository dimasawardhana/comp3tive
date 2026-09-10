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
  const text = SAMPLE_DATA[disciplineId];
  if (!text) return;
  const info = getSampleDataInfo(disciplineId);
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = info?.fileName ?? `${disciplineId}-roster.json`;
  a.click();
  URL.revokeObjectURL(url);
}
