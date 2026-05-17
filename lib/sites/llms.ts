/**
 * `renderLlmsTxt(variables, slug)` — render puro Markdown do
 * `llms.txt` consumido por AI crawlers (GPTBot, ClaudeBot,
 * PerplexityBot, Gemini etc.).
 *
 * Fonte canônica: `docs/SEO-PLAN.md` §Sprint 1 #S4 + AC refinado do
 * PO em issue #214. Refatorado em v2 (issue #G1 / Frente 04 GEO/AI):
 * seções estruturadas para passage-citability.
 *
 * **Decisões PO refinement (#214):**
 *
 * 1. **Função pura.** Sem I/O — recebe `variables` (já validado por
 *    Zod upstream via `readSiteVariables`) + `slug` + lê apenas
 *    `env.NEXT_PUBLIC_APP_URL` pra montar links absolutos.
 * 2. **Frase factual SEM "loja online".** Risco de AI gerar
 *    expectativa de compra online; usamos "loja de carros seminovos"
 *    consistentemente.
 * 3. **Hedging "Consulte estoque atualizado" SÓ no rodapé.**
 *    Manter o conteúdo principal factual; hedging encerra com pointer
 *    pro estoque pra evitar AI Overviews citando preço stale.
 * 4. **Address `null` → `"no Brasil"`** (não omitir frase inteira).
 *    PO quer sempre emitir contexto base.
 * 5. **Linhas condicionais (phone/email/address) `null` → OMITIDAS**,
 *    não emitir `Email: undefined` nem linha vazia.
 * 6. **Sem PII de leads.** Só dados públicos do negócio
 *    (business_name, phone comercial, address da loja).
 * 7. **Sem BOM UTF-8** (`﻿`) — alguns parsers AI rejeitam ou
 *    interpretam como caractere visível.
 * 8. **Estoque snapshot limitado a 6 cars** no `llms.txt` — payload
 *    curto para AI ingestion. `renderLlmsFullTxt` expande para 20.
 *
 * **v2 sections (issue #G1):**
 *   # business_name
 *   > slogan/fallback
 *   ## Localização
 *   ## Especialidades  (marcas, tipo, faixa de preço)
 *   ## Inventário atual  (N veículos + link + snapshot 6 cars)
 *   ## Garantias  (3 bullets fixos — posicionamento GaspLab)
 *   ## FAQ  (FAQ_TEMPLATE canônico — 8 Q&As)
 *   ## Contato  (phone/whatsapp/email/horários)
 *   ## Para estoque atualizado (hedging rodapé)
 *
 * **Server-only** porque consome `env` (server-only), mesmo sendo
 * puro. Importadores: `app/sites/[slug]/llms.txt/route.ts`.
 *
 * **Cache:** o route handler usa `cacheTag('site:<slug>')` (reuso —
 * mesmo tag invalidado nos 5 callsites de `app/actions/lead-site.ts`).
 * Helper não toca cache — pure.
 */
import "server-only";

import { env } from "@/lib/env";
import { formatBRL } from "@/lib/finance";
import { FAQ_TEMPLATE } from "@/lib/sites/faq-template";
import type { Address, SiteCar, SiteVariablesV2 } from "@/types/lead-site";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Máximo de cars listados no snapshot do `llms.txt`. O schema público aceita
 * estoque maior desde #225; o llms.txt corta aqui para manter payload AI-friendly.
 */
export const MAX_CARS_LISTED = 6;

/**
 * Máximo de cars listados no `llms-full.txt`.
 */
export const MAX_CARS_LISTED_FULL = 20;

/**
 * Limite de chars do output `llms-full.txt` (~8k tokens). Quando ultrapassado,
 * a lista de carros é truncada e um aviso é adicionado.
 */
export const LLMS_FULL_MAX_CHARS = 32_000;

/**
 * Fallback de business_name quando vier vazio (defensivo — schema valida
 * `min(1)` mas helper não confia em invariantes upstream).
 */
const BUSINESS_NAME_FALLBACK = "Loja de carros seminovos";

/**
 * Tipo de negócio fixo — posicionamento GaspLab.
 */
const BUSINESS_TYPE_FIXED = "Seminovos premium";

/**
 * Bullets fixos de garantias — posicionamento GaspLab (issue #G1).
 */
const GARANTIAS_BULLETS = [
  "Vistoria técnica em todos os veículos",
  "Garantia de motor e câmbio",
  "Documentação verificada",
] as const;

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface RenderLlmsTxtInput {
  /** Shape v2 validado upstream via `readSiteVariables`. */
  variables: SiteVariablesV2;
  /** Slug global único de `lead_sites.slug` — usado nos links absolutos. */
  slug: string;
}

// ---------------------------------------------------------------------------
// renderLlmsTxt — v2 (issue #G1)
// ---------------------------------------------------------------------------

/**
 * Retorna Markdown plain (UTF-8 sem BOM) pro endpoint `llms.txt`.
 *
 * **Não levanta** — campos null/empty caem em fallbacks documentados
 * acima. Output é determinístico dado o mesmo input.
 */
export function renderLlmsTxt({ variables, slug }: RenderLlmsTxtInput): string {
  const baseUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const siteUrl = `${baseUrl}/sites/${slug}`;
  const businessName = resolveBusinessName(variables.business_name);

  const lines: string[] = [];

  // --- Header ---
  buildHeader(lines, businessName, variables);

  // --- Localização ---
  buildLocalizacao(lines, variables.address);

  // --- Especialidades ---
  buildEspecialidades(lines, variables.cars);

  // --- Inventário ---
  buildInventario(lines, variables.cars, siteUrl, MAX_CARS_LISTED);

  // --- Garantias ---
  buildGarantias(lines);

  // --- FAQ ---
  buildFaq(lines);

  // --- Contato ---
  buildContato(lines, variables, siteUrl);

  // --- Hedging rodapé ---
  buildRodape(lines, siteUrl);

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// renderLlmsFullTxt — v2 full (issue #G2)
// ---------------------------------------------------------------------------

/**
 * Retorna Markdown plain (UTF-8 sem BOM) pro endpoint `llms-full.txt`.
 *
 * Cabeçalho idêntico ao `llms.txt`. Expande inventário para até 20 carros
 * e inclui FAQ completo. Trunca lista de carros se output ultrapassar
 * `LLMS_FULL_MAX_CHARS`.
 *
 * **Não levanta** — mesmos fallbacks do `renderLlmsTxt`.
 */
export function renderLlmsFullTxt({
  variables,
  slug,
}: RenderLlmsTxtInput): string {
  const baseUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const siteUrl = `${baseUrl}/sites/${slug}`;
  const businessName = resolveBusinessName(variables.business_name);

  const lines: string[] = [];

  // --- Header ---
  buildHeader(lines, businessName, variables);

  // --- Localização ---
  buildLocalizacao(lines, variables.address);

  // --- Texto Home / Sobre completo ---
  buildSobreCompleto(lines, businessName, variables);

  // --- Especialidades ---
  buildEspecialidades(lines, variables.cars);

  // --- Inventário (até 20 cars, com truncation se necessário) ---
  buildInventarioFull(lines, variables.cars, siteUrl);

  // --- Garantias ---
  buildGarantias(lines);

  // --- FAQ completo ---
  buildFaq(lines);

  // --- Contato ---
  buildContato(lines, variables, siteUrl);

  // --- Hedging rodapé ---
  buildRodape(lines, siteUrl);

  // Truncation: se output > LLMS_FULL_MAX_CHARS, rebuild com lista menor
  const output = lines.join("\n");
  if (output.length <= LLMS_FULL_MAX_CHARS) {
    return output;
  }

  return truncateFullOutput({ variables, slug, businessName, siteUrl });
}

// ---------------------------------------------------------------------------
// Section builders (pure, shared between llms.txt and llms-full.txt)
// ---------------------------------------------------------------------------

function buildHeader(
  lines: string[],
  businessName: string,
  variables: SiteVariablesV2,
): void {
  lines.push(`# ${businessName}`);
  lines.push("");
  lines.push(`> ${buildSloganLine(variables.slogan, variables.address)}`);
  lines.push("");
}

function buildLocalizacao(lines: string[], address: Address | null): void {
  lines.push("## Localização");
  lines.push("");
  if (address !== null) {
    lines.push(
      `${address.street}, ${address.city} - ${address.state}, ${address.zip}`,
    );
  } else {
    lines.push("no Brasil");
  }
  lines.push("");
}

function buildEspecialidades(lines: string[], cars: SiteCar[]): void {
  lines.push("## Especialidades");
  lines.push("");

  // Marcas únicas (ordem de aparição)
  const brands = extractUniqueBrands(cars);
  const brandsStr =
    brands.length > 0 ? brands.join(", ") : "Diversas marcas";
  lines.push(`- Marcas: ${brandsStr}`);
  lines.push(`- Tipo: ${BUSINESS_TYPE_FIXED}`);

  const priceRange = computePriceRange(cars);
  if (priceRange !== null) {
    lines.push(`- Faixa de preço: R$ ${priceRange.min} a R$ ${priceRange.max}`);
  }

  lines.push("");
}

function buildInventario(
  lines: string[],
  cars: SiteCar[],
  siteUrl: string,
  maxCars: number,
): void {
  lines.push("## Inventário atual");
  lines.push("");
  lines.push(
    `${cars.length} veículos disponíveis. Veja em ${siteUrl}/estoque`,
  );
  lines.push("");

  if (cars.length === 0) {
    lines.push("Estoque sendo atualizado.");
  } else {
    const listed = cars.slice(0, maxCars);
    for (const car of listed) {
      lines.push(buildCarBullet(car, siteUrl));
    }
  }
  lines.push("");
}

function buildInventarioFull(
  lines: string[],
  cars: SiteCar[],
  siteUrl: string,
): void {
  // Full version: up to MAX_CARS_LISTED_FULL; truncation handled by caller
  buildInventario(lines, cars, siteUrl, MAX_CARS_LISTED_FULL);
}

function buildGarantias(lines: string[]): void {
  lines.push("## Garantias");
  lines.push("");
  for (const bullet of GARANTIAS_BULLETS) {
    lines.push(`- ${bullet}`);
  }
  lines.push("");
}

function buildFaq(lines: string[]): void {
  lines.push("## FAQ");
  lines.push("");
  for (const entry of FAQ_TEMPLATE) {
    lines.push(`### ${entry.question}`);
    lines.push(entry.answer);
    lines.push("");
  }
}

function buildSobreCompleto(
  lines: string[],
  businessName: string,
  variables: SiteVariablesV2,
): void {
  lines.push("## Sobre");
  lines.push("");
  lines.push(buildAboutSentence(businessName, variables.address));
  lines.push("");
  if (
    typeof variables.about_text === "string" &&
    variables.about_text.trim().length >= 40
  ) {
    lines.push(variables.about_text.trim());
    lines.push("");
  }
  // Key value props (mission / vision)
  if (
    typeof variables.mission === "string" &&
    variables.mission.trim().length > 0
  ) {
    lines.push(`**Missão:** ${variables.mission.trim()}`);
    lines.push("");
  }
  if (
    typeof variables.vision === "string" &&
    variables.vision.trim().length > 0
  ) {
    lines.push(`**Visão:** ${variables.vision.trim()}`);
    lines.push("");
  }
}

function buildContato(
  lines: string[],
  variables: SiteVariablesV2,
  siteUrl: string,
): void {
  lines.push("## Contato");
  lines.push("");

  if (variables.phone_display && variables.phone_display.length > 0) {
    lines.push(`- Telefone: ${variables.phone_display}`);
  }
  if (variables.whatsapp && variables.whatsapp.length > 0) {
    lines.push(`- WhatsApp: ${variables.whatsapp}`);
  }
  if (variables.email !== null && variables.email.length > 0) {
    lines.push(`- Email: ${variables.email}`);
  }
  const addressLine = buildAddressLine(variables.address);
  if (addressLine !== null) {
    lines.push(addressLine);
  }
  if (variables.hours !== null && variables.hours.length > 0) {
    lines.push(`- Atendimento: ${variables.hours}`);
  }
  lines.push(`- Site: ${siteUrl}/`);
  lines.push("");
}

function buildRodape(lines: string[], siteUrl: string): void {
  lines.push("## Para estoque atualizado em tempo real");
  lines.push("");
  lines.push(`Consulte: ${siteUrl}/estoque`);
  lines.push("");
}

// ---------------------------------------------------------------------------
// Truncation helper for llms-full.txt
// ---------------------------------------------------------------------------

interface TruncateInput {
  variables: SiteVariablesV2;
  slug: string;
  businessName: string;
  siteUrl: string;
}

/**
 * Rebuilds `llms-full.txt` with progressively fewer cars until output fits
 * within LLMS_FULL_MAX_CHARS, or until no cars remain (in which case we keep
 * the "Estoque sendo atualizado" path and add the truncation notice).
 */
function truncateFullOutput({
  variables,
  businessName,
  siteUrl,
}: TruncateInput): string {
  // Binary search: try decreasing car counts until we fit.
  for (let carCount = MAX_CARS_LISTED_FULL - 1; carCount >= 0; carCount--) {
    const lines: string[] = [];
    buildHeader(lines, businessName, variables);
    buildLocalizacao(lines, variables.address);
    buildSobreCompleto(lines, businessName, variables);
    buildEspecialidades(lines, variables.cars);

    // Inventário com carCount cars
    lines.push("## Inventário atual");
    lines.push("");
    lines.push(
      `${variables.cars.length} veículos disponíveis. Veja em ${siteUrl}/estoque`,
    );
    lines.push("");
    if (carCount === 0) {
      lines.push(
        "<lista parcial; veja sitemap.xml para completa>",
      );
    } else {
      const listed = variables.cars.slice(0, carCount);
      for (const car of listed) {
        lines.push(buildCarBullet(car, siteUrl));
      }
      lines.push("<lista parcial; veja sitemap.xml para completa>");
    }
    lines.push("");

    buildGarantias(lines);
    buildFaq(lines);
    buildContato(lines, variables, siteUrl);
    buildRodape(lines, siteUrl);

    const candidate = lines.join("\n");
    if (candidate.length <= LLMS_FULL_MAX_CHARS) {
      return candidate;
    }
  }

  // Fallback: return with 0 cars + truncation notice (guaranteed smallest)
  const lines: string[] = [];
  buildHeader(lines, businessName, variables);
  buildLocalizacao(lines, variables.address);
  buildSobreCompleto(lines, businessName, variables);
  buildEspecialidades(lines, variables.cars);
  lines.push("## Inventário atual");
  lines.push("");
  lines.push(
    `${variables.cars.length} veículos disponíveis. Veja em ${siteUrl}/estoque`,
  );
  lines.push("");
  lines.push("<lista parcial; veja sitemap.xml para completa>");
  lines.push("");
  buildGarantias(lines);
  buildFaq(lines);
  buildContato(lines, variables, siteUrl);
  buildRodape(lines, siteUrl);
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Helpers internos — todos puros, sem I/O
// ---------------------------------------------------------------------------

function resolveBusinessName(raw: string): string {
  return raw.trim().length > 0 ? raw : BUSINESS_NAME_FALLBACK;
}

/**
 * Slogan ou fallback factual. Quando ausente:
 *  - Address presente → `"Loja de carros seminovos em {city}/{state}"`
 *  - Address null → `"Loja de carros seminovos"`
 */
function buildSloganLine(
  slogan: string | undefined,
  address: Address | null,
): string {
  if (typeof slogan === "string" && slogan.trim().length > 0) {
    return slogan.trim();
  }
  if (address !== null) {
    return `Loja de carros seminovos em ${address.city}/${address.state}`;
  }
  return "Loja de carros seminovos";
}

/**
 * Frase de abertura da seção "Sobre". Padrão:
 *   `{name} é uma loja de carros seminovos {locale}.`
 */
function buildAboutSentence(
  businessName: string,
  address: Address | null,
): string {
  const locale =
    address === null
      ? "no Brasil"
      : `localizada em ${address.city}, ${address.state}`;
  return `${businessName} é uma loja de carros seminovos ${locale}.`;
}

/**
 * Bullet markdown de um car no snapshot. Inclui:
 *   - `**brand model year**`
 *   - Preço BRL (ou `Sob consulta` se null)
 *   - km formatado
 *   - fuel
 *   - transmission
 *   - link absoluto para `/estoque/{slug}`
 */
function buildCarBullet(car: SiteCar, siteUrl: string): string {
  const heading = `**${car.brand} ${car.model} ${car.year}**`;
  const pricePart =
    car.price === null
      ? "Sob consulta"
      : `R$ ${formatBRL(car.price).replace(/^R\$\s?/, "")}`;
  const parts = [
    pricePart,
    `${formatKm(car.km)} km`,
    car.fuel,
    car.transmission,
  ];
  return `- ${heading} — ${parts.join(", ")}. Detalhes: ${siteUrl}/estoque/${car.slug}`;
}

/**
 * Linha de endereço pro contato. `null` quando address ausente.
 */
function buildAddressLine(address: Address | null): string | null {
  if (address === null) return null;
  return `- Endereço: ${address.street} ${address.number}, ${address.neighborhood}, ${address.city}/${address.state}`;
}

/**
 * km formatado em pt-BR (separador de milhar com ponto).
 */
function formatKm(km: number): string {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(
    km,
  );
}

/**
 * Extrai marcas únicas preservando ordem de aparição.
 */
function extractUniqueBrands(cars: SiteCar[]): string[] {
  const seen = new Set<string>();
  const brands: string[] = [];
  for (const car of cars) {
    if (!seen.has(car.brand)) {
      seen.add(car.brand);
      brands.push(car.brand);
    }
  }
  return brands;
}

interface PriceRange {
  min: string;
  max: string;
}

/**
 * Computa faixa de preço formatada em BRL. Retorna `null` quando não há
 * carros com preço (todos `null`).
 */
function computePriceRange(cars: SiteCar[]): PriceRange | null {
  const prices = cars
    .map((c) => c.price)
    .filter((p): p is number => p !== null);
  if (prices.length === 0) return null;

  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);

  const fmt = (v: number) =>
    formatBRL(v).replace(/^R\$\s?/, "");

  return { min: fmt(minPrice), max: fmt(maxPrice) };
}
