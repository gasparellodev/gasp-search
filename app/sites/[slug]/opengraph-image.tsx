/**
 * `opengraph-image` — geração dinâmica de imagem 1200×630 PNG para social
 * share dos sites públicos `/sites/[slug]/*` (issue #213 / Sprint 1 / #S3).
 *
 * Fonte canônica:
 *   - `docs/SEO-PLAN.md` §Sprint 1 #S3 (OG image + canonical + WebSite).
 *   - Next.js Metadata Files convention (`opengraph-image.{js,tsx}`).
 *
 * **Decisões PO refinement (#213):**
 *
 * 1. **`runtime = 'edge'` mantido**. Apesar do Vercel knowledge-update
 *    recomendar Fluid Compute (Node) por default, OG image é workload
 *    curto sem deps Node-only e cold-start Edge < Node ainda compensa
 *    para `ImageResponse`. Trade-off aceito pelo PO.
 *
 * 2. **404 quando `isIndexable(site) === false`**. OG image é consumida
 *    por scrapers de social network (Facebook/Twitter/WhatsApp), não por
 *    AI crawlers. Vazar preview de site `draft`/`archived`/sem
 *    `signed_at` quebra privacy-by-obscurity. Distinto do JSON-LD em
 *    `#211` que SEMPRE é injetado (AI crawlers consomem `@graph`
 *    ignorando `robots:noindex`).
 *
 * 3. **Fallback graceful**. Hero image fetch falha ou ausente → gradient
 *    escuro como background. Font fetch falha → system font (`-apple-
 *    system`). NÃO crashar request — OG é best-effort SEO surface.
 *
 * 4. **Cache cross-file**. `cacheTag('og:<slug>')` permite invalidação
 *    pelos Server Actions em `app/actions/lead-site.ts` quando o site é
 *    atualizado/publicado/arquivado. Sem isso, preview ficaria stale 1h
 *    após publish.
 *
 * **Layout visual** (per DESIGN.md `auto-showroom`):
 *   - Background: hero_image_url (cover) ou gradient escuro fallback.
 *   - Overlay: gradient escuro 0→60% bottom-up para legibilidade.
 *   - Accent stripe (8px) na cor `brand_assets.primary_color`.
 *   - `business_name`: Geist 600 (96px ou system fallback).
 *   - Tagline: slogan ou "Loja de seminovos" (36px).
 *
 * **Server-only**: ImageResponse renderiza no Edge runtime — qualquer
 * import precisa ser Edge-compatible.
 */
import "server-only";

import { ImageResponse } from "next/og";
import { cacheTag } from "next/cache";

import { getSite } from "@/lib/sites/get-site";
import { isIndexable } from "@/lib/sites/metadata";
import { readSiteVariablesSafe } from "@/lib/sites/migrate-variables";
import { sanitizeHex } from "@/lib/sites/sanitize";

// ---------------------------------------------------------------------------
// Next Metadata file convention exports
// ---------------------------------------------------------------------------

/**
 * Edge runtime — workload curto, sem deps Node-only. Trade-off explicito
 * vs Fluid Compute documentado no PR (#213 PO decision).
 */
export const runtime = "edge";

/**
 * ISR 1h. `revalidateTag('og:<slug>')` em Server Actions de publish/update
 * (`app/actions/lead-site.ts`) força refresh imediato fora desse ciclo.
 */
export const revalidate = 3600;

/**
 * Dimensão padrão Open Graph + Twitter `summary_large_image` (1.91:1).
 */
export const size = { width: 1200, height: 630 };

/**
 * Content-type fixo PNG (default do ImageResponse). Declarado pro Next
 * popular `<meta property="og:image:type">` quando linkando o asset.
 */
export const contentType = "image/png";

/**
 * Alt text textual (sem PII). Lido por Twitter quando renderiza preview
 * em screen readers. Estável entre sites — descrição operacional, não
 * personalizada (nome custom vai no description meta, não no alt).
 */
export const alt = "Loja de Seminovos — Preview do Site";

// ---------------------------------------------------------------------------
// Default handler
// ---------------------------------------------------------------------------

interface OgImageParams {
  params: Promise<{ slug: string }>;
}

/**
 * Handler do Next Metadata file. Retorna `ImageResponse` (subclasse de
 * `Response`) ou `Response` 404 quando o site não é elegível.
 */
export default async function Image({ params }: OgImageParams): Promise<Response> {
  const { slug } = await params;

  // Cache key por slug — invalidado via `revalidateTag('og:<slug>')` em
  // Server Actions de publish/update/archive. Dentro do bloco `'use cache'`
  // do `getSite` o tag já é `site:<slug>` (diferente — site row vs OG asset).
  cacheTag(`og:${slug}`);

  const site = await getSite(slug);

  // Gate isIndexable: 404 quando null/draft/archived/sem signed_at.
  // Diferente do JSON-LD em #211 que sempre injeta — OG image vaza
  // preview pra scrapers de social (FB/Twitter), não pra AI crawlers.
  if (site === null || !isIndexable(site)) {
    return new Response(null, { status: 404 });
  }

  const parsed = readSiteVariablesSafe(site.variables);
  if (!parsed.success) {
    return new Response(null, { status: 404 });
  }

  const variables = parsed.data;
  const businessName = variables.business_name || "Loja de Carros";
  const slogan =
    variables.slogan && variables.slogan.trim().length > 0
      ? variables.slogan
      : "Loja de seminovos";
  const accent = sanitizeHex(variables.brand_assets.primary_color);
  const textOnPrimary = variables.brand_assets.text_on_primary;

  // Hero image: usa `brand_assets.hero_image_url` se válido. ImageResponse
  // do Next requer URL absoluta para fetch — paths `/...` precisam ser
  // resolvidos contra a app URL. Em fallback, omitimos backgroundImage e
  // ficamos no gradient.
  const heroUrl = await resolveHeroUrl(variables.brand_assets.hero_image_url);

  // Font: tentamos Geist via Vercel CDN; se fail, system font fallback.
  const fonts = await loadGeistFont();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          position: "relative",
          backgroundColor: "#0C0C0C",
          backgroundImage: heroUrl ? `url(${heroUrl})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
          fontFamily: fonts ? "Geist" : "sans-serif",
        }}
      >
        {/* Overlay: gradient escuro 0→60% bottom-up pra legibilidade */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            background:
              "linear-gradient(180deg, rgba(12,12,12,0) 0%, rgba(12,12,12,0.85) 75%, rgba(12,12,12,0.95) 100%)",
          }}
        />

        {/* Accent stripe (8px) */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 8,
            backgroundColor: accent,
          }}
        />

        {/* Texto */}
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            padding: "0 80px 80px 80px",
            color: textOnPrimary === "#0C0C0C" ? "#FAFAFA" : textOnPrimary,
          }}
        >
          <div
            style={{
              fontSize: 36,
              opacity: 0.85,
              marginBottom: 16,
              letterSpacing: "-0.01em",
            }}
          >
            {slogan}
          </div>
          <div
            style={{
              fontSize: 96,
              fontWeight: 600,
              lineHeight: 1.05,
              letterSpacing: "-0.025em",
            }}
          >
            {businessName}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      ...(fonts ? { fonts } : {}),
    },
  );
}

// ---------------------------------------------------------------------------
// Helpers — hero resolution + font loading com fallback graceful
// ---------------------------------------------------------------------------

/**
 * Resolve hero URL para fetch absoluto no Edge runtime. Paths relativos
 * (`/...`) viram `${APP_URL}/...`. HTTP(S) absoluto passa direto.
 *
 * **Não faz fetch antecipado** — ImageResponse fetcha sob demanda e
 * trata 404/timeout interno como `null` (background gradient assume).
 * Wrapping defensivo aqui só normaliza shape.
 */
async function resolveHeroUrl(input: string | null | undefined): Promise<string | null> {
  if (typeof input !== "string" || input.length === 0) return null;
  if (/^https?:\/\//i.test(input)) return input;
  // Path relativo — precisa ser absoluto pro Edge fetcher.
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";
  if (!base) return null;
  return `${base}${input}`;
}

// Module-scope memoization. Edge re-cria isolate por request, mas dentro
// do mesmo isolate vale evitar refetch.
let geistFontPromise: Promise<ArrayBuffer | null> | null = null;

/**
 * Tenta fetchar Geist 600 (semibold) via Vercel CDN para usar como
 * fallback de font no `ImageResponse`. Em fail (network, 404, timeout
 * 5s), retorna `null` — o handler cai pra system font default.
 *
 * **NÃO logar URL completa nem PII em fail** — só `console.warn` com
 * status code.
 */
async function loadGeistFont(): Promise<
  | [
      {
        name: string;
        data: ArrayBuffer;
        style: "normal";
        weight: 600;
      },
    ]
  | null
> {
  if (!geistFontPromise) {
    geistFontPromise = fetchGeistBuffer();
  }
  const buf = await geistFontPromise;
  if (!buf) return null;
  return [{ name: "Geist", data: buf, style: "normal", weight: 600 }];
}

async function fetchGeistBuffer(): Promise<ArrayBuffer | null> {
  const url =
    "https://github.com/vercel/geist-font/raw/main/packages/next/dist/fonts/geist-sans/Geist-SemiBold.woff2";
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) {
      console.warn("og:font:fail", { status: res.status });
      return null;
    }
    return await res.arrayBuffer();
  } catch (err) {
    // Fail safe — não logar a URL inteira nem stack (Edge isolate é
    // efêmero e qualquer log com PII se acumula em logs centralizados).
    console.warn("og:font:fail", { reason: (err as Error).name });
    return null;
  }
}
