/**
 * `renderLlmsTxt(variables, slug)` — render puro Markdown do
 * `llms.txt` consumido por AI crawlers (GPTBot, ClaudeBot,
 * PerplexityBot, Gemini etc.).
 *
 * Fonte canônica: `docs/SEO-PLAN.md` §Sprint 1 #S4 + AC refinado do
 * PO em issue #214.
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
 * 8. **Estoque snapshot limitado a 6 cars** — alinha com max do schema
 *    e mantém payload curto para AI ingestion.
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
import type { Address, SiteCar, SiteVariablesV2 } from "@/types/lead-site";

/**
 * Máximo de cars listados no snapshot (alinha com `cars.max(6)` do
 * schema). Defensivo: mesmo se um payload futuro permitir mais, o
 * llms.txt corta aqui para manter payload AI-friendly.
 */
const MAX_CARS_LISTED = 6;

/**
 * Fallback de business_name quando vier vazio (defensivo — schema valida
 * `min(1)` mas helper não confia em invariantes upstream).
 */
const BUSINESS_NAME_FALLBACK = "Loja de carros seminovos";

export interface RenderLlmsTxtInput {
  /** Shape v2 validado upstream via `readSiteVariables`. */
  variables: SiteVariablesV2;
  /** Slug global único de `lead_sites.slug` — usado nos links absolutos. */
  slug: string;
}

/**
 * Retorna Markdown plain (UTF-8 sem BOM) pro endpoint `llms.txt`.
 *
 * **Não levanta** — campos null/empty caem em fallbacks documentados
 * acima. Output é determinístico dado o mesmo input.
 */
export function renderLlmsTxt({ variables, slug }: RenderLlmsTxtInput): string {
  const baseUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const siteUrl = `${baseUrl}/sites/${slug}`;
  const businessName =
    variables.business_name.trim().length > 0
      ? variables.business_name
      : BUSINESS_NAME_FALLBACK;

  const lines: string[] = [];

  // ---------------------------------------------------------------------
  // Header + slogan
  // ---------------------------------------------------------------------
  lines.push(`# ${businessName}`);
  lines.push("");
  lines.push(`> ${buildSloganLine(variables.slogan, variables.address)}`);
  lines.push("");

  // ---------------------------------------------------------------------
  // Sobre
  // ---------------------------------------------------------------------
  lines.push("## Sobre");
  lines.push("");
  lines.push(buildAboutSentence(businessName, variables.address));
  const aboutDetail = buildAboutDetail(variables.about_text);
  if (aboutDetail !== null) {
    lines.push(aboutDetail);
  }
  lines.push("");

  // ---------------------------------------------------------------------
  // Estoque (snapshot)
  // ---------------------------------------------------------------------
  lines.push("## Estoque (snapshot)");
  lines.push("");

  if (variables.cars.length === 0) {
    lines.push("Estoque sendo atualizado.");
  } else {
    const listed = variables.cars.slice(0, MAX_CARS_LISTED);
    for (const car of listed) {
      lines.push(buildCarBullet(car, siteUrl));
    }
  }
  lines.push("");

  // ---------------------------------------------------------------------
  // Contato
  // ---------------------------------------------------------------------
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
  lines.push(`- Site: ${siteUrl}/`);
  lines.push("");

  // ---------------------------------------------------------------------
  // Hedging rodapé — pointer pro estoque atualizado
  // ---------------------------------------------------------------------
  lines.push("## Para estoque atualizado em tempo real");
  lines.push("");
  lines.push(`Consulte: ${siteUrl}/estoque`);
  lines.push("");

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Helpers internos — todos puros, sem I/O
// ---------------------------------------------------------------------------

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
 *
 * `locale` = `"localizada em {city}, {state}"` quando address presente,
 * `"no Brasil"` quando null.
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
 * Linha de detalhe complementar — usa `about_text` se >= 40 chars (mesmo
 * threshold de description em `metadata.ts:DESCRIPTION_MIN_LENGTH`).
 * Senão, fallback operacional fixo.
 *
 * Retorna `null` quando about_text é vazio E queremos só a frase base —
 * mas no MVP sempre emite (fallback sempre disponível).
 */
function buildAboutDetail(aboutText: string | undefined): string | null {
  if (typeof aboutText === "string" && aboutText.trim().length >= 40) {
    return aboutText.trim();
  }
  // Fallback operacional consistente — sem prometer compra online.
  return "Atendimento via WhatsApp e visita presencial mediante agendamento.";
}

/**
 * Bullet markdown de um car no snapshot. Inclui:
 *   - `**brand model year**`
 *   - Preço BRL (ou `Sob consulta` se null)
 *   - km formatado
 *   - fuel
 *   - link absoluto para `/estoque/{slug}`
 */
function buildCarBullet(car: SiteCar, siteUrl: string): string {
  const titleParts: string[] = [];
  const heading = `**${car.brand} ${car.model} ${car.year}**`;
  const pricePart =
    car.price === null ? "Sob consulta" : `R$ ${formatBRL(car.price)
      .replace(/^R\$\s?/, "")}`;
  titleParts.push(pricePart);
  // km — schema garante number int >= 0
  titleParts.push(`${formatKm(car.km)} km`);
  titleParts.push(car.fuel);

  return `- ${heading} — ${titleParts.join(", ")}. Detalhes: ${siteUrl}/estoque/${car.slug}`;
}

/**
 * Linha de endereço pro contato. `null` quando address ausente — caller
 * omite linha inteira.
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
