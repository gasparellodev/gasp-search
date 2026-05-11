/**
 * E2E: `/sites/[slug]/llms.txt` — issue #214 / Sprint 1 / #S4.
 *
 * Foco: gate de visibilidade (`isIndexable`) com 404 `text/plain` em
 * todos os paths de erro, garantindo que AI crawlers parseiam o
 * response corretamente (sem HTML default do `notFound()`).
 *
 * **Por que não testar happy path 200 aqui?** A rota `e2e-seed/seed-lead-site`
 * (test-only) cria sites com `signed_at: null` por design (admin assina
 * manualmente per issue #199). Como `isIndexable` exige `signed_at !== null`,
 * o happy path 200 com seeded site daria 404 — não é bug, é spec.
 * Cobertura do happy path fica em `tests/unit/app/sites/[slug]/llms.txt/route.test.ts`
 * com mock de `getSite` retornando `signed_at` populated.
 *
 * **O que testamos aqui:**
 *   1. Slug inexistente → 404 `text/plain`.
 *   2. Slug seedado (status='published', signed_at=null) → 404 `text/plain`
 *      (gate isIndexable defende vazamento de contato em sites não-assinados).
 *   3. Slug seedado (status='draft') → 404 `text/plain` (gate status).
 *   4. Content-Type SEMPRE `text/plain; charset=utf-8` em 404 — distinto
 *      do default HTML do `notFound()` que quebraria AI crawler parsing.
 */
import { expect, test } from "@playwright/test";

import {
  cleanupSite,
  makeTestSlug,
  seedSite,
  sitesE2EEnabled,
} from "./helpers";

test.describe("llms.txt — gate isIndexable + Content-Type (#214)", () => {
  test("/sites/<inexistente>/llms.txt → 404 com Content-Type text/plain", async ({
    request,
  }) => {
    const res = await request.get("/sites/nao-existe-12345/llms.txt");
    expect(res.status()).toBe(404);
    expect(res.headers()["content-type"]).toMatch(/text\/plain/);
    expect(res.headers()["content-type"]).toMatch(/charset=utf-8/i);
  });

  test.describe("com seeded site (signed_at=null por design)", () => {
    test.skip(
      !sitesE2EEnabled(),
      "TEST_SEED_TOKEN/TEST_SEED_USER_ID ausentes — pulando.",
    );

    let slug: string;

    test.beforeEach(async () => {
      slug = makeTestSlug("e2e-llms");
    });

    test.afterEach(async ({ request }) => {
      if (slug) await cleanupSite(request, { slug });
    });

    test("status=draft → 404 text/plain (gate status)", async ({
      request,
    }) => {
      await seedSite(request, { slug, status: "draft" });
      const res = await request.get(`/sites/${slug}/llms.txt`);
      expect(res.status()).toBe(404);
      expect(res.headers()["content-type"]).toMatch(/text\/plain/);
    });

    test("status=published mas signed_at=null → 404 text/plain (gate signed)", async ({
      request,
    }) => {
      await seedSite(request, { slug, status: "published" });
      const res = await request.get(`/sites/${slug}/llms.txt`);
      // Seed nunca seta signed_at — isIndexable retorna false.
      expect(res.status()).toBe(404);
      expect(res.headers()["content-type"]).toMatch(/text\/plain/);
    });

    test("status=archived → 404 text/plain", async ({ request }) => {
      await seedSite(request, { slug, status: "archived" });
      const res = await request.get(`/sites/${slug}/llms.txt`);
      expect(res.status()).toBe(404);
      expect(res.headers()["content-type"]).toMatch(/text\/plain/);
    });
  });
});
