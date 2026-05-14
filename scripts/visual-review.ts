/**
 * scripts/visual-review.ts
 *
 * Visual + functional QA do site público após persistir `visual_identity`.
 * Captura screenshots desktop + mobile de todas as rotas, detecta
 * `<img>` broken, console errors/warnings, h1 count, e color token
 * resolution (`--site-primary`).
 *
 * Uso:
 *   npx tsx scripts/visual-review.ts <slug> [--base=http://localhost:3000]
 *
 * Output: pasta `tmp/visual-review/<slug>/` com screenshots + relatório JSON.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { chromium, type Browser, type ConsoleMessage } from "@playwright/test";

interface RoutePlan {
  slug: string; // route slug (used in filename)
  pathSuffix: string; // appended after /sites/<slug>
  label: string;
}

const ROUTES: RoutePlan[] = [
  { slug: "home", pathSuffix: "", label: "Home" },
  { slug: "sobre", pathSuffix: "/sobre", label: "Sobre" },
  { slug: "contato", pathSuffix: "/contato", label: "Contato" },
  { slug: "estoque", pathSuffix: "/estoque", label: "Estoque" },
  { slug: "anunciar", pathSuffix: "/anunciar", label: "Anunciar" },
];

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 } as const,
  mobile: { width: 390, height: 844 } as const,
};

interface RouteReport {
  route: string;
  url: string;
  status: number;
  loadMs: number;
  consoleErrors: string[];
  consoleWarnings: string[];
  brokenImages: Array<{ src: string; naturalWidth: number }>;
  imageCount: number;
  visualIdentityImageCount: number;
  hasGoogleMapsLogoVisible: boolean;
  hasPlaceholdInDom: boolean;
  h1Texts: string[];
  primaryColorVar: string | null;
  textOnPrimaryVar: string | null;
  desktopScreenshot: string;
  mobileScreenshot: string;
}

async function captureViewport(
  browser: Browser,
  url: string,
  viewport: { width: number; height: number },
  screenshotPath: string,
): Promise<{
  status: number;
  loadMs: number;
  consoleErrors: string[];
  consoleWarnings: string[];
  brokenImages: Array<{ src: string; naturalWidth: number }>;
  imageCount: number;
  visualIdentityImageCount: number;
  hasGoogleMapsLogoVisible: boolean;
  hasPlaceholdInDom: boolean;
  h1Texts: string[];
  primaryColorVar: string | null;
  textOnPrimaryVar: string | null;
}> {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  const consoleErrors: string[] = [];
  const consoleWarnings: string[] = [];
  page.on("console", (msg: ConsoleMessage) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
    if (msg.type() === "warning") consoleWarnings.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(`pageerror: ${err.message}`));

  const t0 = Date.now();
  const response = await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
  const loadMs = Date.now() - t0;
  const status = response?.status() ?? 0;

  const imgInfo = await page.$$eval("img", (imgs) =>
    imgs.map((img) => ({
      src: (img as HTMLImageElement).src,
      naturalWidth: (img as HTMLImageElement).naturalWidth,
      alt: (img as HTMLImageElement).alt,
    })),
  );
  // SVGs sem decoding completo retornam `naturalWidth=0` mesmo
  // renderizando ok — false positive em Playwright. Filtra pra evitar
  // ruído; quebra real continua sendo pega via fetch 404.
  const brokenImages = imgInfo
    .filter(
      (i) =>
        i.naturalWidth === 0 &&
        !/\.svg(\?|$)/i.test(i.src) &&
        !i.src.startsWith("data:image/svg"),
    )
    .map((i) => ({ src: i.src, naturalWidth: i.naturalWidth }));
  const imageCount = imgInfo.length;
  const visualIdentityImageCount = imgInfo.filter((i) =>
    i.src.includes("/visual-identity/"),
  ).length;

  // Inspect rendered styles. Look at the wrapping element with data-site-id
  // — that's where SitePage injects CSS vars.
  const tokens = await page.evaluate(() => {
    const root = document.querySelector("[data-site-id]");
    if (!root) return { primary: null, textOnPrimary: null };
    const cs = getComputedStyle(root);
    const primary = cs.getPropertyValue("--site-primary").trim();
    const text = cs.getPropertyValue("--site-text-on-primary").trim();
    return {
      primary: primary || null,
      textOnPrimary: text || null,
    };
  });

  // Check if a Google Maps photo is rendered as a visible <img> (i.e.
  // not just in JSON-LD).
  const hasGoogleMapsLogoVisible = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("img")).some((img) =>
      /googleusercontent\.com\/(p|gps-cs-s)/i.test(
        (img as HTMLImageElement).src,
      ),
    );
  });

  const hasPlaceholdInDom = await page.evaluate(() => {
    // Check both <img src> and inline-style background-image.
    if (
      Array.from(document.querySelectorAll("img")).some((img) =>
        /placehold\.co/i.test((img as HTMLImageElement).src),
      )
    ) {
      return true;
    }
    const all = document.querySelectorAll("*");
    for (const el of all) {
      const style = (el as HTMLElement).getAttribute("style");
      if (style && /placehold\.co/i.test(style)) return true;
    }
    return false;
  });

  const h1Texts = await page.$$eval("h1", (els) =>
    els.map((e) => (e as HTMLElement).innerText.trim()),
  );

  await page.screenshot({ path: screenshotPath, fullPage: true });
  await ctx.close();

  return {
    status,
    loadMs,
    consoleErrors,
    consoleWarnings,
    brokenImages,
    imageCount,
    visualIdentityImageCount,
    hasGoogleMapsLogoVisible,
    hasPlaceholdInDom,
    h1Texts,
    primaryColorVar: tokens.primary,
    textOnPrimaryVar: tokens.textOnPrimary,
  };
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const slug = argv.find((a) => !a.startsWith("--"));
  const baseArg = argv.find((a) => a.startsWith("--base="));
  const base = (baseArg?.slice("--base=".length) ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );

  if (!slug) {
    console.error("Usage: npx tsx scripts/visual-review.ts <slug> [--base=URL]");
    process.exit(1);
  }

  const outDir = path.resolve(process.cwd(), "tmp/visual-review", slug);
  await mkdir(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const reports: RouteReport[] = [];

  for (const route of ROUTES) {
    const url = `${base}/sites/${slug}${route.pathSuffix}`;
    const desktopPath = path.join(outDir, `${route.slug}-desktop.png`);
    const mobilePath = path.join(outDir, `${route.slug}-mobile.png`);

    const desktop = await captureViewport(
      browser,
      url,
      VIEWPORTS.desktop,
      desktopPath,
    );
    const mobile = await captureViewport(
      browser,
      url,
      VIEWPORTS.mobile,
      mobilePath,
    );

    reports.push({
      route: route.label,
      url,
      status: desktop.status,
      loadMs: desktop.loadMs,
      consoleErrors: desktop.consoleErrors,
      consoleWarnings: desktop.consoleWarnings,
      brokenImages: desktop.brokenImages,
      imageCount: desktop.imageCount,
      visualIdentityImageCount: desktop.visualIdentityImageCount,
      hasGoogleMapsLogoVisible: desktop.hasGoogleMapsLogoVisible,
      hasPlaceholdInDom: desktop.hasPlaceholdInDom,
      h1Texts: desktop.h1Texts,
      primaryColorVar: desktop.primaryColorVar,
      textOnPrimaryVar: desktop.textOnPrimaryVar,
      desktopScreenshot: desktopPath,
      mobileScreenshot: mobilePath,
    });

    console.log(
      `[${desktop.status}] ${route.label.padEnd(10)} ` +
        `imgs=${desktop.imageCount} ` +
        `vi=${desktop.visualIdentityImageCount} ` +
        `broken=${desktop.brokenImages.length} ` +
        `err=${desktop.consoleErrors.length} ` +
        `warn=${desktop.consoleWarnings.length} ` +
        `gmaps-img=${desktop.hasGoogleMapsLogoVisible} ` +
        `placehold=${desktop.hasPlaceholdInDom} ` +
        `(load ${desktop.loadMs}ms / mobile load ${mobile.loadMs}ms)`,
    );
  }

  await browser.close();

  await writeFile(
    path.join(outDir, "report.json"),
    JSON.stringify(reports, null, 2),
    "utf-8",
  );

  console.log(`\nReport: ${path.join(outDir, "report.json")}`);
  console.log(`Screenshots: ${outDir}/*.png`);

  // Compact summary table.
  console.log("\n=== Summary ===");
  console.table(
    reports.map((r) => ({
      route: r.route,
      status: r.status,
      imgs: r.imageCount,
      visual_identity_imgs: r.visualIdentityImageCount,
      broken: r.brokenImages.length,
      errors: r.consoleErrors.length,
      warnings: r.consoleWarnings.length,
      gmaps_img_visible: r.hasGoogleMapsLogoVisible,
      placehold_in_dom: r.hasPlaceholdInDom,
      h1_count: r.h1Texts.length,
      primary: r.primaryColorVar ?? "?",
    })),
  );
}

main().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
