/**
 * E2E: <HomeContactFormQuick /> (Phase 7 / Sprint 4 / #H3 — issue #223).
 *
 * Cobre o fluxo crítico: form fill → submit → toast success. Mockamos
 * Supabase service-role via Server Action (que retorna `{ success:
 * true }` no MVP); aqui só validamos o UX do form, não a persistência
 * (essa é unit no `tests/unit/app/actions/site-form.test.ts`).
 *
 * Gated por `TEST_SEED_TOKEN` (helper `sitesE2EEnabled`) + também por
 * `NEXT_PUBLIC_SITE_FORMS_ENABLED='1'` (env no build do Next, então
 * caller precisa ter setado antes do `npm run build`).
 */
import { expect, test } from "@playwright/test";

import {
  cleanupSite,
  getValidVariables,
  makeTestSlug,
  seedSite,
  sitesE2EEnabled,
} from "./helpers";

const formsFlag = process.env.NEXT_PUBLIC_SITE_FORMS_ENABLED;

test.describe("home contact form quick (H3)", () => {
  test.skip(
    !sitesE2EEnabled(),
    "TEST_SEED_TOKEN/TEST_SEED_USER_ID/Supabase real ausentes — pulando.",
  );

  test.skip(
    formsFlag !== "1",
    "NEXT_PUBLIC_SITE_FORMS_ENABLED != '1' — form não renderiza, pulando.",
  );

  let slug: string;
  const variables = getValidVariables();

  test.beforeEach(async ({ request }) => {
    slug = makeTestSlug("e2e-contact");
    await seedSite(request, {
      slug,
      status: "published",
      variables,
    });
  });

  test.afterEach(async ({ request }) => {
    if (slug) await cleanupSite(request, { slug });
  });

  test("form renderiza e submit válido dispara toast de sucesso", async ({
    page,
  }) => {
    await page.goto(`/sites/${slug}`);

    const form = page.getByTestId("home-contact-form-quick");
    await form.scrollIntoViewIfNeeded();
    await expect(form).toBeVisible();

    // 4 inputs visíveis.
    await form.getByLabel(/nome completo/i).fill("Maria Silva");
    await form.getByLabel(/telefone/i).fill("11987654321");
    await form.getByLabel(/e-mail/i).fill("maria@example.com");
    await form
      .getByLabel(/^mensagem$/i)
      .fill("Tenho interesse no Toyota Corolla 2020 prata.");

    // LGPD checkbox obrigatório.
    await form.getByRole("checkbox").check();

    // Espera o min-time gate passar (2s).
    await page.waitForTimeout(2100);

    await form.getByRole("button", { name: /enviar mensagem/i }).click();

    // Toast PT-BR de sucesso.
    await expect(
      page.getByText(/mensagem enviada/i),
    ).toBeVisible({ timeout: 5000 });
  });

  test("honeypot field está escondido visualmente mas presente no DOM", async ({
    page,
  }) => {
    await page.goto(`/sites/${slug}`);
    const form = page.getByTestId("home-contact-form-quick");
    await form.scrollIntoViewIfNeeded();

    const honeypot = form.locator('input[name="website"]');
    await expect(honeypot).toHaveAttribute("tabindex", "-1");
    await expect(honeypot).toHaveAttribute("autocomplete", "off");
  });
});
