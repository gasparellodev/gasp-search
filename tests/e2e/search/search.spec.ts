import { expect, test } from "@playwright/test";

const email = process.env.E2E_AUTH_EMAIL;
const password = process.env.E2E_AUTH_PASSWORD;

test.describe("search", () => {
  test.skip(
    !email || !password,
    "Fluxo autenticado exige E2E_AUTH_EMAIL/E2E_AUTH_PASSWORD.",
  );

  test("submete Google Maps com Apify mockado e redireciona para leads", async ({
    page,
  }) => {
    await page.route("**/api/apify/google-maps", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          jobId: "job-e2e",
          status: "succeeded",
          leadsCount: 2,
        }),
      });
    });

    await page.goto("/login?redirectTo=/search");
    await page.getByLabel("E-mail").fill(email!);
    await page.getByLabel("Senha").fill(password!);
    await page.getByRole("button", { name: /^entrar$/i }).click();

    await expect(page).toHaveURL(/\/search$/);
    await page.getByLabel(/termo de busca/i).fill("barbearia");
    await page.getByRole("button", { name: /adicionar termo/i }).click();
    await page.getByLabel(/cidade/i).fill("Curitiba");
    await page.getByLabel(/estado/i).fill("PR");
    await page.getByRole("button", { name: /^buscar$/i }).click();

    await expect(page).toHaveURL(/\/leads\?searchJobId=job-e2e$/);
  });
});
