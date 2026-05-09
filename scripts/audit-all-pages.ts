import { chromium } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";

const SLUG = "sjnh5crp-poliguara-car-multimarcas-vend";
const BASE = `http://localhost:3000/sites/${SLUG}`;
const OUT = path.join(process.cwd(), "tmp/audit");
fs.mkdirSync(OUT, { recursive: true });

const PAGES = [
  { route: "", label: "home" },
  { route: "/sobre", label: "sobre" },
  { route: "/contato", label: "contato" },
  { route: "/anunciar", label: "anunciar" },
  { route: "/estoque", label: "estoque" },
];

const measureScript = `(() => {
  const body = document.body;
  const get = (el, prop) => el ? getComputedStyle(el).getPropertyValue(prop) : "(missing)";
  // Find any visible dark backgrounds in the page
  const all = Array.from(document.querySelectorAll("*"));
  const dark = [];
  for (const el of all) {
    const cs = getComputedStyle(el);
    const bg = cs.backgroundColor;
    if (!bg) continue;
    const m = bg.match(/^rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/);
    if (!m) continue;
    const r = +m[1], g = +m[2], b = +m[3];
    const brightness = (r + g + b) / 3;
    if (brightness < 100 && el.offsetWidth > 100 && el.offsetHeight > 100) {
      dark.push({
        tag: el.tagName,
        id: el.id || null,
        cls: el.className.toString().slice(0, 80),
        bg,
        size: el.offsetWidth + "x" + el.offsetHeight,
      });
    }
    if (dark.length >= 6) break;
  }
  return {
    bodyBg: get(body, "background-color"),
    htmlBg: get(document.documentElement, "background-color"),
    darkBlocks: dark,
  };
})()`;

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  for (const p of PAGES) {
    const url = BASE + p.route;
    const resp = await page.goto(url, { waitUntil: "networkidle" });
    const status = resp?.status();
    const m = (await page.evaluate(measureScript)) as {
      bodyBg: string;
      htmlBg: string;
      darkBlocks: Array<{ tag: string; cls: string; bg: string; size: string }>;
    };
    console.log(`\n=== /${p.label} (HTTP ${status}) ===`);
    console.log(`bodyBg: ${m.bodyBg}`);
    console.log(`htmlBg: ${m.htmlBg}`);
    if (m.darkBlocks.length > 0) {
      console.log(`DARK BLOCKS (${m.darkBlocks.length}):`);
      m.darkBlocks.forEach((d) => console.log(`  ${d.tag}.${d.cls} bg=${d.bg} size=${d.size}`));
    } else {
      console.log("(no large dark blocks)");
    }
    await page.screenshot({
      path: path.join(OUT, `${p.label}.png`),
      fullPage: false,
    });
    await page.screenshot({
      path: path.join(OUT, `${p.label}-full.png`),
      fullPage: true,
    });
  }
  await browser.close();
})();
