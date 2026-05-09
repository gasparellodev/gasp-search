/**
 * Abre o site da Poliguara num navegador VISÍVEL (não-headless).
 * Mantém a janela aberta até o user fechar manualmente.
 */
import { chromium } from "@playwright/test";

const SLUG = "sjnh5crp-poliguara-car-multimarcas-vend";
const URL = `http://localhost:3000/sites/${SLUG}`;

(async () => {
  const browser = await chromium.launch({
    headless: false,
    args: ["--start-maximized"],
  });
  const ctx = await browser.newContext({ viewport: null });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: "networkidle" });
  console.log("Browser aberto em:", URL);
  console.log("Navega manualmente entre /, /sobre, /contato, /anunciar, /estoque");
  console.log("Feche a janela quando terminar — o script encerra sozinho.");
  await page.waitForEvent("close", { timeout: 0 });
  await browser.close();
})();
