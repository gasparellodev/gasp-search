/**
 * Mede proporções e cores reais do site renderizado — pra parar de chutar.
 */
import { chromium } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";

const SLUG = "sjnh5crp-poliguara-car-multimarcas-vend";
const URL = `http://localhost:3000/sites/${SLUG}`;
const OUT = path.join(process.cwd(), "tmp");
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: "networkidle" });

  const measureScript = `(() => {
    const header = document.querySelector("[data-testid=site-header]");
    const logo = header && header.querySelector("img");
    const hero = document.querySelector("[data-testid=home-hero]");
    const h1 = hero && hero.querySelector("h1");
    const cta = document.querySelector("[data-testid=home-hero-cta]");
    const body = document.body;
    const getStyle = (el, prop) => el ? getComputedStyle(el).getPropertyValue(prop) : "(missing)";
    const rect = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; };
    return {
      bodyBgColor: getStyle(body, "background-color"),
      headerHeight: rect(header) ? rect(header).h : null,
      logoBox: rect(logo),
      logoNatural: logo ? { w: logo.naturalWidth, h: logo.naturalHeight } : null,
      logoRatioOfHeader: header && logo ? Math.round((rect(logo).h / rect(header).h) * 100) + "%" : null,
      heroBgColor: getStyle(hero, "background-color"),
      h1Color: getStyle(h1, "color"),
      h1FontSize: getStyle(h1, "font-size"),
      ctaBgColor: getStyle(cta, "background-color"),
      ctaTextColor: getStyle(cta, "color"),
      ctaSize: rect(cta),
    };
  })()`;
  const measurements = await page.evaluate(measureScript);

  console.log("=== Poliguara medições reais ===");
  console.log(JSON.stringify(measurements, null, 2));

  await page.screenshot({
    path: path.join(OUT, "poliguara-header-only.png"),
    clip: { x: 0, y: 0, width: 1440, height: 100 },
  });
  await browser.close();
})();
