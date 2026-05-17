import "server-only";

import Image from "next/image";

import { getOptimizedSourcesForDefault } from "@/lib/sites/default-visual-identity";

interface HomeHeroBackgroundProps {
  /** URL da foto do hero (manifest AI, brand asset ou default stock). */
  heroImageUrl: string | null | undefined;
  /** Nome do negócio — usado em alt textual da imagem. */
  businessName: string;
}

/**
 * Camadas de background do hero "Cinematic Dark Showroom".
 *
 * Server Component. Renderiza em ordem (de trás pra frente):
 *   1. Base cinematic dark (`.hero-bg-cinematic`) — sempre presente,
 *      garante tom escuro como base de qualquer cenário.
 *   2. Mesh brand-tinted (`.hero-mesh`) — radial-gradient duplo com
 *      `color-mix(var(--site-primary))`. Standalone quando o lead não
 *      tem foto; layer atmosférica por trás da foto quando tem.
 *   3. Foto (`<picture>` AVIF/WebP srcset para defaults #316 ou
 *      `<Image>` unoptimized para sites com VI própria) — só quando
 *      `heroImageUrl` truthy. `priority` + `fetchPriority="high"` para
 *      LCP. Aplica `.hero-photo-grade` (brightness 0.88 / contrast
 *      1.12 / saturate 1.15) para integrar fotos AI-genéricas ao tom
 *      cinematic.
 *   4. Vignette (`.hero-vignette`) — `box-shadow: inset 0 0 240px`
 *      escurece bordas, reforça centro como foco.
 *   5. Pattern dots (`.hero-pattern-dots`) — atmosphere sutil
 *      branca/translúcida; denser 24px em mobile.
 *
 * Todas as camadas são `aria-hidden` (decorativas) e
 * `pointer-events-none`. O lockup (HomeHeroLockup) fica acima destas
 * camadas via z-index do parent.
 */
export function HomeHeroBackground({
  heroImageUrl,
  businessName,
}: HomeHeroBackgroundProps) {
  const hasHero = Boolean(heroImageUrl && heroImageUrl.length > 0);
  const optimizedSources = hasHero
    ? getOptimizedSourcesForDefault(heroImageUrl)
    : null;

  return (
    <>
      {/* 1. Base sempre dark */}
      <div
        data-testid="home-hero-bg-cinematic"
        aria-hidden="true"
        className="hero-bg-cinematic pointer-events-none absolute inset-0"
      />

      {/* 2. Mesh brand-tinted — sempre presente; standalone no empty state */}
      <div
        data-testid="home-hero-mesh"
        aria-hidden="true"
        className="hero-mesh pointer-events-none absolute inset-0"
      />

      {/* 3. Foto opcional com color-grading cinematic */}
      {hasHero && heroImageUrl && optimizedSources ? (
        <picture
          data-testid="home-hero-picture"
          className="pointer-events-none absolute inset-0"
        >
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
            alt={`Hero — ${businessName}`}
            fetchPriority="high"
            className="hero-photo-grade hero-photo-mask-right absolute inset-0 size-full object-cover object-center"
          />
        </picture>
      ) : hasHero && heroImageUrl ? (
        <div
          data-testid="home-hero-picture"
          className="pointer-events-none absolute inset-0"
        >
          <Image
            src={heroImageUrl}
            alt={`Hero — ${businessName}`}
            fill
            sizes="100vw"
            className="hero-photo-grade hero-photo-mask-right object-cover object-center"
            placeholder="empty"
            priority
            fetchPriority="high"
            unoptimized
          />
        </div>
      ) : (
        <div
          data-testid="home-hero-empty-state"
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
        />
      )}

      {/* 4. Vignette */}
      <div
        aria-hidden="true"
        className="hero-vignette pointer-events-none absolute inset-0"
      />

      {/* 5. Scrim lockup — Fix pass 1: garante leitura do H1 em
          fotos default extra-claras. Gradient esquerda→meio em
          desktop, top→bottom em mobile. */}
      <div
        data-testid="home-hero-scrim-lockup"
        aria-hidden="true"
        className="hero-scrim-lockup pointer-events-none absolute inset-0"
      />

      {/* 6. Pattern dots — atmosphere */}
      <div
        data-testid="home-hero-pattern"
        aria-hidden="true"
        className="hero-pattern-dots pointer-events-none absolute inset-0"
      />
    </>
  );
}
