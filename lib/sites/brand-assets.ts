import "server-only";

/**
 * Pipeline de extração de brand assets para o Site Generator (Phase 7,
 * issue #156).
 *
 * **Fonte canônica:** §5 do spec mestre
 * (`docs/superpowers/specs/2026-05-08-gerador-sites-concessionarias-design.md`,
 * linhas 199–229).
 *
 * Cascata logo (todas as 4 funções tentam, retornam `string | null`):
 *  1. Instagram avatar (Apify scraper).
 *  2. Google Maps profile photo (Apify Maps actor).
 *  3. Website favicon (HTML scraping com timeout 5s).
 *  4. Monogram SVG (gerado on-the-fly + upload Vercel Blob).
 *
 * Cor primária via `node-vibrant` + WCAG AA threshold 4.5 → texto
 * `#FFFFFF` ou `#0C0C0C`.
 *
 * Fotos: `fetchMapsPhotos` (até 3) com fallback pra `stockShowroomPhotos`.
 *
 * Carros placeholder: 6 entries via `pickCarStock` (#157).
 *
 * **Garantia BLOQUEANTE:** `extractBrandAssets` NUNCA lança. Em
 * catastrófico failure, retorna fallback total. Issue #156 §AC2.
 */

import { ApifyClient } from "apify-client";
import { put } from "@vercel/blob";
import Vibrant from "node-vibrant";

import { env } from "@/lib/env";
import type { Database } from "@/types/database";

import { pickCarStock } from "./stock-photos";
import { slugify } from "@/lib/utils/slug";
import type { AssetSources } from "./brand-assets.types";

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

/**
 * Banco de fotos stock pra fallback em `hero_image_url` / `about_image_url`
 * / `contact_hero_image_url`. Apontam para arquivos já no `public/assets/`.
 *
 * Mantido como tuple imutável — nunca esvazia, sempre tem ≥ 3 entries.
 */
export const stockShowroomPhotos: readonly string[] = [
  "/assets/hero/porsche-model5.png",
  "/assets/about/porsche-model.png",
  "/assets/contact/bmw-m2.png",
] as const;

/** Cor de fallback quando não há logo / Vibrant falhou. */
const FALLBACK_COLOR = "#000000";

/** Texto sobre `FALLBACK_COLOR` — atende WCAG AA. */
const FALLBACK_TEXT_ON_PRIMARY = "#FFFFFF" as const;

/** Quantos carros placeholder retornar (constante de spec §5). */
const CAR_PLACEHOLDER_COUNT = 6;

/** Quantas fotos do Maps queremos no máximo (hero + about + contact). */
const MAPS_PHOTOS_TARGET = 3;

/** Timeout do fetch em `tryWebsiteFavicon`. */
const FAVICON_FETCH_TIMEOUT_MS = 5_000;

/**
 * Stopwords PT-BR ignoradas em `buildMonogramLogo` na extração de iniciais.
 */
const PT_BR_STOPWORDS = new Set(["de", "da", "do", "das", "dos", "e"]);

// ---------------------------------------------------------------------------
// Tipos auxiliares
// ---------------------------------------------------------------------------

type Lead = Database["public"]["Tables"]["leads"]["Row"];

type Lead_Raw_PlaceId_Hint = {
  placeId?: string | null;
  place_id?: string | null;
};

/**
 * Shape mínimo de Swatch que consumimos do `node-vibrant`. Tipo intencional-
 * mente estrutural pra permitir mocks em teste sem instanciar `Swatch`.
 */
interface SwatchLike {
  getHex(): string;
  getPopulation(): number;
  getHsl(): [number, number, number];
}

/**
 * Palette estrutural — 6 named swatches opcionais (alguns podem ser
 * `undefined` quando a imagem não tem aquele tom).
 */
type PaletteLike = {
  Vibrant?: SwatchLike;
  DarkVibrant?: SwatchLike;
  LightVibrant?: SwatchLike;
  Muted?: SwatchLike;
  DarkMuted?: SwatchLike;
  LightMuted?: SwatchLike;
};

// ---------------------------------------------------------------------------
// Apify singleton (lazy)
// ---------------------------------------------------------------------------

let _apify: ApifyClient | null = null;
function getApifyClient(): ApifyClient {
  if (!_apify) {
    _apify = new ApifyClient({ token: env.APIFY_TOKEN });
  }
  return _apify;
}

// ---------------------------------------------------------------------------
// Helpers de logging — prefixo estável pra grep em logs de servidor.
// ---------------------------------------------------------------------------

function warn(message: string, ctx?: Record<string, unknown>): void {
  console.warn(`[brand-assets] ${message}`, ctx ?? {});
}

// ===========================================================================
// CASCATA LOGO — 4 etapas
// ===========================================================================

/**
 * Tenta o avatar do Instagram via Apify scraper.
 *
 * Falhas são silenciosas — retorna `null` em qualquer erro pra a cascata
 * avançar. Logs estruturados via `console.warn`.
 */
export async function tryInstagramAvatar(
  handle: string | null,
): Promise<string | null> {
  if (!handle) return null;
  try {
    const apify = getApifyClient();
    const run = await apify
      .actor(env.APIFY_INSTAGRAM_ACTOR_ID)
      .call({ usernames: [handle] });
    const datasetId =
      typeof run === "object" && run !== null && "defaultDatasetId" in run
        ? (run as { defaultDatasetId?: string }).defaultDatasetId
        : undefined;
    if (!datasetId) {
      warn("instagram avatar: no defaultDatasetId in actor run");
      return null;
    }
    const { items } = await apify.dataset(datasetId).listItems();
    const first = items?.[0] as
      | { profilePicUrl?: string | null }
      | undefined;
    const url = first?.profilePicUrl;
    if (typeof url === "string" && url.length > 0) return url;
    warn("instagram avatar: profilePicUrl ausente", { handle });
    return null;
  } catch (err) {
    warn("instagram avatar: apify falhou", {
      handle,
      message: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Tenta a primeira foto do perfil no Google Maps via Apify Maps actor.
 *
 * Falhas silenciosas — retorna `null` na cascata.
 */
export async function tryGoogleMapsProfilePhoto(
  placeId: string | null,
): Promise<string | null> {
  if (!placeId) return null;
  try {
    const apify = getApifyClient();
    const run = await apify
      .actor(env.APIFY_GOOGLE_MAPS_ACTOR_ID)
      .call({ placeIds: [placeId], maxImages: 1 });
    const datasetId =
      typeof run === "object" && run !== null && "defaultDatasetId" in run
        ? (run as { defaultDatasetId?: string }).defaultDatasetId
        : undefined;
    if (!datasetId) {
      warn("maps photo: no defaultDatasetId in actor run");
      return null;
    }
    const { items } = await apify.dataset(datasetId).listItems();
    const first = items?.[0] as { imageUrls?: string[] } | undefined;
    const photo = first?.imageUrls?.[0];
    if (typeof photo === "string" && photo.length > 0) return photo;
    warn("maps photo: nenhuma foto retornada", { placeId });
    return null;
  } catch (err) {
    warn("maps photo: apify falhou", {
      placeId,
      message: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Tenta o favicon do site fazendo HTML scrape do `<head>`.
 *
 * Procura `<link rel="icon">` ou `rel="shortcut icon"`. Se `href` é
 * relativo, resolve via `URL` constructor com base na URL fornecida.
 *
 * Timeout de 5s via AbortController. Qualquer erro retorna `null`.
 *
 * Aceita URLs sem schema (`acme.com.br`) — adiciona `https://` antes do
 * fetch (compatível com `normalizeWebsite` do `lib/apify/google-maps.ts`).
 */
export async function tryWebsiteFavicon(
  url: string | null,
): Promise<string | null> {
  if (!url) return null;

  // Garante schema absoluto pra `URL` constructor + fetch.
  let absoluteUrl = url.trim();
  if (!/^https?:\/\//i.test(absoluteUrl)) {
    absoluteUrl = `https://${absoluteUrl}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, FAVICON_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(absoluteUrl, {
      signal: controller.signal,
      redirect: "follow",
    });
    if (!response.ok) {
      warn("favicon: HTTP não-OK", {
        url: absoluteUrl,
        status: response.status,
      });
      return null;
    }
    const html = await response.text();
    const href = extractIconHrefFromHtml(html);
    if (!href) {
      warn("favicon: <link rel=icon> não encontrado", { url: absoluteUrl });
      return null;
    }
    // Resolve URL relativa -> absoluta.
    try {
      return new URL(href, absoluteUrl).toString();
    } catch {
      warn("favicon: href não é URL resolvível", { url: absoluteUrl, href });
      return null;
    }
  } catch (err) {
    warn("favicon: fetch falhou", {
      url: absoluteUrl,
      message: err instanceof Error ? err.message : String(err),
    });
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Extrai `href` do primeiro `<link rel="icon">` ou `rel="shortcut icon">`
 * encontrado no HTML. Implementação string-based suficiente pra HTMLs
 * comuns — não usamos JSDOM pra evitar peso em runtime serverless.
 */
function extractIconHrefFromHtml(html: string): string | null {
  // Regex captura `<link ... rel="icon|shortcut icon" ... href="..."` ou
  // a ordem reversa (href antes de rel). Não valida HTML estrito.
  const linkRe =
    /<link\b([^>]*)>/gi;
  let match: RegExpExecArray | null;
  while ((match = linkRe.exec(html)) !== null) {
    const attrs = match[1] ?? "";
    const relMatch = /\brel\s*=\s*["']([^"']+)["']/i.exec(attrs);
    if (!relMatch) continue;
    const rels = relMatch[1]!.toLowerCase().split(/\s+/);
    if (!rels.includes("icon") && !rels.includes("shortcut")) continue;
    const hrefMatch = /\bhref\s*=\s*["']([^"']+)["']/i.exec(attrs);
    if (!hrefMatch) continue;
    const href = hrefMatch[1]?.trim();
    if (href && href.length > 0) return href;
  }
  return null;
}

/**
 * Gera um SVG monogram 256×256 com 2 iniciais centradas sobre `bgColor`.
 *
 * Path no Blob é determinístico via `slugify(businessName)` — chamadas
 * repetidas com mesmo input geram o mesmo path (e o cliente Blob
 * sobrescreve idempotentemente).
 *
 * Em caso de falha no upload, retorna data URI base64 inline pra garantir
 * que o caller sempre recebe uma string válida (issue #156 §AC2).
 */
export async function buildMonogramLogo(
  businessName: string,
  bgColor: string,
): Promise<string> {
  const initials = extractInitials(businessName);
  const textColor = wcagContrast(bgColor);
  const svg = renderMonogramSvg(initials, bgColor, textColor);
  const path = `lead-sites/monograms/${slugify(businessName)}.svg`;

  try {
    const result = await put(path, svg, {
      access: "public",
      contentType: "image/svg+xml",
      // `put` com `addRandomSuffix: false` mantém o pathname determinístico —
      // re-upload do mesmo monogram (mesmo nome de negócio) sobrescreve o
      // arquivo no Blob ao invés de proliferar duplicatas.
      addRandomSuffix: false,
    });
    return result.url;
  } catch (err) {
    warn("monogram: blob upload falhou — caindo em data URI", {
      businessName,
      message: err instanceof Error ? err.message : String(err),
    });
    const base64 = Buffer.from(svg, "utf8").toString("base64");
    return `data:image/svg+xml;base64,${base64}`;
  }
}

/**
 * Extrai 2 iniciais do nome de negócio:
 *  - 1 palavra significativa → 2 primeiras letras dela.
 *  - 2+ palavras significativas → primeira letra de cada uma das 2 primeiras.
 *  - Stopwords PT-BR (de/da/do/das/dos/e) e tokens não-letra são ignorados.
 *  - Fallback: `XX` se nada extraível.
 */
function extractInitials(businessName: string): string {
  const tokens = businessName
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // remove combining marks
    .split(/\s+/)
    .map((t) => t.replace(/[^A-Za-z]/g, "")) // só letras dentro de cada token
    .filter((t) => t.length > 0)
    .filter((t) => !PT_BR_STOPWORDS.has(t.toLowerCase()));

  if (tokens.length === 0) return "XX";
  if (tokens.length === 1) {
    const word = tokens[0]!;
    if (word.length >= 2) return word.slice(0, 2).toUpperCase();
    return (word[0]! + word[0]!).toUpperCase();
  }
  // 2+ palavras: pega primeira letra das duas primeiras significativas.
  return (tokens[0]![0]! + tokens[1]![0]!).toUpperCase();
}

/**
 * SVG monogram 256×256. Texto centrado via `text-anchor="middle"` +
 * `dominant-baseline="central"`. Font system-stack pra evitar dependência
 * de webfont no preview.
 */
function renderMonogramSvg(
  initials: string,
  bgColor: string,
  textColor: string,
): string {
  // Escapa &/</> nos valores embedded pra defesa em profundidade —
  // bgColor é validado por sanitizeHex no caller, mas defesa extra aqui
  // não machuca.
  const safeInitials = initials.replace(/[<>&"']/g, "");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><rect width="256" height="256" fill="${bgColor}"/><text x="128" y="128" text-anchor="middle" dominant-baseline="central" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="120" font-weight="700" fill="${textColor}">${safeInitials}</text></svg>`;
}

// ===========================================================================
// COR PRIMÁRIA + CONTRAST
// ===========================================================================

/**
 * Escolhe a cor mais "expressiva" da palette ponderando saturação ×
 * população. Empate: ordem de iteração (Vibrant > DarkVibrant > ...).
 *
 * Retorna `'#000000'` quando palette vazio ou todas as swatches são
 * `undefined`. Output sempre lowercase 6-digit `#rrggbb`.
 */
export function pickAccent(palette: PaletteLike): string {
  const candidates: SwatchLike[] = [
    palette.Vibrant,
    palette.DarkVibrant,
    palette.LightVibrant,
    palette.Muted,
    palette.DarkMuted,
    palette.LightMuted,
  ].filter((s): s is SwatchLike => s !== undefined && s !== null);

  if (candidates.length === 0) return FALLBACK_COLOR;

  let best: SwatchLike | null = null;
  let bestScore = -Infinity;
  for (const swatch of candidates) {
    const hsl = swatch.getHsl();
    const saturation = hsl[1] ?? 0;
    const population = swatch.getPopulation();
    const score = population * saturation;
    if (score > bestScore) {
      bestScore = score;
      best = swatch;
    }
  }
  if (!best) return FALLBACK_COLOR;
  const hex = best.getHex();
  return normalizeHex(hex);
}

/** Garante `#rrggbb` lowercase. Inputs malformados → `FALLBACK_COLOR`. */
function normalizeHex(input: string): string {
  if (typeof input !== "string") return FALLBACK_COLOR;
  const trimmed = input.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(trimmed)) return trimmed;
  return FALLBACK_COLOR;
}

/**
 * Calcula relative luminance de uma cor `#rrggbb` per WCAG 2.1.
 * Ref: https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */
function relativeLuminance(hex: string): number {
  const cleaned = normalizeHex(hex);
  const r = parseInt(cleaned.slice(1, 3), 16) / 255;
  const g = parseInt(cleaned.slice(3, 5), 16) / 255;
  const b = parseInt(cleaned.slice(5, 7), 16) / 255;
  const lin = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/**
 * Contrast ratio per WCAG 2.1. Sempre ≥ 1, ≤ 21.
 * Exposto pra teste — em runtime só `wcagContrast` é usado.
 */
export function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Decide texto sobre `bg`: `'#FFFFFF'` se atinge WCAG AA (4.5:1) com white,
 * senão `'#0C0C0C'` (preto da brand de fallback). Cobre o caso degenerado:
 * se ambos atingem 4.5, prefere o de maior contraste.
 */
export function wcagContrast(bg: string): "#FFFFFF" | "#0C0C0C" {
  const ratioWhite = contrastRatio(bg, "#FFFFFF");
  const ratioBlack = contrastRatio(bg, "#0C0C0C");
  // Prefere o de maior contraste (resolve casos cinzentos com ambos < 4.5).
  if (ratioWhite >= ratioBlack) return "#FFFFFF";
  return "#0C0C0C";
}

// ===========================================================================
// MAPS PHOTOS — fetch (até N)
// ===========================================================================

/**
 * Busca até `count` fotos do perfil do Maps via Apify. `placeId` null →
 * retorna `[]`. Falhas retornam `[]` (caller completa de `stockShowroomPhotos`).
 */
export async function fetchMapsPhotos(
  placeId: string | null,
  count: number,
): Promise<string[]> {
  if (!placeId || count <= 0) return [];
  try {
    const apify = getApifyClient();
    const run = await apify
      .actor(env.APIFY_GOOGLE_MAPS_ACTOR_ID)
      .call({ placeIds: [placeId], maxImages: count });
    const datasetId =
      typeof run === "object" && run !== null && "defaultDatasetId" in run
        ? (run as { defaultDatasetId?: string }).defaultDatasetId
        : undefined;
    if (!datasetId) return [];
    const { items } = await apify.dataset(datasetId).listItems();
    const first = items?.[0] as { imageUrls?: string[] } | undefined;
    const photos = first?.imageUrls ?? [];
    return photos
      .filter((u): u is string => typeof u === "string" && u.length > 0)
      .slice(0, count);
  } catch (err) {
    warn("maps photos: apify falhou", {
      placeId,
      count,
      message: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

// ===========================================================================
// PIPELINE PRINCIPAL — extractBrandAssets
// ===========================================================================

/**
 * Extrai todos os brand assets a partir de um lead. Nunca lança — em
 * catastrófico failure retorna fallback total. Issue #156 §AC2.
 */
export async function extractBrandAssets(lead: Lead): Promise<AssetSources> {
  try {
    const businessName = lead.name ?? "Concessionária";
    const placeId = extractPlaceId(lead);

    // ---- Cascata logo ----
    const igHandle = lead.instagram_handle;
    const website = lead.website;

    const logoUrl = await runLogoCascade({
      businessName,
      igHandle,
      placeId,
      website,
    });

    // ---- Cor primária ----
    const primaryColor = await extractPrimaryColor(logoUrl);
    const textOnPrimary = wcagContrast(primaryColor);

    // ---- Fotos ----
    const mapsPhotos = await fetchMapsPhotos(placeId, MAPS_PHOTOS_TARGET);
    const photos = padWithStock(mapsPhotos, MAPS_PHOTOS_TARGET);

    // ---- Carros placeholder ----
    const cars = pickCarStock({
      business_type: "concessionaria",
      count: CAR_PLACEHOLDER_COUNT,
      seed: lead.id,
    });

    return {
      logo_url: logoUrl,
      primary_color: primaryColor,
      text_on_primary: textOnPrimary,
      hero_image_url: photos[0]!,
      about_image_url: photos[1]!,
      contact_hero_image_url: photos[2]!,
      car_placeholder_urls: cars.map((c) => c.url),
    };
  } catch (err) {
    warn("extractBrandAssets: catastrófico — caindo em fallback total", {
      leadId: lead.id,
      message: err instanceof Error ? err.message : String(err),
    });
    return buildCatastrophicFallback(lead);
  }
}

/**
 * Executa a cascata de logo. Cada step tenta; se retornar string não-null,
 * encerra. Final: monogram (que sempre retorna string — Blob ok ou data URI).
 */
async function runLogoCascade(args: {
  businessName: string;
  igHandle: string | null;
  placeId: string | null;
  website: string | null;
}): Promise<string> {
  const { businessName, igHandle, placeId, website } = args;

  const igAvatar = await tryInstagramAvatar(igHandle);
  if (igAvatar) return igAvatar;

  const mapsPhoto = await tryGoogleMapsProfilePhoto(placeId);
  if (mapsPhoto) return mapsPhoto;

  const favicon = await tryWebsiteFavicon(website);
  if (favicon) return favicon;

  // Monogram. Cor de fundo provisória — pode ser substituída pela palette
  // se o monogram for analisado depois. Hoje: usamos FALLBACK_COLOR pra
  // simplicidade; cor primária será derivada da palette do próprio SVG no
  // step seguinte.
  return buildMonogramLogo(businessName, FALLBACK_COLOR);
}

/**
 * Extrai cor primária via `node-vibrant`. Fallback `'#000000'` em qualquer
 * erro (URL inacessível, image format inválido, etc.).
 */
async function extractPrimaryColor(logoUrl: string): Promise<string> {
  // Vibrant não consegue processar data URI / SVG diretamente em Node —
  // pula a chamada e retorna fallback nesses casos pra evitar log noise.
  if (
    logoUrl.startsWith("data:") ||
    logoUrl.toLowerCase().endsWith(".svg")
  ) {
    return FALLBACK_COLOR;
  }
  try {
    const palette = (await Vibrant.from(logoUrl).getPalette()) as PaletteLike;
    return pickAccent(palette);
  } catch (err) {
    warn("color: Vibrant falhou — usando #000000", {
      logoUrl,
      message: err instanceof Error ? err.message : String(err),
    });
    return FALLBACK_COLOR;
  }
}

/** Completa array com `stockShowroomPhotos` até atingir `targetLength`. */
function padWithStock(photos: string[], targetLength: number): string[] {
  if (photos.length >= targetLength) return photos.slice(0, targetLength);
  const out = [...photos];
  let i = 0;
  while (out.length < targetLength) {
    out.push(stockShowroomPhotos[i % stockShowroomPhotos.length]!);
    i++;
  }
  return out;
}

/**
 * Tenta extrair `placeId` do lead. O scraper do Maps preserva em `raw`
 * (`mapGoogleMapsPlace` em `lib/apify/google-maps.ts` faz `raw: place`).
 */
function extractPlaceId(lead: Lead): string | null {
  const raw = lead.raw;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const hint = raw as unknown as Lead_Raw_PlaceId_Hint;
  return hint.placeId ?? hint.place_id ?? null;
}

/**
 * Fallback total em catastrófico failure: monogram inline (sem hit no Blob),
 * cor preta + texto branco, fotos do stock, 6 carros placeholder.
 *
 * Esta função só é chamada quando algo dentro do pipeline lançou uma
 * exceção que nem os try/catch interno cobriram (defense in depth). Não
 * deve fazer I/O — tudo síncrono ou usar funções puras.
 */
function buildCatastrophicFallback(lead: Lead): AssetSources {
  const businessName = lead.name ?? "Concessionária";
  const initials = extractInitials(businessName);
  const svg = renderMonogramSvg(
    initials,
    FALLBACK_COLOR,
    FALLBACK_TEXT_ON_PRIMARY,
  );
  const dataUri = `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;

  let cars: ReturnType<typeof pickCarStock> = [];
  try {
    cars = pickCarStock({
      business_type: "concessionaria",
      count: CAR_PLACEHOLDER_COUNT,
      seed: lead.id,
    });
  } catch {
    // Manifest pode estar quebrado em catastrofic failure — preenchemos
    // com strings vazias pra manter `length === 6`. Render lida com URL
    // vazia mostrando placeholder visual.
    cars = [];
  }

  const carUrls: string[] =
    cars.length === CAR_PLACEHOLDER_COUNT
      ? cars.map((c) => c.url)
      : Array.from({ length: CAR_PLACEHOLDER_COUNT }, (_, i) => {
          const stock = cars[i];
          return stock?.url ?? stockShowroomPhotos[0]!;
        });

  return {
    logo_url: dataUri,
    primary_color: FALLBACK_COLOR,
    text_on_primary: FALLBACK_TEXT_ON_PRIMARY,
    hero_image_url: stockShowroomPhotos[0]!,
    about_image_url: stockShowroomPhotos[1]!,
    contact_hero_image_url: stockShowroomPhotos[2]!,
    car_placeholder_urls: carUrls,
  };
}
