/**
 * The contrast harness, lifted out of `fairness.spec.ts` so the lines under a
 * readout are measured by one piece of code.
 *
 * It was written inline, in the landing-hero case, because that was the only
 * line on a light surface at the time. The bench advisory is a second line on
 * the same surfaces and a third appearance on the ink panel, and the honest
 * move is to have it measured the way `.fairness` is measured rather than to
 * copy the twelve lines of sRGB maths into a second file and let the two drift.
 *
 * The maths is unchanged from the inline original, including its two
 * self-checking `rgb()` assertions: a character class that matches no digits
 * makes the ratio NaN, and NaN against a threshold reads as a failed bar rather
 * than as a broken helper.
 */
import { expect } from "@playwright/test";
import type { Locator } from "@playwright/test";

const channel = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

const luminance = ([r, g, b]: number[]) =>
  0.2126 * channel(r / 255) + 0.7152 * channel(g / 255) + 0.0722 * channel(b / 255);

/**
 * Three 0-255 channels out of any computed colour, checked as it goes.
 *
 * Chromium serialises a colour that was authored with a `color-mix()` as
 * `color(srgb 0.98 0.97 0.96 / 0.55)`, whose channels are 0-1, where
 * `getComputedStyle` serialises a plain token as `rgb(250, 248, 245)`, whose
 * channels are 0-255. Feeding the first notation to a parser written for the
 * second yields three numbers that are all but black, and a ratio that looks
 * like a real measurement of nothing — so the notation is detected, not
 * assumed.
 */
export const rgb = (value: string): [number, number, number] => {
  const parts = (value.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
  // Readable in the failure message: a mistyped character class here once
  // matched no digits at all and the ratio came out NaN, which reads as a
  // failed threshold rather than as a broken helper.
  expect(parts, `could not read three colour channels out of "${value}"`).toHaveLength(3);
  expect(parts.every((c) => Number.isFinite(c)), `"${value}" parsed to ${JSON.stringify(parts)}`).toBe(true);
  const scale = value.startsWith("color(") ? 255 : 1;
  return parts.map((c) => c * scale) as [number, number, number];
};

/** The alpha in a computed colour, 1 when it carries none. */
export const alphaOf = (value: string): number => {
  const afterSlash = /\/\s*([\d.]+)\s*\)/.exec(value);
  return afterSlash ? Number(afterSlash[1]) : 1;
};

/** What the browser actually painted: the declared ink, and the alpha over it. */
export interface Painting {
  color: string;
  opacity: number;
}

/**
 * The WCAG 2.x ratio between an ink at `alpha` and the surface behind it. The
 * blend is done in sRGB first, because that is what the compositor does. The
 * ratio is size-independent, so a caller that also wants a legibility floor has
 * to assert the size separately.
 */
export function blendedRatio(painted: Painting, backdrop: string): { ratio: number; blend: [number, number, number] } {
  const ink = rgb(painted.color);
  const back = rgb(backdrop);
  const blend = back.map((c, i) => painted.opacity * ink[i]! + (1 - painted.opacity) * c) as [number, number, number];
  const a = luminance(blend);
  const b = luminance(back);
  return { ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05), blend };
}

/**
 * The whole claim in one call: the line is painted in the ink the caller names,
 * at the alpha the sheet declares, and clears `min` against the panel it sits
 * on. Everything is read from the browser rather than from the stylesheet, so
 * an override elsewhere (`.landing-hero`) that changes the ink is caught here
 * instead of by eye.
 */
export async function expectBlendedContrast(opts: {
  line: Locator;
  panel: Locator;
  scheme: string;
  /** The exact `color` the line is required to be painted in, when it is pinned. */
  expectColor?: string;
  /** The exact `opacity` the line is required to be painted at, when it is pinned. */
  expectOpacity?: number;
  min: number;
}): Promise<Painting & { backdrop: string; ratio: number; blend: [number, number, number] }> {
  const painted: Painting = await opts.line.evaluate((el) => {
    const s = getComputedStyle(el);
    return { color: s.color, opacity: Number(s.opacity) };
  });
  if (opts.expectColor) {
    expect(painted.color, `in ${opts.scheme} the line is ${painted.color}, not ${opts.expectColor}`).toBe(opts.expectColor);
  }
  if (opts.expectOpacity !== undefined) {
    expect(painted.opacity, `in ${opts.scheme} the line's opacity`).toBeCloseTo(opts.expectOpacity, 2);
  }
  const backdrop = await opts.panel.evaluate((el) => getComputedStyle(el).backgroundColor);
  const { ratio, blend } = blendedRatio(painted, backdrop);
  expect(Number.isFinite(ratio), `in ${opts.scheme} the ratio came out ${ratio} for ${painted.color} on ${backdrop}`).toBe(true);
  expect(
    ratio,
    `in ${opts.scheme}: ${painted.color} at ${painted.opacity} on ${backdrop} blends to rgb(${blend.map(Math.round).join(", ")})`,
  ).toBeGreaterThan(opts.min);
  return { ...painted, backdrop, ratio, blend };
}