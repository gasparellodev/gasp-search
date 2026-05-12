import { expect, test } from "@playwright/test";

import {
  cleanupSite,
  getValidVariables,
  makeTestSlug,
  seedSite,
  sitesE2EEnabled,
} from "./helpers";

test.describe("sites about — garantia anchor", () => {
  test.skip(
    !sitesE2EEnabled(),
    "TEST_SEED_TOKEN/TEST_SEED_USER_ID/Supabase real ausentes — pulando.",
  );

  let slug: string;

  test.beforeEach(async ({ request }) => {
    slug = makeTestSlug("e2e-about");
    await seedSite(request, {
      slug,
      status: "published",
      variables: getValidVariables(),
    });
  });

  test.afterEach(async ({ request }) => {
    if (slug) await cleanupSite(request, { slug });
  });

  test("deep-link /sobre#garantia posiciona a seção abaixo do header sticky", async ({
    page,
  }) => {
    const res = await page.goto(`/sites/${slug}/sobre#garantia`);
    expect(res?.status()).toBe(200);

    const warranty = page.getByTestId("about-warranty-deepdive");
    await expect(warranty).toBeVisible();

    const top = await warranty.evaluate(
      (el) => el.getBoundingClientRect().top,
    );
    expect(top).toBeGreaterThanOrEqual(75);
    expect(top).toBeLessThanOrEqual(85);
  });
});
