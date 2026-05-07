import { expect, test } from "@playwright/test";

test.describe("smoke", () => {
  test("a raiz redireciona para login quando não há sessão", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Gasp Search");
    await expect(page).toHaveTitle(/Gasp Search/);
  });

  test("html tem lang pt-BR e classe dark", async ({ page }) => {
    await page.goto("/");
    const html = page.locator("html");
    await expect(html).toHaveAttribute("lang", "pt-BR");
    await expect(html).toHaveClass(/dark/);
  });
});
