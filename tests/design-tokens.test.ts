// Contrast of the sanctioned ink-on-ground pairings, read from app/globals.css
// (DESIGN.md §Accessibility, §Design toolkit).
//
// The token values are parsed from the stylesheet rather than copied here, so
// a palette change re-measures itself. The formula is validated on the WCAG
// reference pairs first — DESIGN.md once recorded 4.63:1 for a pairing that is
// 4.33:1, and "measured by eye" is how that happened.
//
// This proves the TOKENS. Whether a page actually puts muted on grey is a
// rendered question, and tests/ui (axe) is what answers it.

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const css = readFileSync(path.join(__dirname, "../app/globals.css"), "utf8");
const root = /:root\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? "";

function token(name: string): string {
  const m = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`).exec(root);
  if (!m) throw new Error(`--${name} is not a 6-digit hex in :root`);
  return m[1];
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const PAPER = "#ffffff";
const AA = 4.5;

describe("the contrast formula", () => {
  it("matches the WCAG reference pairs", () => {
    expect(contrast("#767676", PAPER)).toBeCloseTo(4.54, 2);
    expect(contrast("#000000", PAPER)).toBeCloseTo(21, 2);
  });
});

describe("sanctioned pairings pass AA", () => {
  const vellum = () => token("misa-panel");
  const pairings: [string, () => string, () => string][] = [
    ["heading ink on Paper", () => token("foreground"), () => PAPER],
    ["heading ink on Vellum", () => token("foreground"), vellum],
    ["body on Paper", () => token("misa-body"), () => PAPER],
    ["body on Vellum", () => token("misa-body"), vellum],
    ["secondary on Paper", () => token("misa-secondary"), () => PAPER],
    ["secondary on Vellum", () => token("misa-secondary"), vellum],
    ["muted on Paper", () => token("misa-muted"), () => PAPER],
    ["navy on Paper", () => token("misa-blue"), () => PAPER],
    ["navy on Vellum", () => token("misa-blue"), vellum],
    ["Paper on navy", () => PAPER, () => token("misa-blue")],
    ["Paper on pressed navy", () => PAPER, () => token("misa-blue-dark")],
    ["caution on Paper", () => token("misa-caution"), () => PAPER],
    ["caution on its wash", () => token("misa-caution"), () => token("misa-caution-wash")],
    ["critical on Paper", () => token("misa-critical"), () => PAPER],
    ["critical on its wash", () => token("misa-critical"), () => token("misa-critical-wash")],
    ["affirm on Paper", () => token("misa-affirm"), () => PAPER],
    ["affirm on its wash", () => token("misa-affirm"), () => token("misa-affirm-wash")],
  ];

  it.each(pairings)("%s", (_label, ink, ground) => {
    expect(contrast(ink(), ground())).toBeGreaterThanOrEqual(AA);
  });
});

describe("the narrow rule: muted may sit on Paper, never on Vellum", () => {
  // If this starts passing AA, the palette changed and the rule in DESIGN.md
  // (and every note calling this a failure) should be re-read, not just this
  // assertion flipped.
  it("muted on Vellum is below AA", () => {
    expect(contrast(token("misa-muted"), token("misa-panel"))).toBeLessThan(AA);
  });
});
