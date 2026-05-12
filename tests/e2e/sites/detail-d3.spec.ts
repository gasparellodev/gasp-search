import { expect, test } from "@playwright/test";

import {
  cleanupSite,
  getValidVariables,
  makeTestSlug,
  seedSite,
  sitesE2EEnabled,
} from "./helpers";

/**
 * E2E — Detail D3 (Phase 7 / Sprint 6 / #228).
 *
 * Cobre wireup dos 3 novos blocos cross-conversion + objection-handling
 * no detalhe do carro:
 *  - `<DetailTradeinWidget>` (CTA "AVALIAR" → `?car_target_slug=...`).
 *  - `<DetailSimilarVehicles>` (até 4 cards similares + badge fallback).
 *  - `<DetailFaqVehicle>` (Accordion shared com perguntas contextuais).
 *
 * Como o spec mestre da Wave 0 (`helpers.ts:sitesE2EEnabled`) gateia
 * tudo em CI sem secrets, os testes são `test.skip` localmente.
 */
test.describe("sites detalhe — D3 #228", () => {
  test.skip(
    !sitesE2EEnabled(),
    "TEST_SEED_TOKEN/TEST_SEED_USER_ID/Supabase real ausentes — pulando.",
  );

  let slug: string;
  const variables = getValidVariables();
  const car = variables.cars[0]!;

  test.beforeEach(async ({ request }) => {
    slug = makeTestSlug("e2e-detail-d3");
    await seedSite(request, {
      slug,
      status: "published",
      variables,
    });
  });

  test.afterEach(async ({ request }) => {
    if (slug) await cleanupSite(request, { slug });
  });

  test("renderiza Tradein widget com href car_target_slug + Similar + FAQ", async ({
    page,
  }) => {
    await page.goto(`/sites/${slug}/estoque/${car.slug}`);

    // Tradein widget
    const tradein = page.getByTestId("detail-tradein-widget");
    await expect(tradein).toBeVisible();
    await expect(
      tradein.getByRole("heading", { name: /use seu carro como entrada/i }),
    ).toBeVisible();
    const tradeinCta = tradein.getByRole("link", { name: /avaliar/i });
    await expect(tradeinCta).toHaveAttribute(
      "href",
      `/sites/${slug}/anunciar?car_target_slug=${encodeURIComponent(car.slug)}`,
    );

    // Similar vehicles
    await expect(page.getByTestId("detail-similar-vehicles")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /veículos similares/i }),
    ).toBeVisible();

    // FAQ contextual (Radix Accordion — pelo menos um trigger visível)
    const faq = page.getByTestId("detail-faq-vehicle");
    await expect(faq).toBeVisible();
    await expect(
      faq.getByRole("heading", { name: /perguntas frequentes/i }),
    ).toBeVisible();
  });

  test("ordem visual: SpecGrid → Tradein → Similar → FAQ → SiteForm", async ({
    page,
  }) => {
    await page.goto(`/sites/${slug}/estoque/${car.slug}`);
    const ids = [
      "detail-spec-grid",
      "detail-tradein-widget",
      "detail-similar-vehicles",
      "detail-faq-vehicle",
      "site-form",
    ];
    const tops = await Promise.all(
      ids.map((id) =>
        page
          .getByTestId(id)
          .boundingBox()
          .then((box) => box?.y ?? Number.POSITIVE_INFINITY),
      ),
    );
    for (let i = 1; i < tops.length; i += 1) {
      expect(tops[i]).toBeGreaterThan(tops[i - 1]!);
    }
  });
});
