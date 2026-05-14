/**
 * scripts/validate-ducarmo.ts
 *
 * Headless Playwright smoke test do site Ducarmo após persistir o
 * `visual_identity` manifest. Confere:
 *   - Hero / sobre / contato renderizam dos URLs do Supabase Storage
 *     (`visual-identity/4t3xswas-ducarmo-veiculos/*`).
 *   - Console limpo (sem errors/warnings).
 *   - Sem `placehold.co` no DOM (Codex fix funcionando).
 *   - Sem foto do Google Maps no header/footer (Codex fix funcionando).
 */
import { chromium, type ConsoleMessage } from "@playwright/test";

const SLUG = "4t3xswas-ducarmo-veiculos";
const BASE = `http://localhost:3000/sites/${SLUG}`;
const EXPECTED_STORAGE_PREFIX = `visual-identity/${SLUG}/`;

interface PageReport {
  url: string;
  status: number;
  consoleErrors: string[];
  consoleWarnings: string[];
  hasPlaceholdCo: boolean;
  hasGoogleMapsLogo: boolean;
  visualIdentityImageCount: number;
  firstHeroBg: string | null;
}

async function inspectPage(
  browser: import("@playwright/test").Browser,
  url: string,
): Promise<PageReport> {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const consoleErrors: string[] = [];
  const consoleWarnings: string[] = [];
  page.on("console", (msg: ConsoleMessage) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
    if (msg.type() === "warning") consoleWarnings.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(`pageerror: ${err.message}`));

  const response = await page.goto(url, { waitUntil: "networkidle" });
  const status = response?.status() ?? 0;

  const html = await page.content();
  const hasPlaceholdCo = /placehold\.co/i.test(html);
  const hasGoogleMapsLogo = /googleusercontent\.com\/(p|gps-cs-s)/i.test(html);

  const imgSrcs = await page.$$eval("img", (imgs) =>
    imgs.map((img) => (img as HTMLImageElement).src),
  );
  const visualIdentityImageCount = imgSrcs.filter((s) =>
    s.includes(EXPECTED_STORAGE_PREFIX),
  ).length;

  // Hero background can be on <img>, <picture>, <section style="background-image:...">, etc.
  // Grab the first element with a visual-identity URL in inline style or src.
  const firstHeroBg = await page.evaluate((prefix: string) => {
    const all = document.querySelectorAll("*");
    for (const el of all) {
      const style = (el as HTMLElement).getAttribute("style");
      if (style?.includes(prefix)) return style;
      const img = el as HTMLImageElement;
      if (img.tagName === "IMG" && img.src?.includes(prefix)) return img.src;
    }
    return null;
  }, EXPECTED_STORAGE_PREFIX);

  await ctx.close();

  return {
    url,
    status,
    consoleErrors,
    consoleWarnings,
    hasPlaceholdCo,
    hasGoogleMapsLogo,
    visualIdentityImageCount,
    firstHeroBg,
  };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const targets = [`${BASE}`, `${BASE}/sobre`, `${BASE}/contato`];

  for (const url of targets) {
    const report = await inspectPage(browser, url);
    console.log(`\n=== ${url} ===`);
    console.table([
      {
        status: report.status,
        vi_image_count: report.visualIdentityImageCount,
        has_placehold_co: report.hasPlaceholdCo,
        has_maps_logo: report.hasGoogleMapsLogo,
        console_errors: report.consoleErrors.length,
        console_warnings: report.consoleWarnings.length,
      },
    ]);
    if (report.firstHeroBg) {
      console.log(`  first VI asset found: ${report.firstHeroBg.slice(0, 140)}`);
    } else {
      console.log("  [!] no visual-identity asset detected on this page");
    }
    if (report.consoleErrors.length > 0) {
      console.log("  console errors:");
      report.consoleErrors.forEach((e) => console.log(`    - ${e}`));
    }
    if (report.consoleWarnings.length > 0) {
      console.log("  console warnings:");
      report.consoleWarnings.slice(0, 5).forEach((w) =>
        console.log(`    - ${w.slice(0, 200)}`),
      );
    }
  }

  await browser.close();
})();
