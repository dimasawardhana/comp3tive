import { describe, expect, it, vi, afterEach } from "vitest";
import { relativeTime } from "./format";

const NOW = 1_700_000_000_000;
const minutesAgo = (n: number) => NOW - n * 60_000;

describe("relativeTime", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("says 'just now' under a minute", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    expect(relativeTime(NOW)).toBe("just now");
    expect(relativeTime(minutesAgo(0.9))).toBe("just now");
  });

  it("reports minutes under an hour", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    expect(relativeTime(minutesAgo(1))).toBe("1m ago");
    expect(relativeTime(minutesAgo(59))).toBe("59m ago");
  });

  it("reports hours under a day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    expect(relativeTime(minutesAgo(60))).toBe("1h ago");
    expect(relativeTime(minutesAgo(23 * 60))).toBe("23h ago");
  });

  it("reports days under a week", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    expect(relativeTime(minutesAgo(24 * 60))).toBe("1d ago");
    expect(relativeTime(minutesAgo(6 * 24 * 60))).toBe("6d ago");
  });

  it("falls back to a date at a week or more", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const old = minutesAgo(7 * 24 * 60);
    expect(relativeTime(old)).toBe(new Date(old).toLocaleDateString());
  });
});
