import { registeredSampleData, sampleDataUrl } from "./sample-registry";

/**
 * The sample rosters, and the only module that names a roster file.
 *
 * These three JSON files are 28 kB — the heaviest thing the app ships — and a
 * user who never presses "Sample" never wants them, so each is behind its own
 * `await import()` and lands in a chunk fetched at that moment. A static import
 * cannot work here: it would put every roster in the entry chunk, which is the
 * thing this split exists to stop. The registry half (./sample-registry) is
 * what the app imports statically; this file is reached only through
 * `await import("./data/sample-data")`.
 */
const ASSETS: Record<string, () => Promise<{ default: unknown }>> = {
  mlbb: () => import("../../sample-data/mpl-id-roster.json"),
  futsal: () => import("../../sample-data/futsal-roster.json"),
  badminton: () => import("../../sample-data/badminton-roster.json"),
};

/** The roster JSON text for a discipline: the built-in file, else the registered text. */
export async function loadSampleData(disciplineId: string): Promise<string | null> {
  const registered = registeredSampleData(disciplineId);
  if (registered) return registered;
  const load = ASSETS[disciplineId];
  if (!load) return null;
  const mod = await load();
  return JSON.stringify(mod.default);
}

export async function getSampleDataInfo(disciplineId: string): Promise<{ fileName: string; playerCount: number } | null> {
  const text = await loadSampleData(disciplineId);
  if (!text) return null;
  const data = JSON.parse(text) as { players?: unknown[] };
  return {
    fileName: `${disciplineId}-roster.json`,
    playerCount: data.players?.length ?? 0,
  };
}

export async function getSampleDataUrl(disciplineId: string): Promise<string | null> {
  const text = await loadSampleData(disciplineId);
  if (!text) return null;
  return sampleDataUrl(disciplineId, text);
}

export async function downloadSampleData(disciplineId: string): Promise<void> {
  const url = await getSampleDataUrl(disciplineId);
  if (!url) return;
  const info = await getSampleDataInfo(disciplineId);
  const a = document.createElement("a");
  a.href = url;
  a.download = info?.fileName ?? `${disciplineId}-roster.json`;
  a.click();
}
