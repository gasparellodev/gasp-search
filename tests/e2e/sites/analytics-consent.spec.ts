/**
 * E2E: GA4 só carrega após opt-in de analytics (#233).
 */
import { expect, test } from "@playwright/test";

import {
  cleanupSite,
  makeTestSlug,
  seedSite,
  sitesE2EEnabled,
} from "./helpers";

test.describe("sites analytics + consent", () => {
  test.skip(!sitesE2EEnabled(), "TEST_SEED ausente — pulando.");

  let slug: string;

  test.beforeEach(async ({ request }) => {
    slug = makeTestSlug("e2e-analytics");
    await seedSite(request, { slug, status: "published" });
  });

  test.afterEach(async ({ request }) => {
    await cleanupSite(request, { slug });
  });

  test("sem Aceitar todos: nenhum script googletagmanager; após Aceitar: script presente", async ({
    page,
  }) => {
    await page.goto(`/sites/${slug}`);

    expect(
      await page.locator('script[src*="googletagmanager.com/gtag/js"]').count(),
    ).toBe(0);

    await page.getByRole("button", { name: "Aceitar todos" }).click();

    await expect(
      page.locator('script[src*="googletagmanager.com/gtag/js"]'),
    ).toHaveCount(1);
  });
});
