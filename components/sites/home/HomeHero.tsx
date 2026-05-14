import "server-only";

import Image from "next/image";

import { getOptimizedSourcesForDefault } from "@/lib/sites/default-visual-identity";
import { sanitizeHex } from "@/lib/sites/sanitize";
import type { SiteVariablesV2 } from "@/types/lead-site";

import { AICitableHero } from "../AICitableHero";

import { HomeQuickSearchBar } from "./HomeQuickSearchBar";

interface HomeHeroProps {
  /** Nome do negócio (usado no `<h1>` + alt da imagem + AI passage). */
  business_name: string;
  /**
   * URL/path da imagem hero. Quando ausente, fundo cai em gradient
   * `primary_color → #0C0C0C` e o glass card continua renderizando por
   * cima (carrega o branding — não há mais monogram avulso).
   *
   * **Resolução upstream**: o caller (`SitePage`) recebe o manifest já
   * via `resolveVisualIdentity(site.visual_identity)` (WP4 #312), então
   * `hero_image_url` chega populado mesmo em sites sem VI própria.
   */
  hero_image_url: string | null | undefined;
  /** Cor primária do site (hex sanitizado) — empty-state gradient + accent. */
  primary_color: string;
  /** Cor de texto sobre primário — propagada ao `<HomeQuickSearchBar>`. */
  text_on_primary: string;
  /** Slug do site, usado pra construir o href do quick search redirect. */
  slug: string;
  /**
   * Endereço estruturado da loja — usado pelo `<AICitableHero>` para
   * frase factual GEO ("em {city}/{state}") e pelo H1 canônico
   * ("Carros seminovos em {city}"). Null cai em fallback (sem city).
   */
  address: SiteVariablesV2["address"];
  /**
   * Lista de carros do estoque — usada pelo `<AICitableHero>` para
   * cláusula "com N carros em estoque a partir de R$ X". Vazia → cláusula omitida.
   */
  cars: SiteVariablesV2["cars"];
}

/**
 * Hero fullscreen da Home V2 (Phase 7 / WP1 — issue #309).
 *
 * Server Component. Layout glass-card-on-image:
 *   - **Container**: `min-h-[100dvh]`, imagem `<Image fill>` cover full-bleed
 *     atrás de tudo (LCP target via `priority` + `fetchPriority="high"`).
 *   - **Scrim**: gradient bottom (`black/45 → transparent`) que garante
 *     contraste do card em qualquer foto.
 *   - **Glass card**: `bottom-6 md:bottom-10`, `bg-white/85 backdrop-blur-md`,
 *     `w-[min(92vw,800px)]`. Conteúdo: H1, AI passage, search bar.
 *   - **Empty state**: quando `hero_image_url` é null/vazio, fundo vira
 *     gradient `linear-gradient(135deg, primary, #0C0C0C)`. Card mantém
 *     o branding por cima — graceful, NÃO branco vazio.
 *
 * `<HomeQuickSearchBar>` (Client) embutido dentro do card; `<AICitableHero>`
 * (#214) injetado após o H1 dentro do card, sempre visível mobile.
 */
export function HomeHero({
  business_name,
  hero_image_url,
  primary_color,
  text_on_primary,
  slug,
  address,
  cars,
}: HomeHeroProps) {
  const safePrimary = sanitizeHex(primary_color);

  const heroH1 = address?.city
    ? `${business_name} — Carros seminovos em ${address.city}`
    : `${business_name} — Carros seminovos`;

  const hasHeroImage = Boolean(hero_image_url && hero_image_url.length > 0);
  // WP8 #316 — quando hero_image_url é um asset default conhecido em
  // `_defaults/v1/`, serve via `<picture>` com AVIF/WebP srcset (~84KB
  // vs PNG 2MB). Sites com VI própria caem no `<Image unoptimized>`.
  const optimizedSources = getOptimizedSourcesForDefault(hero_image_url);

  return (
    <section
      data-testid="home-hero"
      // -mt-16 md:-mt-20 puxa o hero pra baixo do header sticky (que tem
      // 64px mobile / 80px desktop), garantindo full-bleed da imagem.
      className="relative -mt-16 w-full min-h-[100dvh] overflow-hidden bg-background md:-mt-20"
    >
      {/* Camada de fundo: imagem cover OU gradient empty state. */}
      {hasHeroImage && hero_image_url && optimizedSources ? (
        <picture data-testid="home-hero-picture" className="absolute inset-0">
          <source
            type="image/avif"
            srcSet={optimizedSources.avifSrcset}
            sizes="100vw"
          />
          <source
            type="image/webp"
            srcSet={optimizedSources.webpSrcset}
            sizes="100vw"
          />
          <img
            src={optimizedSources.fallbackPngUrl}
            alt={`Hero — ${business_name}`}
            fetchPriority="high"
            className="absolute inset-0 size-full object-cover object-center"
          />
        </picture>
      ) : hasHeroImage && hero_image_url ? (
        <Image
          src={hero_image_url}
          alt={`Hero — ${business_name}`}
          fill
          sizes="100vw"
          className="object-cover object-center"
          placeholder="empty"
          priority
          fetchPriority="high"
          unoptimized
        />
      ) : (
        <div
          data-testid="home-hero-empty-state"
          aria-hidden="true"
          role="presentation"
          className="absolute inset-0"
          style={{
            backgroundImage: `linear-gradient(135deg, ${safePrimary} 0%, #0C0C0C 100%)`,
          }}
        />
      )}

      {/* Scrim topo — contraste do header sobre imagem clara. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/55 via-black/20 to-transparent"
      />

      {/* Scrim bottom — contraste do card em qualquer foto. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/60 via-black/25 to-transparent"
      />

      {/* Glass card flutuante centro-baixo — vidro fumê (dark frosted). */}
      <div
        className="absolute inset-x-0 bottom-10 z-10 flex justify-center px-4 md:bottom-16 md:px-8"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div
          data-testid="home-hero-card"
          className="w-[min(92vw,800px)] rounded-3xl border border-white/15 bg-black/35 p-6 shadow-2xl backdrop-blur-3xl backdrop-saturate-150 md:p-8 supports-[not_(backdrop-filter:blur(0))]:bg-black/75"
        >
          <h1
            className="font-bold leading-[0.95] tracking-tight text-white [text-shadow:0_2px_8px_rgb(0_0_0_/_0.35)]"
            style={{ fontSize: "clamp(1.75rem, 4.5vw, 3.25rem)" }}
          >
            {heroH1}
          </h1>
          {/* AI passage em branco/85 — sobrescreve text-muted-foreground default. */}
          <div className="mt-3 text-white/85 [&_*]:!text-white/85 md:mt-4">
            <AICitableHero
              variables={{ business_name, address, cars }}
              page="home"
            />
          </div>
          <div className="mt-5 md:mt-6">
            <HomeQuickSearchBar
              slug={slug}
              primary_color={primary_color}
              text_on_primary={text_on_primary}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
