import { chromium } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";

const SLUG = "sjnh5crp-poliguara-car-multimarcas-vend";
const URL = `http://localhost:3000/sites/${SLUG}/contato`;
const OUT = path.join(process.cwd(), "tmp");
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const resp = await page.goto(URL, { waitUntil: "networkidle" });
  console.log("status:", resp?.status());
  await page.screenshot({ path: path.join(OUT, "poliguara-contato.png"), fullPage: false });
  await browser.close();
})();
