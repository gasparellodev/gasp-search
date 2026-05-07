import { expect, test } from "@playwright/test";

test.describe("login", () => {
  test("/login carrega tabs e botão Google", async ({ page }) => {
    await page.goto("/login");
    await expect(
      page.getByRole("tab", { name: "Entrar" }),
    ).toBeVisible();
    await expect(
      page.getByRole("tab", { name: "Cadastrar" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /continuar com google/i }),
    ).toBeVisible();
  });

  test("validação inline aparece ao submeter formulário vazio", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: /^entrar$/i }).click();
    await expect(page.getByText(/e-mail inválido/i).first()).toBeVisible();
  });

  test("acessar rota protegida redireciona para /login com redirectTo", async ({
    page,
  }) => {
    const response = await page.goto("/dashboard");
    // Pode redirecionar e ainda assim retornar 200 do login
    expect(page.url()).toContain("/login");
    expect(page.url()).toContain("redirectTo=");
    expect(decodeURIComponent(page.url())).toContain("/dashboard");
    expect(response).toBeTruthy();
  });
});
