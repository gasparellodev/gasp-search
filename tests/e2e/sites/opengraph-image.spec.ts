/**
 * E2E: `/sites/[slug]/opengraph-image` — issue #247 (Sprint 1 follow-up
 * de #213).
 *
 * Foco: garantir que o handler **NÃO crasha** (regressão do bug original
 * onde `cacheTag(\`og:\${slug}\`)` standalone disparava
 * `Error: 'cacheTag()' can only be called inside a "use cache" function`
 * em Next 16), e que o gate de visibilidade (`isIndexable`) responde
 * 404 limpo (sem stack trace 500) em todos os caminhos esperados.
 *
 * **Por que não testar happy path 200 aqui?** A rota `e2e-seed/seed-lead-site`
 * (test-only) cria sites com `signed_at: null` por design (admin assina
 * manualmente per issue #199). Como `isIndexable` exige `signed_at !== null`,
 * o happy path 200 com seeded site daria 404 — não é bug, é spec.
 * Cobertura do happy path 200 fica em
 * `tests/unit/app/sites/[slug]/opengraph-image.test.tsx` com mock de
 * `getSite` retornando `signed_at` populated.
 *
 * **O que testamos aqui:**
 *   1. Slug inexistente → 404 (sem 500 / stack trace).
 *   2. Slug seedado (status='published', signed_at=null) → 404 (gate
 *      isIndexable defende vazamento de preview em sites não-assinados).
 *   3. Slug seedado (status='draft') → 404 (gate status).
 *   4. Slug seedado (status='archived') → 404.
 */
import { expect, test } from "@playwright/test";

import {
  cleanupSite,
  makeTestSlug,
  seedSite,
  sitesE2EEnabled,
} from "./helpers";

test.describe("opengraph-image — gate isIndexable + sem crash cacheTag (#247)", () => {
  test("/sites/<inexistente>/opengraph-image → 404 (sem 500)", async ({
    request,
  }) => {
    const res = await request.get("/sites/nao-existe-12345/opengraph-image");
    // Regression #247: handler NÃO deve crashar com 500 via cacheTag
    // standalone — esperamos 404 limpo (Response { status: 404 }).
    expect(res.status()).toBe(404);
  });

  test.describe("com seeded site (signed_at=null por design)", () => {
    test.skip(
      !sitesE2EEnabled(),
      "TEST_SEED_TOKEN/TEST_SEED_USER_ID ausentes — pulando.",
    );

    let slug: string;

    test.beforeEach(async () => {
      slug = makeTestSlug("e2e-og");
    });

    test.afterEach(async ({ request }) => {
      if (slug) await cleanupSite(request, { slug });
    });

    test("status=draft → 404 (gate status)", async ({ request }) => {
      await seedSite(request, { slug, status: "draft" });
      const res = await request.get(`/sites/${slug}/opengraph-image`);
      expect(res.status()).toBe(404);
    });

    test("status=published mas signed_at=null → 404 (gate signed)", async ({
      request,
    }) => {
      await seedSite(request, { slug, status: "published" });
      const res = await request.get(`/sites/${slug}/opengraph-image`);
      // Seed nunca seta signed_at — isIndexable retorna false.
      expect(res.status()).toBe(404);
    });

    test("status=archived → 404", async ({ request }) => {
      await seedSite(request, { slug, status: "archived" });
      const res = await request.get(`/sites/${slug}/opengraph-image`);
      expect(res.status()).toBe(404);
    });
  });
});
