import { describe, it, expect, vi } from "vitest";
import { hasSampleData, listDisciplinesWithSampleData, getSampleDataInfo, getSampleDataUrl, downloadSampleData } from "./sample-data";

describe("sample-data registry", () => {
  it("has sample data for mlbb", () => {
    expect(hasSampleData("mlbb")).toBe(true);
  });

  it("has sample data for futsal", () => {
    expect(hasSampleData("futsal")).toBe(true);
  });

  it("has no sample data for unknown", () => {
    expect(hasSampleData("unknown")).toBe(false);
  });

  it("lists disciplines with sample data", () => {
    const list = listDisciplinesWithSampleData();
    expect(list).toContain("mlbb");
    expect(list).toContain("futsal");
    expect(list).toHaveLength(2);
  });

  it("returns sample data info", () => {
    const info = getSampleDataInfo("mlbb");
    expect(info).not.toBeNull();
    expect(info?.playerCount).toBeGreaterThan(0);
    expect(info?.fileName).toBe("mlbb-roster.json");
  });

  it("returns null for unknown sample data info", () => {
    expect(getSampleDataInfo("unknown")).toBeNull();
  });

  it("returns a blob URL", () => {
    const url = getSampleDataUrl("mlbb");
    expect(url).not.toBeNull();
    expect(url?.startsWith("blob:")).toBe(true);
  });

  it("returns null for unknown sample data URL", () => {
    expect(getSampleDataUrl("unknown")).toBeNull();
  });

  it("downloadSampleData creates a blob and downloads", () => {
    const clickSpy = vi.fn();
    vi.stubGlobal("document", { createElement: () => ({ click: clickSpy, setAttribute: vi.fn(), href: "" }) });
    expect(() => downloadSampleData("mlbb")).not.toThrow();
  });
});
