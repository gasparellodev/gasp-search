import { expect, test } from "@playwright/test";

import type { SiteVariables } from "@/types/lead-site";

import {
  cleanupSite,
  getValidVariables,
  makeTestSlug,
  seedSite,
  sitesE2EEnabled,
} from "./helpers";

function stockVariables(): SiteVariables {
  const base = getValidVariables();
  const names = [
    ["Toyota", "Corolla"],
    ["Honda", "Civic"],
    ["Jeep", "Compass"],
    ["Volkswagen", "Nivus"],
  ] as const;

  return {
    ...base,
    cars: base.cars.map((car, index) => ({
      ...car,
      brand: names[index]?.[0] ?? car.brand,
      model: names[index]?.[1] ?? car.model,
    })),
  };
}

test.describe("sites estoque — filtros #224", () => {
  test.skip(
    !sitesE2EEnabled(),
    "TEST_SEED_TOKEN/TEST_SEED_USER_ID/Supabase real ausentes — pulando.",
  );

  let slug: string;
  const variables = stockVariables();

  test.beforeEach(async ({ request }) => {
    slug = makeTestSlug("e2e-stock-filter");
    await seedSite(request, {
      slug,
      status: "published",
      variables,
    });
  });

  test.afterEach(async ({ request }) => {
    if (slug) await cleanupSite(request, { slug });
  });

  test("desktop: selecionar marca atualiza URL e filtra resultados", async ({
    page,
  }) => {
    await page.goto(`/sites/${slug}/estoque`);

    await page.getByLabel("Honda").check();

    await expect(page).toHaveURL(/m=Honda/);
    await expect(page.getByTestId("car-card-honda-civic-touring-2022")).toBeVisible();
    await expect(page.getByTestId("car-card-toyota-corolla-xei-2023")).toBeHidden();
  });

  test("desktop: busca textual atualiza URL e filtra por modelo", async ({
    page,
  }) => {
    await page.goto(`/sites/${slug}/estoque`);

    await page.getByLabel("Buscar por marca ou modelo").fill("Nivus");

    await expect(page).toHaveURL(/q=Nivus/);
    await expect(page.getByTestId("car-card-volkswagen-nivus-highline-2024")).toBeVisible();
    await expect(page.getByTestId("car-card-toyota-corolla-xei-2023")).toBeHidden();
  });

  test("mobile: drawer abre e fecha pelo botão", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/sites/${slug}/estoque`);

    await page.getByRole("button", { name: /^Filtros/ }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.getByRole("button", { name: "Fechar filtros" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
  });
});
