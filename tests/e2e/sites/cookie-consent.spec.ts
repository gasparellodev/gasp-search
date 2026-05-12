import { expect, test } from "@playwright/test";

import {
  cleanupSite,
  makeTestSlug,
  seedSite,
  sitesE2EEnabled,
} from "./helpers";

test.describe("sites cookie consent", () => {
  test.skip(!sitesE2EEnabled(), "TEST_SEED_TOKEN ausente — pulando");

  let slug: string;

  test.beforeEach(async ({ request }) => {
    slug = makeTestSlug("cookie-consent");
    await seedSite(request, { slug, status: "published" });
  });

  test.afterEach(async ({ request }) => {
    await cleanupSite(request, { slug });
  });

  test("primeira visita mostra banner e Aceitar todos persiste analytics", async ({
    page,
  }) => {
    await page.goto(`/sites/${slug}`);

    await expect(page.getByTestId("cookie-banner")).toBeVisible();
    await page.getByRole("button", { name: "Aceitar todos" }).click();

    await expect(page.getByTestId("cookie-banner")).toBeHidden();
    const consent = await page.evaluate(() =>
      JSON.parse(window.localStorage.getItem("gasp_consent_v1") ?? "null"),
    );
    expect(consent).toMatchObject({
      action: "accept_all",
      categories: {
        necessary: true,
        analytics: true,
        marketing: true,
      },
    });
  });

  test("Apenas necessários mantém analytics e marketing desligados", async ({
    page,
  }) => {
    await page.goto(`/sites/${slug}`);

    await page.getByRole("button", { name: "Apenas necessários" }).click();

    const consent = await page.evaluate(() =>
      JSON.parse(window.localStorage.getItem("gasp_consent_v1") ?? "null"),
    );
    expect(consent).toMatchObject({
      action: "reject",
      categories: {
        necessary: true,
        analytics: false,
        marketing: false,
      },
    });
  });
});
