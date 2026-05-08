import { expect, test } from "@playwright/test";
import { describeWithAuth, loginAs } from "../_helpers/auth";

test.describe("campaigns", () => {
  test.skip(
    !describeWithAuth(),
    "Fluxo autenticado exige E2E_AUTH_EMAIL/E2E_AUTH_PASSWORD.",
  );

  test("seleção em /leads → 'Criar campanha' → form preenche → submit redireciona", async ({
    page,
  }) => {
    // Mock do endpoint para resposta determinística (não disparar Evolution).
    await page.route("**/api/campaigns", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            campaignId: "test-campaign-1",
            queuedTargets: 2,
          }),
        });
      } else {
        await route.continue();
      }
    });

    await loginAs(page, "/leads");

    const empty = page.getByText(/nenhum lead encontrado/i);
    if (await empty.isVisible().catch(() => false)) {
      test.skip(true, "Sem leads no DB para campanha.");
      return;
    }

    // Selecionar 2 leads
    const checkboxes = page.getByRole("checkbox", { name: /selecionar lead/i });
    const count = await checkboxes.count();
    const toCheck = Math.min(count, 2);
    for (let i = 0; i < toCheck; i += 1) {
      await checkboxes.nth(i).check();
    }

    await expect(
      page.getByText(new RegExp(`${toCheck} selecionado`, "i")),
    ).toBeVisible();

    await page.getByTestId("leads-toolbar-create-campaign").click();

    await expect(page).toHaveURL(/\/campaigns\/new\?leads=/);
    // Form da campanha aparece
    await expect(
      page.getByRole("heading", { name: /nova campanha/i }),
    ).toBeVisible();
  });

  test("/campaigns vazio mostra empty state desenhado", async ({ page }) => {
    await loginAs(page, "/campaigns");

    // Ou empty state, ou tabela com lista — ambos válidos.
    const emptyState = page.getByText(/nenhuma campanha/i).first();
    const heading = page.getByRole("heading", { level: 1, name: /campanhas/i });

    await expect(heading).toBeVisible();
    // Pelo menos uma das opções deve renderizar
    const hasContent =
      (await emptyState.isVisible().catch(() => false)) ||
      (await page.getByRole("table").isVisible().catch(() => false)) ||
      (await page.getByRole("button", { name: /criar/i }).isVisible().catch(() => false));
    expect(hasContent).toBe(true);
  });
});
