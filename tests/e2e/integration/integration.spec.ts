import { expect, test } from "@playwright/test";
import { describeWithAuth, loginAs } from "../_helpers/auth";

test.describe("integration end-to-end (smoke)", () => {
  test.skip(
    !describeWithAuth(),
    "Fluxo autenticado exige E2E_AUTH_EMAIL/E2E_AUTH_PASSWORD.",
  );

  test("/leads → Enriquecer mockado → Criar campanha → /campaigns/new pré-preenchido", async ({
    page,
  }) => {
    await page.route("**/api/apify/enrich", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ enrichedCount: 2, failedIds: [] }),
      });
    });

    await loginAs(page, "/leads");

    const empty = page.getByText(/nenhum lead encontrado/i);
    if (await empty.isVisible().catch(() => false)) {
      test.skip(true, "Sem leads para o fluxo integration.");
      return;
    }

    const checkboxes = page.getByRole("checkbox", { name: /selecionar lead/i });
    const total = await checkboxes.count();
    const toCheck = Math.min(total, 2);
    for (let i = 0; i < toCheck; i += 1) {
      await checkboxes.nth(i).check();
    }

    // 1. Enriquecer mockado
    await page.getByRole("button", { name: /enriquecer selecionado/i }).click();
    await expect(
      page.getByText(/enriquecimento concluído/i).first(),
    ).toBeVisible({ timeout: 10_000 });

    // Reseleciona após o toolbar zerar o set após enrich
    for (let i = 0; i < toCheck; i += 1) {
      await checkboxes.nth(i).check();
    }

    // 2. Criar campanha
    await page.getByTestId("leads-toolbar-create-campaign").click();
    await expect(page).toHaveURL(/\/campaigns\/new\?leads=/);

    // O form ou pré-seleção de leads aparece
    await expect(
      page
        .getByRole("heading", { name: /nova campanha/i })
        .or(page.getByText(/leads selecionados/i))
        .first(),
    ).toBeVisible();
  });
});
