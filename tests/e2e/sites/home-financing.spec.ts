/**
 * E2E: HomeFinancingWidget (Phase 7 / Sprint 4 / #H2 — issue #222).
 *
 * Cobre o fluxo crítico: ajustar inputs → output atualiza → click WhatsApp
 * → deep-link contém `utm_campaign=financing` (template financing) +
 * `utm_content=home-cta`.
 *
 * Pulado quando o seed real do Supabase não está configurado (TEST_SEED_TOKEN
 * etc.) — mesma convenção dos outros specs do Sites.
 */
import { expect, test } from "@playwright/test";

import {
  cleanupSite,
  getValidVariables,
  makeTestSlug,
  seedSite,
  sitesE2EEnabled,
} from "./helpers";

test.describe("home financing widget", () => {
  test.skip(
    !sitesE2EEnabled(),
    "TEST_SEED_TOKEN/TEST_SEED_USER_ID/Supabase real ausentes — pulando.",
  );

  let slug: string;
  const variables = getValidVariables();

  test.beforeEach(async ({ request }) => {
    slug = makeTestSlug("e2e-financing");
    await seedSite(request, {
      slug,
      status: "published",
      variables,
    });
  });

  test.afterEach(async ({ request }) => {
    if (slug) await cleanupSite(request, { slug });
  });

  test("calculadora renderiza com DISCLAIMER + output não-vazio", async ({
    page,
  }) => {
    await page.goto(`/sites/${slug}`);

    const widget = page.getByTestId("home-financing-widget");
    await widget.scrollIntoViewIfNeeded();
    await expect(widget).toBeVisible();

    // DISCLAIMER CDC obrigatório.
    await expect(widget).toContainText(/sujeito a aprovação de crédito/i);

    // Output inicial — installment formatado em BRL.
    const installment = widget.getByTestId("financing-installment");
    await expect(installment).toBeVisible();
    await expect(installment).toContainText(/R\$/);
  });

  test("ajustar entrada propaga ao output (real-time)", async ({ page }) => {
    await page.goto(`/sites/${slug}`);

    const widget = page.getByTestId("home-financing-widget");
    await widget.scrollIntoViewIfNeeded();

    const slider = widget.getByTestId("financing-down-slider");
    const initial = await widget
      .getByTestId("financing-installment")
      .textContent();

    // Move slider para 50% (max). Em range inputs Playwright usa `fill`.
    await slider.evaluate((el: HTMLInputElement) => {
      el.value = "50";
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    });

    // Display "%" atualizado.
    await expect(widget.getByTestId("financing-down-display")).toHaveText(
      "50%",
    );
    // Installment recalculado (≠ valor inicial).
    const updated = await widget
      .getByTestId("financing-installment")
      .textContent();
    expect(updated).not.toBe(initial);
  });

  test("CTA WhatsApp tem template financing (utm_campaign=financing)", async ({
    page,
  }) => {
    await page.goto(`/sites/${slug}`);
    const widget = page.getByTestId("home-financing-widget");
    await widget.scrollIntoViewIfNeeded();

    const cta = widget.getByTestId("financing-cta");
    await expect(cta).toHaveAttribute("href", /wa\.me/);
    await expect(cta).toHaveAttribute("href", /utm_campaign=financing/);
    await expect(cta).toHaveAttribute("href", /utm_content=home-cta/);
    await expect(cta).toHaveAttribute("href", new RegExp(`utm_term=${slug}`));
  });
});
