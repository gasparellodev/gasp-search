import { expect, test } from "@playwright/test";

import {
  cleanupSite,
  getValidVariables,
  makeTestSlug,
  seedSite,
  sitesE2EEnabled,
} from "./helpers";

test.describe("sites detalhe — D1 #226", () => {
  test.skip(
    !sitesE2EEnabled(),
    "TEST_SEED_TOKEN/TEST_SEED_USER_ID/Supabase real ausentes — pulando.",
  );

  let slug: string;
  const variables = getValidVariables();
  const car = variables.cars[0]!;

  test.beforeEach(async ({ request }) => {
    slug = makeTestSlug("e2e-detail-d1");
    await seedSite(request, {
      slug,
      status: "published",
      variables,
    });
  });

  test.afterEach(async ({ request }) => {
    if (slug) await cleanupSite(request, { slug });
  });

  test("renderiza breadcrumb, galeria cinema, info block e spec grid", async ({
    page,
  }) => {
    await page.goto(`/sites/${slug}/estoque/${car.slug}`);

    await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Estoque" })).toHaveAttribute(
      "href",
      `/sites/${slug}/estoque`,
    );
    await expect(page.getByRole("link", { name: car.brand })).toHaveAttribute(
      "href",
      `/sites/${slug}/estoque?m=${encodeURIComponent(car.brand)}`,
    );
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      `${car.model} ${car.year}`,
    );
    await expect(page.getByTestId("detail-gallery-cinema")).toBeVisible();
    await expect(page.getByAltText(`${car.brand} ${car.model} ${car.year} - foto 1`)).toBeVisible();
    await expect(page.getByTestId("detail-info-badges")).toContainText(
      `${car.km.toLocaleString("pt-BR")} km`,
    );
    await expect(page.getByTestId("detail-spec-grid")).toContainText("Marca");
    await expect(page.getByTestId("detail-spec-grid")).toContainText(car.brand);
  });

  test("lightbox preserva scroll da página ao abrir e fechar", async ({ page }) => {
    await page.goto(`/sites/${slug}/estoque/${car.slug}`);
    await page.evaluate(() => window.scrollTo(0, 320));
    const scrollBefore = await page.evaluate(() => window.scrollY);

    await page.getByRole("button", { name: "Ampliar foto 1" }).click();
    const dialog = page.getByRole("dialog", {
      name: `Galeria ampliada de ${car.brand} ${car.model} ${car.year}`,
    });
    await expect(dialog).toBeVisible();
    await page.keyboard.press("ArrowRight");
    await expect(dialog).toContainText("2/3");
    await page.keyboard.press("Home");
    await expect(dialog).toContainText("1/3");

    await page.getByRole("button", { name: "Fechar galeria" }).click();
    await expect(dialog).toBeHidden();
    await expect
      .poll(() => page.evaluate(() => window.scrollY))
      .toBe(scrollBefore);
  });
});
