/**
 * Validador visual do site público da Poliguara contra o Figma.
 *
 * Uso (com dev server rodando em :3000):
 *   npx tsx scripts/validate-poliguara.ts
 *
 * Output:
 *   - tmp/poliguara-desktop.png (1440x900)
 *   - tmp/poliguara-mobile.png  (390x844)
 *   - Console: assertions sobre o hero (cor, logo, slogan, cutout, CTA)
 */
import { chromium } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";

const SLUG = "sjnh5crp-poliguara-car-multimarcas-vend";
const URL = `http://localhost:3000/sites/${SLUG}`;
const OUT = path.join(process.cwd(), "tmp");
fs.mkdirSync(OUT, { recursive: true });

async function snap(viewport: { width: number; height: number }, file: string) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`PAGE ERROR: ${e.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`CONSOLE ERROR: ${msg.text()}`);
  });

  const resp = await page.goto(URL, { waitUntil: "networkidle", timeout: 30_000 });
  if (!resp || !resp.ok()) {
    console.error(`HTTP ${resp?.status() ?? "??"} from ${URL}`);
    process.exit(1);
  }
  await page.waitForSelector("[data-testid=home-hero]");

  const checks: Record<string, unknown> = {};
  const hero = page.locator("[data-testid=home-hero]");
  const cta = page.locator("[data-testid=home-hero-cta]");
  const heroImg = page.locator("[data-testid=home-hero] img").first();
  const logoImg = page.locator("[data-testid=site-header] a[aria-label] img").first();
  const logoText = page.locator("[data-testid=site-header-logo-text]");

  checks.heroBgClass = await hero.getAttribute("class");
  checks.heroBgImage = await hero.evaluate((el) => getComputedStyle(el).backgroundImage);
  checks.heroBgColor = await hero.evaluate((el) => getComputedStyle(el).backgroundColor);
  checks.ctaBgColor = await cta.evaluate((el) => getComputedStyle(el).backgroundColor);
  checks.ctaText = (await cta.textContent())?.trim();
  checks.heroImgSrc = await heroImg.getAttribute("src");
  checks.h1Text = await page.locator("[data-testid=home-hero] h1").textContent();
  if ((await logoImg.count()) > 0) {
    checks.headerLogoSrc = await logoImg.getAttribute("src");
  } else if ((await logoText.count()) > 0) {
    checks.headerLogoText = await logoText.textContent();
  }

  await page.screenshot({ path: path.join(OUT, file), fullPage: true });
  // Viewport-only screenshot pra ver header + hero em tamanho real
  await page.screenshot({
    path: path.join(OUT, file.replace(".png", "-viewport.png")),
    fullPage: false,
  });
  await browser.close();

  console.log(`\n=== ${file} ===`);
  console.log(JSON.stringify(checks, null, 2));
  if (errors.length) {
    console.log("\nErrors:");
    errors.forEach((e) => console.log(" -", e));
  }
}

(async () => {
  await snap({ width: 1440, height: 900 }, "poliguara-desktop.png");
  await snap({ width: 390, height: 844 }, "poliguara-mobile.png");
  console.log("\nScreenshots saved to tmp/");
})();
