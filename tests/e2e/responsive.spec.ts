import { expect, test, type Page } from "@playwright/test";

const email = process.env.E2E_AUTH_EMAIL;
const password = process.env.E2E_AUTH_PASSWORD;

async function login(page: Page, redirectTo: string) {
  await page.goto(`/login?redirectTo=${encodeURIComponent(redirectTo)}`);
  await page.getByLabel("E-mail").fill(email!);
  await page.getByLabel("Senha").fill(password!);
  await page.getByRole("button", { name: /^entrar$/i }).click();
  await expect(page).toHaveURL(new RegExp(redirectTo.replace("/", "\\/")));
}

async function expectNoHorizontalOverflow(page: Page) {
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
  }));

  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
  expect(metrics.bodyScrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
}

test.describe("responsividade autenticada", () => {
  test.skip(
    !email || !password,
    "Fluxo autenticado exige E2E_AUTH_EMAIL/E2E_AUTH_PASSWORD.",
  );

  test("menu mobile abre e rotas principais não criam overflow horizontal", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await login(page, "/dashboard");

    await expectNoHorizontalOverflow(page);
    await page.getByRole("button", { name: /abrir menu principal/i }).click();
    await expect(
      page.getByRole("dialog", { name: /navegação principal/i }),
    ).toBeVisible();
    await page.getByRole("link", { name: /^leads$/i }).click();
    await expect(page).toHaveURL(/\/leads/);
    await expectNoHorizontalOverflow(page);

    for (const route of ["/search", "/pipeline", "/settings"]) {
      await page.goto(route);
      await expectNoHorizontalOverflow(page);
    }
  });

  test("leads, search e pipeline mantêm controles dentro do viewport mobile", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await login(page, "/leads");
    await expectNoHorizontalOverflow(page);

    const empty = page.getByText(/nenhum lead encontrado/i);
    if (!(await empty.isVisible().catch(() => false))) {
      const table = page.getByRole("table");
      const firstRow = table.locator("tbody tr").first();
      await firstRow.click();
      await page.getByRole("tab", { name: /mensagens ia/i }).click();
      await expect(page.getByText(/em breve/i)).toHaveCount(0);
      await expectNoHorizontalOverflow(page);
      await page.getByRole("button", { name: /fechar/i }).click();
    }

    await page.goto("/search");
    await page.getByLabel(/termo de busca/i).fill("barbearia");
    await page.getByRole("button", { name: /adicionar termo/i }).click();
    await expect(page.getByText("barbearia")).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.goto("/pipeline");
    await page.getByLabel(/visualizar estágio/i).selectOption("qualified");
    await expect(
      page.getByRole("region", { name: /^qualificado$/i }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});
