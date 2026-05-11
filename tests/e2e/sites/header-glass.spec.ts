/**
 * E2E: header glass-sticky + MobileNav fullscreen (#218 / Sprint 3 G1).
 *
 * Cobre o comportamento visual principal em browser real:
 *  - header começa transparente e vira glass depois do scroll;
 *  - mobile Sheet fullscreen abre e fecha por backdrop, close button e ESC.
 */
import { expect, test, type Page } from "@playwright/test";

import {
  cleanupSite,
  getValidVariables,
  makeTestSlug,
  seedSite,
  sitesE2EEnabled,
} from "./helpers";

async function expectMobileNavOpen(page: Page) {
  const dialog = page.getByRole("dialog", { name: /menu de navegação/i });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute("data-mobile-nav", "content");
  const box = await dialog.boundingBox();
  expect(box?.x).toBe(0);
  expect(box?.y).toBe(0);
  expect(Math.round(box?.width ?? 0)).toBeGreaterThanOrEqual(390);
  expect(Math.round(box?.height ?? 0)).toBeGreaterThanOrEqual(800);
}

test.describe("sites header glass + mobile nav", () => {
  test.skip(
    !sitesE2EEnabled(),
    "TEST_SEED_TOKEN/TEST_SEED_USER_ID/Supabase real ausentes — pulando.",
  );

  let slug: string;
  const variables = getValidVariables();

  test.beforeEach(async ({ request }) => {
    slug = makeTestSlug("e2e-header");
    await seedSite(request, {
      slug,
      status: "published",
      variables,
    });
  });

  test.afterEach(async ({ request }) => {
    if (slug) await cleanupSite(request, { slug });
  });

  test("scroll aplica estado glass no header", async ({ page }) => {
    await page.goto(`/sites/${slug}`);

    const header = page.getByTestId("site-header");
    await expect(header).toHaveAttribute("data-scrolled", "false");

    await page.mouse.wheel(0, 900);
    await expect(header).toHaveAttribute("data-scrolled", "true");
    await expect
      .poll(async () =>
        header.evaluate((el) => getComputedStyle(el).backdropFilter),
      )
      .not.toBe("none");
  });

  test("mobile nav fullscreen fecha por backdrop, botão e ESC", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/sites/${slug}`);

    const menuButton = page.getByRole("button", { name: /abrir menu/i });
    await menuButton.click();
    await expectMobileNavOpen(page);

    await page.mouse.click(12, 12);
    await expect(
      page.getByRole("dialog", { name: /menu de navegação/i }),
    ).toBeHidden();

    await menuButton.click();
    await expectMobileNavOpen(page);
    await page.getByRole("button", { name: /fechar menu/i }).click();
    await expect(
      page.getByRole("dialog", { name: /menu de navegação/i }),
    ).toBeHidden();

    await menuButton.click();
    await expectMobileNavOpen(page);
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("dialog", { name: /menu de navegação/i }),
    ).toBeHidden();
  });
});
