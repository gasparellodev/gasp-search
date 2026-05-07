import { expect, test } from "@playwright/test";

const email = process.env.E2E_AUTH_EMAIL;
const password = process.env.E2E_AUTH_PASSWORD;

test.describe("pipeline", () => {
  test.skip(
    !email || !password,
    "Fluxo autenticado exige E2E_AUTH_EMAIL/E2E_AUTH_PASSWORD.",
  );

  test("renderiza colunas do kanban e header", async ({ page }) => {
    await page.goto("/login?redirectTo=/pipeline");
    await page.getByLabel("E-mail").fill(email!);
    await page.getByLabel("Senha").fill(password!);
    await page.getByRole("button", { name: /^entrar$/i }).click();

    await expect(page).toHaveURL(/\/pipeline/);
    await expect(
      page.getByRole("heading", { level: 1, name: /pipeline/i }),
    ).toBeVisible();

    for (const label of [
      "Novo",
      "Contatado",
      "Em conversa",
      "Qualificado",
      "Ganho",
      "Perdido",
    ]) {
      await expect(
        page.getByRole("region", { name: new RegExp(`^${label}$`, "i") }),
      ).toBeVisible();
    }
  });
});
