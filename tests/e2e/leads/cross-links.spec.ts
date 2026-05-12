/**
 * E2E — cross-links leads ↔ messages ↔ campaigns ↔ pipeline (issue #137).
 *
 * Verifica que as 4 superfícies da UI cruzam entre si:
 *   - `/messages/[leadId]` header → `<Link href="/leads/[id]">`
 *   - `TargetStatusTable` (em /campaigns/[id]) → nomes linkam para /leads/[id]
 *   - Pipeline cards → click abre `<LeadDetailDrawer>`
 *
 * Skip declarativo quando E2E_AUTH_*  ausentes — segue o padrão de
 * `tests/e2e/leads/leads.spec.ts`.
 */
import { expect, test } from "@playwright/test";

import { describeWithAuth, loginAs } from "../_helpers/auth";

test.describe("cross-links: leads ↔ messages ↔ campaigns ↔ pipeline (#137)", () => {
  test.skip(
    !describeWithAuth(),
    "Fluxo autenticado exige E2E_AUTH_EMAIL/E2E_AUTH_PASSWORD.",
  );

  test("pipeline card click abre drawer com a ficha do lead", async ({
    page,
  }) => {
    await loginAs(page, "/pipeline");

    const emptyPipeline = page.getByText(/nenhum lead no pipeline/i);
    if (await emptyPipeline.isVisible().catch(() => false)) {
      test.skip(true, "Pipeline vazio — sem cards pra exercitar o click.");
      return;
    }

    // Pega o primeiro card de qualquer coluna.
    const firstCard = page
      .locator('[data-testid^="pipeline-column-list-"] [role="button"]')
      .first();
    await expect(firstCard).toBeVisible();
    const cardName = (await firstCard.locator("p").first().innerText()).trim();

    await firstCard.click();

    // Drawer abre — SheetTitle renderiza como h2 com o nome do lead.
    await expect(
      page.getByRole("heading", { level: 2, name: cardName }),
    ).toBeVisible();
    await page.getByRole("button", { name: /fechar/i }).click();
  });

  test("campaigns target table → lead detail (quando WhatsApp habilitado)", async ({
    page,
  }) => {
    // Esse teste só faz sentido com flag de WhatsApp — caso contrário a
    // rota /campaigns redireciona para /dashboard.
    await loginAs(page, "/campaigns");
    if (page.url().endsWith("/dashboard")) {
      test.skip(true, "NEXT_PUBLIC_WHATSAPP_ENABLED=0 — redireciona.");
      return;
    }

    const firstCampaignLink = page.locator('a[href^="/campaigns/"]').first();
    if ((await firstCampaignLink.count()) === 0) {
      test.skip(true, "Sem campanhas para exercitar TargetStatusTable.");
      return;
    }
    await firstCampaignLink.click();

    const table = page.getByTestId("target-status-table");
    await expect(table).toBeVisible();

    const firstLeadLink = table.locator('a[href^="/leads/"]').first();
    if ((await firstLeadLink.count()) === 0) {
      test.skip(true, "Campanha sem targets — sem linha pra clicar.");
      return;
    }
    const href = await firstLeadLink.getAttribute("href");
    expect(href).toMatch(/^\/leads\/.+/);

    await firstLeadLink.click();
    await expect(page).toHaveURL(/\/leads\/.+/);
  });

  test("/messages/[leadId] header → ficha /leads/[id] (quando WhatsApp habilitado)", async ({
    page,
  }) => {
    await loginAs(page, "/messages");
    if (page.url().endsWith("/dashboard")) {
      test.skip(true, "NEXT_PUBLIC_WHATSAPP_ENABLED=0 — redireciona.");
      return;
    }

    const firstConversation = page
      .locator('[data-testid^="conversation-item-"]')
      .first();
    if ((await firstConversation.count()) === 0) {
      test.skip(true, "Sem conversas pra exercitar o cross-link.");
      return;
    }
    await firstConversation.click();

    // O header da thread agora tem um <a href="/leads/[id]"> envolvendo o nome.
    const link = page
      .locator("main header a[href^='/leads/']")
      .first();
    await expect(link).toBeVisible();
    const href = await link.getAttribute("href");
    expect(href).toMatch(/^\/leads\/.+/);

    await link.click();
    await expect(page).toHaveURL(/\/leads\/.+/);
  });
});
