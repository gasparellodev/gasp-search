/**
 * E2E: HomeQuickSearchBar redireciona pra /estoque com short keys (#221 / H1).
 *
 * Cobre AC: "submit search redireciona para /estoque?m=X&model=Y&p=Z" via
 * `serializeQuickSearch` compartilhado com #224 (E1).
 *
 * Skipa quando o ambiente de seed (Supabase real + token) não está
 * disponível — mesmo padrão dos demais specs `sites/*` (issue #166).
 */
import { expect, test } from "@playwright/test";

import {
  cleanupSite,
  getValidVariables,
  makeTestSlug,
  seedSite,
  sitesE2EEnabled,
} from "./helpers";

test.describe("sites home quick search", () => {
  test.skip(
    !sitesE2EEnabled(),
    "TEST_SEED_TOKEN/TEST_SEED_USER_ID/Supabase real ausentes — pulando.",
  );

  let slug: string;
  const variables = getValidVariables();

  test.beforeEach(async ({ request }) => {
    slug = makeTestSlug("e2e-home-search");
    await seedSite(request, { slug, status: "published", variables });
  });

  test.afterEach(async ({ request }) => {
    if (slug) await cleanupSite(request, { slug });
  });

  test("submit redireciona pra /estoque?m=X&model=Y&p=Z (short keys)", async ({
    page,
  }) => {
    await page.goto(`/sites/${slug}`);

    const heroForm = page.getByTestId("home-quick-search-bar");
    await expect(heroForm).toBeVisible();

    await page.getByLabel(/marca/i).fill("Toyota");
    await page.getByLabel(/modelo/i).fill("Corolla");
    await page.getByLabel(/preço.*máx/i).fill("120000");
    await page.getByRole("button", { name: /buscar/i }).click();

    await expect(page).toHaveURL(
      new RegExp(
        `/sites/${slug}/estoque\\?m=Toyota&model=Corolla&p=120000$`,
      ),
    );
  });

  test("submit vazio cai em /estoque (sem QS)", async ({ page }) => {
    await page.goto(`/sites/${slug}`);
    await page.getByRole("button", { name: /buscar/i }).click();
    await expect(page).toHaveURL(new RegExp(`/sites/${slug}/estoque$`));
  });

  test("trust strip renderiza 4 itens com fallback rating", async ({
    page,
  }) => {
    await page.goto(`/sites/${slug}`);
    const region = page.getByRole("region", { name: /diferenciais/i });
    await expect(region).toBeVisible();
    await expect(region.getByText(/garantia inclu/i)).toBeVisible();
    await expect(region.getByText(/vistoria 100 pontos/i)).toBeVisible();
    // Quando o lead seedado não tem rating real, cai no fallback PT-BR.
    await expect(region.getByText(/4\.8★ 87 reviews/)).toBeVisible();
  });

  test("categorias cars: clique em SUV redireciona com bodyType=suv", async ({
    page,
  }) => {
    await page.goto(`/sites/${slug}`);
    await page
      .getByRole("link", { name: /ver suvs no estoque/i })
      .click();
    await expect(page).toHaveURL(
      new RegExp(`/sites/${slug}/estoque\\?bodyType=suv$`),
    );
  });
});
