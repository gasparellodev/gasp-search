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
});
