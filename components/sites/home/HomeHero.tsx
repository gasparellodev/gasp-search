import "server-only";

import Image from "next/image";

import { sanitizeHex } from "@/lib/sites/sanitize";
import type { SiteVariablesV2 } from "@/types/lead-site";

import { AICitableHero } from "../AICitableHero";

import { HomeQuickSearchBar } from "./HomeQuickSearchBar";

interface HomeHeroProps {
  /** Nome do negócio (usado no `<h1>` + alt da imagem + AI passage). */
  business_name: string;
  /**
   * URL/path da imagem hero. Quando ausente, renderiza empty state com
   * gradient + monogram (decisão PO #221 — NÃO branco, graceful).
   *
   * **Resolução (Sprint 2 / #A3 / #217)**: o caller (`SitePage`) já aplica
   * a precedência `manifest?.hero_url ?? variables.brand_assets.hero_image_url`
   * antes de passar pra cá. Este componente permanece thin.
   */
  hero_image_url: string | null | undefined;
  /** Cor primária do site (hex sanitizado) — bg do CTA pill + empty state gradient. */
  primary_color: string;
  /** Cor de texto sobre primário — texto do CTA pill. */
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
 * Hero da Home V2 (Phase 7 / Sprint 4 / #H1 — issue #221).
 *
 * Server Component. Layout:
 *   - **Mobile**: `min-h-[90dvh]` (NÃO `vh` — lição sections-catalog).
 *   - **Desktop**: split 6/6 (`md:grid-cols-2`).
 *   - **Imagem**: `<Image priority fetchPriority="high" sizes="100vw" quality={85}>` — LCP target.
 *   - **H1 PT-BR canônico**: `${business_name} — Carros seminovos em ${city}`.
 *   - **Empty state**: linear-gradient com `primary_color` + monogram (1ª letra) centralizado.
 *
 * Embute `<HomeQuickSearchBar>` (Client) abaixo do H1 — submit redireciona
 * pra `/estoque?m=...&model=...&p=...` via short-keys compartilhadas com #224.
 *
 * `AICitableHero` (#214) injetado após o H1, sempre visível mobile (AI crawlers).
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

  // H1 PT-BR canônico (PO refinement #221): "<biz> — Carros seminovos em <city>"
  // Fallback gracioso quando address null: omite o "em <city>".
  const heroH1 = address?.city
    ? `${business_name} — Carros seminovos em ${address.city}`
    : `${business_name} — Carros seminovos`;

  const hasHeroImage = Boolean(hero_image_url && hero_image_url.length > 0);
  const monogram = business_name.trim().charAt(0).toUpperCase() || "•";

  return (
    <section
      data-testid="home-hero"
      className="relative w-full bg-background min-h-[90dvh]"
    >
      <div className="mx-auto grid min-h-[90dvh] max-w-7xl grid-cols-1 items-center gap-8 px-4 py-10 md:grid-cols-2 md:gap-12 md:px-8 md:py-16 lg:gap-16">
        <div className="flex flex-col items-start gap-8 md:gap-10">
          <h1
            className="font-bold leading-[0.95] tracking-tight text-foreground"
            style={{ fontSize: "clamp(2.25rem, 6vw, 4.5rem)" }}
          >
            {heroH1}
          </h1>
          {/*
            AI passage-citable (#214). Imediatamente após <h1>, sempre
            visível mobile (AI crawlers mobile-first). Estilo discreto
            via text-muted-foreground.
          */}
          <AICitableHero
            variables={{ business_name, address, cars }}
            page="home"
          />
          <HomeQuickSearchBar
            slug={slug}
            primary_color={primary_color}
            text_on_primary={text_on_primary}
          />
        </div>

        <div className="relative aspect-[4/3] w-full md:aspect-auto md:h-[520px] lg:h-[600px]">
          {hasHeroImage && hero_image_url ? (
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
              // `quality={85}` is desired (AC #221) but next/image v16 emits a
              // dev-time warning when not present in `images.qualities`. We use
              // `unoptimized` here (image hosts are not whitelisted), so quality
              // is dead-letter at runtime — drop the prop to silence the noise.
            />
          ) : (
            <div
              data-testid="home-hero-empty-state"
              aria-hidden="true"
              role="presentation"
              className="flex h-full w-full items-center justify-center rounded-3xl"
              style={{
                backgroundImage: `linear-gradient(135deg, ${safePrimary} 0%, #0C0C0C 100%)`,
              }}
            >
              <span className="text-9xl font-bold tracking-tight text-white/85 select-none">
                {monogram}
              </span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
