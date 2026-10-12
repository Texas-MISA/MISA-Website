// Rendered-page gates (DESIGN.md §Design toolkit). Every route here must:
//   - have zero axe violations at WCAG 2.0/2.1/2.2 A and AA;
//   - not scroll horizontally at 360px;
//   - leave nothing hidden by the scroll reveal when JavaScript is off
//     (the hidden state is scoped to html.js, and this is the proof).
// Then the STATES a first render never shows, which is where the portal's
// known --misa-muted-on-Vellum failure actually lives.
//
// Routes come from docs/design/surfaces.json plus the public pages, so
// registering a surface enrols it here without editing this file. Every
// state test asserts it REACHED its state before running axe: a rate-limited
// lookup renders a banner instead of the result, and axe passing on the
// banner would be a green run that checked nothing.

import { readFileSync } from "node:fs";
import path from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

import { cleanup, createTestEvent, newTracker, testClient } from "../helpers";
import { UI_EVENT_PREFIX } from "./global-setup";

const registry = JSON.parse(
  readFileSync(path.join(__dirname, "../../docs/design/surfaces.json"), "utf8")
) as { surfaces: Record<string, { routes: string[] }> };

const PUBLIC = [
  "/",
  "/about",
  "/projects",
  "/gallery",
  "/officers",
  "/contact",
  "/admin/login",
  "/this-page-does-not-exist",
];
const ROUTES = [
  ...new Set([...PUBLIC, ...Object.values(registry.surfaces).flatMap((s) => s.routes)]),
];

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function axe(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  return violations.map(
    (v) => `${v.id} (${v.nodes.length}): ${v.nodes[0]?.target.join(" ")}`
  );
}

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
      expect(await axe(page)).toEqual([]);
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

// Read-only: lookup writes nothing but its throttle row.
test.describe("/portal/lookup states", () => {
  const cases = [
    // A seed member (supabase/seed.sql). Their name heads the result.
    { label: "a member's result", eid: "bk2856", reached: /Bela Kovacs/ },
    { label: "an unmatched EID", eid: "zz9999", reached: /couldn.t match that EID/ },
  ];
  for (const { label, eid, reached } of cases) {
    test(`${label} has no WCAG A/AA axe violations`, async ({ page }) => {
      await page.goto("/portal/lookup");
      await page.fill('input[name="eid"]', eid);
      await page.locator('button[type="submit"]').first().click();
      await expect(page.getByText(reached).first()).toBeVisible();
      expect(await axe(page)).toEqual([]);
    });
  }
});

// Check-in states. None of these writes attendance: validation fails first,
// a lookup miss writes nothing, and a claimed first-timer is always asked to
// confirm BEFORE anything is created (lib/checkin.ts, step 3). What they need
// is an event open NOW, so one is opened on the LOCAL stack for the duration
// and deleted after — and swept by global-setup if a crash leaves it behind.
test.describe("/portal/attend states", () => {
  const track = newTracker();

  test.beforeAll(async () => {
    const now = Date.now();
    await createTestEvent(testClient(), track, {
      title: `${UI_EVENT_PREFIX} ${crypto.randomUUID().slice(0, 8)}`,
      starts: new Date(now - 30 * 60_000),
      ends: new Date(now + 60 * 60_000),
      checkinOpensAt: new Date(now - 60 * 60_000),
      checkinClosesAt: new Date(now + 60 * 60_000),
    });
  });
  test.afterAll(async () => {
    await cleanup(testClient(), track);
  });

  async function submit(
    page: Page,
    fields: { fullName: string; eid: string; email: string; firstTime: boolean }
  ) {
    await page.goto("/portal/attend");
    await page.fill('input[name="fullName"]', fields.fullName);
    await page.fill('input[name="eid"]', fields.eid);
    await page.fill('input[name="email"]', fields.email);
    if (fields.firstTime) await page.check('input[name="firstTime"]');
    await page.locator('button[type="submit"]').first().click();
  }

  test("field errors have no WCAG A/AA axe violations", async ({ page }) => {
    await page.goto("/portal/attend");
    await page.locator('button[type="submit"]').first().click();
    await expect(page.locator('[aria-invalid="true"]').first()).toBeVisible();
    expect(await axe(page)).toEqual([]);
  });

  test("an unmatched returning member has no WCAG A/AA axe violations", async ({ page }) => {
    await submit(page, {
      fullName: "Zed Zulu",
      eid: "zz9999",
      email: "zz9999@example.invalid",
      firstTime: false,
    });
    await expect(page.getByText(/have that info on file/).first()).toBeVisible();
    expect(await axe(page)).toEqual([]);
  });

  for (const [label, eid, reached] of [
    ["a new first-timer's confirmation", "zz9998", /added to the roster/],
    ["a known member's first-timer confirmation", "bk2856", /already have you on file/],
  ] as const) {
    test(`${label} has no WCAG A/AA axe violations`, async ({ page }) => {
      await submit(page, {
        fullName: "Zed Zulu",
        eid,
        email: `${eid}@example.invalid`,
        firstTime: true,
      });
      await expect(page.getByText(reached).first()).toBeVisible();
      expect(await axe(page)).toEqual([]);
    });
  }
});
