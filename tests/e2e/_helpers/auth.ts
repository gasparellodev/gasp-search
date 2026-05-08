import { test as base, type Page } from "@playwright/test";

export const E2E_EMAIL = process.env.E2E_AUTH_EMAIL;
export const E2E_PASSWORD = process.env.E2E_AUTH_PASSWORD;

/**
 * Skip declarative — coloque no topo do test.describe quando a suíte
 * inteira depende de auth real:
 *
 *   test.describe("...", () => {
 *     test.skip(!E2E_EMAIL || !E2E_PASSWORD, "auth e2e ausente");
 *     ...
 *   });
 */
export function describeWithAuth(): boolean {
  return Boolean(E2E_EMAIL && E2E_PASSWORD);
}

/**
 * Faz login real via UI. Necessário porque os tokens Supabase ficam em
 * cookies httpOnly — não dá pra fakear via storageState sem a fluxo completo.
 *
 * @param page — instance do Playwright
 * @param redirectTo — caminho pós-login (default: /dashboard)
 */
export async function loginAs(
  page: Page,
  redirectTo: string = "/dashboard",
): Promise<void> {
  if (!E2E_EMAIL || !E2E_PASSWORD) {
    throw new Error(
      "E2E_AUTH_EMAIL/E2E_AUTH_PASSWORD ausentes — chame describeWithAuth() antes ou test.skip().",
    );
  }
  await page.goto(`/login?redirectTo=${encodeURIComponent(redirectTo)}`);
  await page.getByLabel("E-mail").fill(E2E_EMAIL);
  await page.getByLabel("Senha").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: /^entrar$/i }).click();
  await page.waitForURL((url) => url.pathname === redirectTo);
}

export const test = base;
