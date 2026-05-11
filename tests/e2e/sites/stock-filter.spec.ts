import { expect, test } from "@playwright/test";

import type { SiteVariables } from "@/types/lead-site";

import {
  cleanupSite,
  getValidVariables,
  makeTestSlug,
  seedSite,
  sitesE2EEnabled,
} from "./helpers";

function stockVariables(count = 4): SiteVariables {
  const base = getValidVariables();
  const names = [
    ["Toyota", "Corolla"],
    ["Honda", "Civic"],
    ["Jeep", "Compass"],
    ["Volkswagen", "Nivus"],
  ] as const;
  const cars = Array.from({ length: count }, (_, index) => {
    const source = base.cars[index % base.cars.length]!;
    const name = names[index % names.length]!;
    const suffix = index + 1;

    return {
      ...source,
      brand: name[0],
      model: count > 4 ? `${name[1]} ${suffix}` : name[1],
      slug:
        count > 4
          ? `${name[0]}-${name[1]}-${suffix}`.toLowerCase()
          : source.slug,
      price: 50_000 + index,
      km: 10_000 + index,
      featured: false,
    };
  });

  return {
    ...base,
    cars,
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

  test("desktop: sort atualiza URL e mantém cards com raio 8px", async ({
    page,
  }) => {
    await page.goto(`/sites/${slug}/estoque`);

    await page.getByRole("combobox", { name: "Ordenar estoque" }).click();
    await page.getByRole("option", { name: "Maior preço" }).click();

    await expect(page).toHaveURL(/sort=price_desc/);
    await expect(page.locator("article[data-testid^='car-card-']").first()).toHaveCSS(
      "border-radius",
      "8px",
    );
  });

  test("desktop: paginação usa page na URL", async ({ request, page }) => {
    await cleanupSite(request, { slug });
    slug = makeTestSlug("e2e-stock-page");
    await seedSite(request, {
      slug,
      status: "published",
      variables: stockVariables(13),
    });

    await page.goto(`/sites/${slug}/estoque?sort=price_asc`);

    await page.getByRole("button", { name: "Próxima página" }).click();

    await expect(page).toHaveURL(/page=2/);
    await expect(page.getByTestId("car-card-toyota-corolla-13")).toBeVisible();
  });
});
