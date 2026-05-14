/**
 * Regression visual das 6 rotas principais × 2 viewports (issue #204).
 *
 * Requer `sitesE2EEnabled()`. Compara com PNGs em `tests/visual/figma-baseline/v3/`.
 * Primeira geração (sem PNGs): `TEST_SEED_TOKEN=... TEST_SEED_USER_ID=... npx playwright test --project=visual-sites --update-snapshots`
 * (o flag desativa o skip quando `home-desktop.png` ainda não existe; ver `tests/visual/README.md`).
 */
import * as fs from "node:fs";
import * as path from "node:path";

import { expect, test } from "@playwright/test";

import {
  cleanupSite,
  getValidVariables,
  makeTestSlug,
  seedSite,
  sitesE2EEnabled,
} from "../sites/helpers";

const FIRST_CAR_SLUG = "toyota-corolla-xei-2023";
const BASELINE_DIR = path.join(
  process.cwd(),
  "tests/visual/figma-baseline/v3",
);

function baselinesPresent(): boolean {
  try {
    return fs.existsSync(path.join(BASELINE_DIR, "home-desktop.png"));
  } catch {
    return false;
  }
}

/** Sem baseline ainda: só roda comparação se não estiver em modo update. */
function playwrightUpdatingSnapshots(): boolean {
  return process.argv.some(
    (arg) =>
      arg === "--update-snapshots" ||
      arg === "-u" ||
      arg.startsWith("--update-snapshots="),
  );
}

test.describe("sites visual baselines v3", () => {
  test.skip(
    !sitesE2EEnabled(),
    "TEST_SEED_TOKEN/TEST_SEED_USER_ID/Supabase real ausentes — pulando.",
  );
  test.skip(
    !baselinesPresent() && !playwrightUpdatingSnapshots(),
    "Baselines PNG ausentes em tests/visual/figma-baseline/v3 — gere com --update-snapshots (ver tests/visual/README.md).",
  );

  let slug: string;
  const variables = getValidVariables();

  test.beforeEach(async ({ request }) => {
    slug = makeTestSlug("e2e-visual");
    await seedSite(request, { slug, status: "published", variables });
  });

  test.afterEach(async ({ request }) => {
    if (slug) await cleanupSite(request, { slug });
  });

  async function dismissCookieBanner(page: import("@playwright/test").Page) {
    const banner = page.getByTestId("cookie-banner");
    if (await banner.isVisible().catch(() => false)) {
      await page.getByRole("button", { name: "Aceitar todos" }).click();
      await expect(banner).toBeHidden();
    }
  }

  async function shot(page: import("@playwright/test").Page, name: string) {
    await expect(page).toHaveScreenshot(name, {
      maxDiffPixelRatio: 0.005,
      animations: "disabled",
    });
  }

  test("home + estoque + detalhe + sobre + contato + anunciar (desktop + mobile)", async ({
    page,
  }) => {
    const cases: { url: string; desktop: string; mobile: string }[] = [
      { url: `/sites/${slug}`, desktop: "home-desktop", mobile: "home-mobile" },
      {
        url: `/sites/${slug}/estoque`,
        desktop: "estoque-desktop",
        mobile: "estoque-mobile",
      },
      {
        url: `/sites/${slug}/estoque/${FIRST_CAR_SLUG}`,
        desktop: "detail-desktop",
        mobile: "detail-mobile",
      },
      { url: `/sites/${slug}/sobre`, desktop: "sobre-desktop", mobile: "sobre-mobile" },
      {
        url: `/sites/${slug}/contato`,
        desktop: "contato-desktop",
        mobile: "contato-mobile",
      },
      {
        url: `/sites/${slug}/anunciar`,
        desktop: "anunciar-desktop",
        mobile: "anunciar-mobile",
      },
    ];

    for (const { url, desktop, mobile } of cases) {
      await page.setViewportSize({ width: 1280, height: 800 });
      const res = await page.goto(url, { waitUntil: "load" });
      expect(res?.status()).toBe(200);
      await dismissCookieBanner(page);
      await shot(page, desktop);

      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(url, { waitUntil: "load" });
      await dismissCookieBanner(page);
      await shot(page, mobile);
    }
  });
});
