import { describe, it, expect, vi } from "vitest";
import { hasSampleData, listDisciplinesWithSampleData, autoGenerateSampleData } from "./sample-registry";
import { loadSampleData, getSampleDataInfo, getSampleDataUrl, downloadSampleData } from "./sample-data";
import type { Discipline } from "../domain/types";
describe("sample-data registry", () => {
  it("has sample data for mlbb", () => {
    expect(hasSampleData("mlbb")).toBe(true);
  });

  it("has sample data for futsal", () => {
    expect(hasSampleData("futsal")).toBe(true);
  });

  it("has sample data for badminton", () => {
    expect(hasSampleData("badminton")).toBe(true);
  });

  it("the badminton sample is the roster the registry names", async () => {
    // The download feature writes this file name to the user's disk, so the
    // registry key and the shipped file have to be the same name.
    expect(await getSampleDataInfo("badminton")).toEqual({ fileName: "badminton-roster.json", playerCount: 10 });
  });

  it("has no sample data for unknown", () => {
    expect(hasSampleData("unknown")).toBe(false);
  });

  it("lists disciplines with sample data", () => {
    const list = listDisciplinesWithSampleData();
    expect(list).toContain("mlbb");
    expect(list).toContain("futsal");
    expect(list).toContain("badminton");
    expect(list).toHaveLength(3);
  });

  it("returns sample data info", async () => {
    const info = await getSampleDataInfo("mlbb");
    expect(info).not.toBeNull();
    expect(info?.playerCount).toBeGreaterThan(0);
    expect(info?.fileName).toBe("mlbb-roster.json");
  });

  it("returns null for unknown sample data info", async () => {
    expect(await getSampleDataInfo("unknown")).toBeNull();
  });

  it("returns a blob URL", async () => {
    const url = await getSampleDataUrl("mlbb");
    expect(url).not.toBeNull();
    expect(url?.startsWith("blob:")).toBe(true);
  });

  it("returns null for unknown sample data URL", async () => {
    expect(await getSampleDataUrl("unknown")).toBeNull();
  });

  it("every discipline the registry lists resolves to a roster on disk", async () => {
    // The registry derives its ids from SEED_DISCIPLINES and the loader names
    // the files. Nothing else ties the two together: add a seeded discipline
    // without shipping its roster and this is where it shows.
    for (const id of listDisciplinesWithSampleData()) {
      const text = await loadSampleData(id);
      if (text === null) throw new Error(`${id} is listed as having sample data, but loads none`);
      expect(JSON.parse(text).version).toBe(1);
    }
  });

  it("downloadSampleData creates a blob and downloads", async () => {
    const clickSpy = vi.fn();
    vi.stubGlobal("document", { createElement: () => ({ click: clickSpy, setAttribute: vi.fn(), href: "" }) });
    await expect(downloadSampleData("mlbb")).resolves.not.toThrow();
  });
});

describe("autoGenerateSampleData", () => {
  const makeDiscipline = (overrides: Record<string, unknown> = {}): Discipline => ({
    id: "test-disc",
    name: "Test Discipline",
    shortName: "Test",
    roles: [
      { id: "tank", name: "Tank" },
      { id: "mage", name: "Mage" },
    ],
    attributes: [
      { id: "mech", name: "Mechanics", min: 1, max: 5 },
      { id: "team", name: "Teamwork", min: 1, max: 3 },
    ],
    strengthModel: { kind: "mean" },
    team: { minTeamSize: 5, maxTeamSize: 5, rolesRequired: true },
    ...overrides,
  });

  it("generates valid sample data with players", () => {
    const json = autoGenerateSampleData(makeDiscipline());
    const data = JSON.parse(json);
    expect(data.version).toBe(1);
    expect(data.players.length).toBe(25); // minTeamSize * 5
    expect(data.sessions).toEqual([]);
  });

  it("each player has capabilities matching the discipline", () => {
    const json = autoGenerateSampleData(makeDiscipline());
    const data = JSON.parse(json);
    for (const player of data.players) {
      expect(player.capabilities).toHaveLength(1);
      expect(player.capabilities[0].disciplineId).toBe("test-disc");
      expect(player.capabilities[0].attributeRatings).toBeDefined();
      expect(player.capabilities[0].eligibleRoles).toBeDefined();
      expect(player.capabilities[0].preferredRole).toBeDefined();
    }
  });

  it("attribute ratings respect min/max bounds", () => {
    const json = autoGenerateSampleData(makeDiscipline());
    const data = JSON.parse(json);
    for (const player of data.players) {
      const ratings = player.capabilities[0].attributeRatings;
      expect(ratings.mech).toBeGreaterThanOrEqual(1);
      expect(ratings.mech).toBeLessThanOrEqual(5);
      expect(ratings.team).toBeGreaterThanOrEqual(1);
      expect(ratings.team).toBeLessThanOrEqual(3);
    }
  });
});
