// Rendered-page gates (DESIGN.md §Design toolkit). Every route here must:
//   - have zero axe violations at WCAG 2 A/AA, which is what catches
//     --misa-muted landing on Vellum on a real page;
//   - not scroll horizontally at 360px;
//   - leave nothing hidden by the scroll reveal when JavaScript is off
//     (the hidden state is scoped to html.js, and this is the proof).
//
// Routes come from docs/design/surfaces.json plus the public pages, so
// registering a surface enrols it here without editing this file.

import { readFileSync } from "node:fs";
import path from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const registry = JSON.parse(
  readFileSync(path.join(__dirname, "../../docs/design/surfaces.json"), "utf8")
) as { surfaces: Record<string, { routes: string[] }> };

const PUBLIC = ["/", "/about", "/projects", "/gallery", "/officers", "/contact"];
const ROUTES = [
  ...new Set([
    ...PUBLIC,
    ...Object.values(registry.surfaces).flatMap((s) => s.routes),
  ]),
];

for (const route of ROUTES) {
  test.describe(route, () => {
    test("has no WCAG A/AA axe violations", async ({ page }) => {
      await page.goto(route);
      await page.waitForLoadState("networkidle");
      // Let every reveal settle, so axe measures the resting state.
      await page.evaluate(() =>
        document
          .querySelectorAll("[data-reveal]")
          .forEach((el) => el.setAttribute("data-revealed", ""))
      );
      await page.waitForTimeout(800);
      const { violations } = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      const summary = violations.map(
        (v) => `${v.id} (${v.nodes.length}): ${v.nodes[0]?.target.join(" ")}`
      );
      expect(summary).toEqual([]);
    });

    test("does not scroll horizontally at 360px", async ({ page }) => {
      await page.setViewportSize({ width: 360, height: 800 });
      await page.goto(route);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  });
}

test.describe("with JavaScript off", () => {
  test.use({ javaScriptEnabled: false });
  for (const route of ROUTES) {
    test(`${route} hides nothing behind a reveal`, async ({ page }) => {
      await page.goto(route);
      const hidden = await page.$$eval("[data-reveal]", (els) =>
        els.filter((el) => getComputedStyle(el).opacity === "0").length
      );
      expect(hidden).toBe(0);
    });
  }
});

// States a first render never shows. Axe on the bare form cannot see ink that
// only appears in a result, which is where most of /portal/lookup's muted text
// lives. Read-only: lookup writes nothing. (/portal/attend's result states
// WRITE attendance, so they are walked by the design-reviewer agent instead.)
test.describe("/portal/lookup result states", () => {
  for (const [label, eid] of [
    ["a seeded member", "bk2856"],
    ["an unmatched EID", "zz9999"],
  ] as const) {
    test(`${label} has no WCAG A/AA axe violations`, async ({ page }) => {
      await page.goto("/portal/lookup");
      await page.fill('input[name="eid"]', eid);
      await page.locator('button[type="submit"]').first().click();
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(500);
      const { violations } = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      expect(
        violations.map((v) => `${v.id} (${v.nodes.length}): ${v.nodes[0]?.target.join(" ")}`)
      ).toEqual([]);
    });
  }
});
