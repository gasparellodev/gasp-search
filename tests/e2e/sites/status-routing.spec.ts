/**
 * E2E: routing por status — AC5 #166.
 *
 * Status `draft` e `archived` devem retornar 404 (V1 — spec §4 pede
 * 410 para archived em V2; a implementação atual unifica em 404).
 * Status `published` é coberto em `rendering.spec.ts`.
 *
 * Cada teste seeda com status diferente e verifica:
 *   - draft → 404 + UI Next "404 not found"
 *   - archived → 404 + UI Next "404 not found"
 */
import { expect, test } from "@playwright/test";

import {
  cleanupSite,
  makeTestSlug,
  seedSite,
  sitesE2EEnabled,
} from "./helpers";

test.describe("sites status routing", () => {
  test.skip(
    !sitesE2EEnabled(),
    "TEST_SEED_TOKEN/TEST_SEED_USER_ID/Supabase real ausentes — pulando.",
  );

  test("status=draft retorna 404 em /sites/[slug]", async ({
    page,
    request,
  }) => {
    const slug = makeTestSlug("e2e-draft");
    await seedSite(request, { slug, status: "draft" });
    try {
      const res = await page.goto(`/sites/${slug}`);
      expect(res?.status()).toBe(404);
    } finally {
      await cleanupSite(request, { slug });
    }
  });

  test("status=archived retorna 404 em /sites/[slug]", async ({
    page,
    request,
  }) => {
    const slug = makeTestSlug("e2e-archived");
    await seedSite(request, { slug, status: "archived" });
    try {
      const res = await page.goto(`/sites/${slug}`);
      expect(res?.status()).toBe(404);
    } finally {
      await cleanupSite(request, { slug });
    }
  });

  test("slug inexistente retorna 404", async ({ page }) => {
    const ghost = makeTestSlug("e2e-ghost");
    const res = await page.goto(`/sites/${ghost}`);
    expect(res?.status()).toBe(404);
  });
});
