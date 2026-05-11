/**
 * E2E: navegação entre rotas via clicks no `<SiteHeader>` — AC4 #166.
 *
 * Começa em `/sites/[slug]` e clica nos 4 links principais (Sobre,
 * Contato, Anunciar, Estoque). Cada click deve mudar URL e renderizar
 * o `<h1>` da página alvo. Cobre o desktop nav (viewport default
 * Playwright = 1280×720); o menu mobile é exercido em
 * `tests/responsive.spec.ts` separadamente.
 */
import { expect, test } from "@playwright/test";

import {
  cleanupSite,
  getValidVariables,
  makeTestSlug,
  seedSite,
  sitesE2EEnabled,
} from "./helpers";

test.describe("sites navigation", () => {
  test.skip(
    !sitesE2EEnabled(),
    "TEST_SEED_TOKEN/TEST_SEED_USER_ID/Supabase real ausentes — pulando.",
  );

  let slug: string;
  const variables = getValidVariables();

  test.beforeEach(async ({ request }) => {
    slug = makeTestSlug("e2e-nav");
    await seedSite(request, {
      slug,
      status: "published",
      variables,
    });
  });

  test.afterEach(async ({ request }) => {
    if (slug) await cleanupSite(request, { slug });
  });

  test("nav header → Sobre → Contato → Anunciar → Estoque atualiza URL e h1", async ({
    page,
  }) => {
    await page.goto(`/sites/${slug}`);

    // Header é o ponto de partida — fica `data-testid="site-header"`.
    const header = page.getByTestId("site-header");
    await expect(header).toBeVisible();

    // Sobre
    await header.getByRole("link", { name: /^Sobre$/ }).click();
    await expect(page).toHaveURL(new RegExp(`/sites/${slug}/sobre$`));
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: new RegExp(variables.business_name),
      }),
    ).toBeVisible();

    // Contato
    await header.getByRole("link", { name: /^Contato$/ }).click();
    await expect(page).toHaveURL(new RegExp(`/sites/${slug}/contato$`));
    await expect(
      page.getByRole("heading", { level: 1, name: /^Contato$/ }),
    ).toBeVisible();

    // Anunciar
    await header.getByRole("link", { name: /^Anunciar$/ }).click();
    await expect(page).toHaveURL(new RegExp(`/sites/${slug}/anunciar$`));
    await expect(
      page.getByRole("heading", { level: 1, name: /Anuncie/i }),
    ).toBeVisible();

    // Estoque
    await header.getByRole("link", { name: /^Estoque$/ }).click();
    await expect(page).toHaveURL(new RegExp(`/sites/${slug}/estoque$`));
    await expect(
      page.getByRole("heading", { level: 1, name: /^Nosso Estoque$/ }),
    ).toBeVisible();
  });
});
