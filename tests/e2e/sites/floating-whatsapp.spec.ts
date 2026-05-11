/**
 * E2E: WhatsAppFloatingCTA global + FloatingInstallmentBar mobile detail (#220).
 */
import { expect, test } from "@playwright/test";

import {
  cleanupSite,
  getValidVariables,
  makeTestSlug,
  seedSite,
  sitesE2EEnabled,
} from "./helpers";

test.describe("sites floating whatsapp CTA", () => {
  test.skip(
    !sitesE2EEnabled(),
    "TEST_SEED_TOKEN/TEST_SEED_USER_ID/Supabase real ausentes — pulando.",
  );

  let slug: string;
  const variables = getValidVariables();
  const firstCar = variables.cars[0]!;

  test.beforeEach(async ({ request }) => {
    slug = makeTestSlug("e2e-floating");
    await seedSite(request, {
      slug,
      status: "published",
      variables,
    });
  });

  test.afterEach(async ({ request }) => {
    if (slug) await cleanupSite(request, { slug });
  });

  test("detail mobile mantém barra de parcela visível e CTA abre wa.me com contexto do carro", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/sites/${slug}/estoque/${firstCar.slug}`);

    const bar = page.getByTestId("floating-installment-bar");
    await expect(bar).toBeVisible();
    await expect(bar).toContainText(firstCar.model);
    await expect(bar).toContainText("48x");

    const cta = bar.getByRole("link", {
      name: new RegExp(`WhatsApp sobre ${firstCar.brand} ${firstCar.model}`, "i"),
    });
    await expect(cta).toHaveAttribute("href", /wa\.me/);
    await expect(cta).toHaveAttribute("href", /utm_campaign=vehicle/);
    await expect(cta).toHaveAttribute("href", /utm_content=floating-cta/);
  });

  test("home renderiza CTA flutuante general", async ({ page }) => {
    await page.goto(`/sites/${slug}`);

    const cta = page.getByRole("link", { name: "Contato WhatsApp" });
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute("href", /wa\.me/);
    await expect(cta).toHaveAttribute("href", /utm_campaign=general/);
    await expect(cta).toHaveAttribute("href", /utm_content=floating-cta/);
  });
});
