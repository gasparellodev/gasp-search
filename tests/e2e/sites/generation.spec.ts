/**
 * E2E: pipeline de geração — seed via rota test-only e verifica que o
 * site fica disponível em `/sites/[slug]` (proxy da inserção em
 * `lead_sites`). Per AC2 da issue #166.
 *
 * Seed bypassa Anthropic/Apify reais — o objetivo é validar que **uma
 * vez gravada** a row, a rota pública renderiza. A geração via IA tem
 * cobertura própria em `tests/unit/lib/sites/generate-lead-site.test.ts`.
 */
import { expect, test } from "@playwright/test";

import {
  cleanupSite,
  makeTestSlug,
  seedSite,
  sitesE2EEnabled,
} from "./helpers";

test.describe("sites generation", () => {
  test.skip(
    !sitesE2EEnabled(),
    "TEST_SEED_TOKEN/TEST_SEED_USER_ID/Supabase real ausentes — pulando.",
  );

  let slug: string;

  test.beforeEach(async ({ request }) => {
    slug = makeTestSlug("e2e-gen");
    await seedSite(request, { slug, status: "published" });
  });

  test.afterEach(async ({ request }) => {
    if (slug) await cleanupSite(request, { slug });
  });

  test("site seeded fica acessível em /sites/[slug] e responde 200", async ({
    page,
  }) => {
    const response = await page.goto(`/sites/${slug}`);
    expect(response?.status()).toBe(200);
    await expect(
      page.getByRole("heading", { level: 1 }).first(),
    ).toBeVisible();
  });
});
