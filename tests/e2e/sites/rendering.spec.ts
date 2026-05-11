/**
 * E2E: render das 6 rotas públicas (#160-#165) — Phase 7 #166 / AC3.
 *
 * Para cada rota:
 *   - Status 200.
 *   - `<h1>` esperado.
 *   - Meta `<meta name="robots" content="noindex,nofollow">`.
 *
 * Seed via rota test-only com `validSiteVariablesFixture` — todas as
 * 4 cars do fixture têm slug determinístico, então o detalhe usa o
 * primeiro slug ("toyota-corolla-xei-2023").
 */
import { expect, test, type Page } from "@playwright/test";

import {
  cleanupSite,
  getValidVariables,
  makeTestSlug,
  seedSite,
  sitesE2EEnabled,
} from "./helpers";

const FIRST_CAR_SLUG = "toyota-corolla-xei-2023";

async function expectNoindexMeta(page: Page) {
  // Next emite a robots tag via metadata API — locator no DOM é mais
  // confiável que page.title() (não retorna meta).
  const robots = page.locator('meta[name="robots"]');
  await expect(robots).toHaveAttribute("content", /noindex/);
  await expect(robots).toHaveAttribute("content", /nofollow/);
}

test.describe("sites rendering — 6 rotas", () => {
  test.skip(
    !sitesE2EEnabled(),
    "TEST_SEED_TOKEN/TEST_SEED_USER_ID/Supabase real ausentes — pulando.",
  );

  let slug: string;
  const variables = getValidVariables();

  test.beforeEach(async ({ request }) => {
    slug = makeTestSlug("e2e-render");
    await seedSite(request, {
      slug,
      status: "published",
      variables,
    });
  });

  test.afterEach(async ({ request }) => {
    if (slug) await cleanupSite(request, { slug });
  });

  test("Home `/sites/[slug]` renderiza slogan + noindex", async ({ page }) => {
    const res = await page.goto(`/sites/${slug}`);
    expect(res?.status()).toBe(200);
    await expect(
      page.getByRole("heading", { level: 1, name: variables.slogan }),
    ).toBeVisible();
    await expectNoindexMeta(page);
  });

  test("Sobre `/sites/[slug]/sobre` renderiza business_name no h1 + noindex", async ({
    page,
  }) => {
    const res = await page.goto(`/sites/${slug}/sobre`);
    expect(res?.status()).toBe(200);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: new RegExp(variables.business_name),
      }),
    ).toBeVisible();
    await expectNoindexMeta(page);
  });

  test("Contato `/sites/[slug]/contato` renderiza link wa.me + noindex", async ({
    page,
  }) => {
    const res = await page.goto(`/sites/${slug}/contato`);
    expect(res?.status()).toBe(200);
    await expect(
      page.getByRole("heading", { level: 1, name: /^Contato$/ }),
    ).toBeVisible();
    // wa.me link deve estar presente em pelo menos 1 lugar.
    const waLinks = page.locator('a[href*="wa.me/"]');
    await expect(waLinks.first()).toBeVisible();
    await expectNoindexMeta(page);
  });

  test("Anunciar `/sites/[slug]/anunciar` renderiza form + noindex", async ({
    page,
  }) => {
    const res = await page.goto(`/sites/${slug}/anunciar`);
    expect(res?.status()).toBe(200);
    await expect(
      page.getByRole("heading", { level: 1, name: /Anuncie/i }),
    ).toBeVisible();
    // Form deve ter pelo menos um input — a UI é client-side; aguarda.
    await expect(page.locator("form").first()).toBeVisible();
    await expectNoindexMeta(page);
  });

  test("Estoque `/sites/[slug]/estoque` lista cars (≥1) + noindex", async ({
    page,
  }) => {
    const res = await page.goto(`/sites/${slug}/estoque`);
    expect(res?.status()).toBe(200);
    await expect(
      page.getByRole("heading", { level: 1, name: /^Nosso Estoque$/ }),
    ).toBeVisible();
    // O fixture tem 4 cars; exigimos pelo menos 1 link pra detalhe.
    const carLinks = page.locator(`a[href*="/sites/${slug}/estoque/"]`);
    await expect(carLinks.first()).toBeVisible();
    await expectNoindexMeta(page);
  });

  test("Detalhe carro `/sites/[slug]/estoque/[carSlug]` renderiza gallery + datasheet + noindex", async ({
    page,
  }) => {
    const res = await page.goto(
      `/sites/${slug}/estoque/${FIRST_CAR_SLUG}`,
    );
    expect(res?.status()).toBe(200);
    await expect(
      page.getByRole("heading", { level: 1 }).first(),
    ).toBeVisible();
    await expect(page.getByTestId("car-gallery")).toBeVisible();
    await expect(page.getByTestId("car-detail-datasheet")).toBeVisible();
    await expectNoindexMeta(page);
  });
});
