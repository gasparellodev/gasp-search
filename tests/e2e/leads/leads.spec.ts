import { expect, test } from "@playwright/test";

const email = process.env.E2E_AUTH_EMAIL;
const password = process.env.E2E_AUTH_PASSWORD;

test.describe("leads list", () => {
  test.skip(
    !email || !password,
    "Fluxo autenticado exige E2E_AUTH_EMAIL/E2E_AUTH_PASSWORD.",
  );

  test("renderiza tabela ou empty state e atualiza URL ao trocar pageSize", async ({
    page,
  }) => {
    await page.goto("/login?redirectTo=/leads");
    await page.getByLabel("E-mail").fill(email!);
    await page.getByLabel("Senha").fill(password!);
    await page.getByRole("button", { name: /^entrar$/i }).click();

    await expect(page).toHaveURL(/\/leads/);
    await expect(
      page.getByRole("heading", { level: 1, name: /^leads$/i }),
    ).toBeVisible();

    const empty = page.getByText(/nenhum lead encontrado/i);
    const table = page.getByRole("table");

    if (await empty.isVisible().catch(() => false)) {
      // Sem dados: empty state desenhado é parte do critério de aceite.
      await expect(empty).toBeVisible();
      return;
    }

    await expect(table).toBeVisible();

    // Trocar pageSize deve reescrever a URL e voltar para a página 1.
    await page.getByLabel(/itens por página/i).selectOption("50");
    await expect(page).toHaveURL(/pageSize=50/);
    await expect(page).toHaveURL(/page=1/);

    // Clicar em uma linha abre o drawer com o nome do lead.
    const firstRow = table.locator("tbody tr").first();
    const firstName = await firstRow.locator("td").first().innerText();
    await firstRow.click();

    await expect(
      page.getByRole("heading", { level: 2, name: firstName.trim() }),
    ).toBeVisible();
    await page.getByRole("button", { name: /fechar/i }).click();
  });

  test("seleciona leads, aciona Enriquecer e vê toast com resultado", async ({
    page,
  }) => {
    // Mock da rota para garantir resposta determinística no CI/local
    await page.route("**/api/apify/enrich", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ enrichedCount: 3, failedIds: [] }),
      });
    });

    await page.goto("/login?redirectTo=/leads");
    await page.getByLabel("E-mail").fill(email!);
    await page.getByLabel("Senha").fill(password!);
    await page.getByRole("button", { name: /^entrar$/i }).click();
    await expect(page).toHaveURL(/\/leads/);

    const empty = page.getByText(/nenhum lead encontrado/i);
    if (await empty.isVisible().catch(() => false)) {
      test.skip(true, "Sem leads no DB para exercitar bulk enrich.");
      return;
    }

    const checkboxes = page.getByRole("checkbox", {
      name: /selecionar lead/i,
    });
    const count = await checkboxes.count();
    const toCheck = Math.min(count, 3);
    for (let i = 0; i < toCheck; i += 1) {
      await checkboxes.nth(i).check();
    }
    await expect(
      page.getByText(new RegExp(`${toCheck} selecionado`, "i")),
    ).toBeVisible();
    await page.getByRole("button", { name: /enriquecer selecionado/i }).click();

    await expect(
      page.getByText(/enriquecimento concluído/i).first(),
    ).toBeVisible();
  });
});
