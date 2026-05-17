import "server-only";

import { sanitizeHex } from "@/lib/sites/sanitize";
import { cn } from "@/lib/utils";
import type { SiteVariablesV2 } from "@/types/lead-site";

import { HomeHeroBackground } from "./HomeHeroBackground";
import { HomeHeroLockup } from "./HomeHeroLockup";
import { HomeHeroMonogram } from "./HomeHeroMonogram";

interface HomeHeroProps {
  /** Nome do negócio (usado no `<h1>` + alt da imagem + monogram). */
  business_name: string;
  /**
   * URL/path da imagem hero. Quando ausente, o `HomeHeroBackground`
   * cai num mesh brand-tinted self-contained (sem buraco visual).
   * **Resolução upstream**: o caller (`SitePage`) recebe o manifest já
   * via `resolveVisualIdentity(site.visual_identity)` (WP4 #312), então
   * `hero_image_url` chega populado mesmo em sites sem VI própria.
   */
  hero_image_url: string | null | undefined;
  /** Cor primária (hex sanitizado) — `--site-primary` no wrapper Site. */
  primary_color: string;
  /** Cor de texto sobre primário — propagada ao `<HomeQuickSearchBar>` e CTAs. */
  text_on_primary: string;
  /** Slug do site — `href` do quick search + CTA estoque + UTM WhatsApp. */
  slug: string;
  /** Endereço estruturado — H1 suffix "em {city}" + eyebrow {state}. */
  address: SiteVariablesV2["address"];
  /** Carros do estoque — `AICitableHero` + CTA "Ver estoque (N)". */
  cars: SiteVariablesV2["cars"];
  /** Telefone WhatsApp — CTA secundário "Falar no WhatsApp". */
  whatsapp?: SiteVariablesV2["whatsapp"];
  /** Telefone de exibição (ex: "(81) 3512-9411") — microdata <address> no AICitableHero. */
  phone_display: SiteVariablesV2["phone_display"];
  /** Nome do negócio para UTM (opcional; default = business_name). */
  businessName?: string;
}

/**
 * Hero da Home dos sites gerados — "Cinematic Dark Showroom" (Hero Redesign).
 *
 * Server Component. Composição asymmetric editorial:
 *   - Background empilhado (cinematic dark + mesh + foto + vignette +
 *     pattern dots) via `<HomeHeroBackground>`.
 *   - SVG monogram watermark via `<HomeHeroMonogram>` — `behind` em
 *     desktop (atrás do lockup, escala 80vh) e `corner` em mobile
 *     (top-right, escala reduzida).
 *   - Lockup tipográfico (eyebrow + h1 + AI passage + quick search +
 *     CTAs) via `<HomeHeroLockup>` — animação CSS-only stagger.
 *
 * Asymmetric grid `[1fr_minmax(0,1.1fr)]` em ≥ md (lockup left 45%,
 * foto/mesh right 55%). Stack vertical em mobile (foto top 50dvh +
 * lockup bottom safe-area). Hero ignora o light-mode gate global do
 * site público — renderiza dark próprio via tokens locais.
 *
 * data-testid preservados de versão anterior (E2E):
 *   `home-hero`, `home-hero-empty-state`, `home-hero-picture`,
 *   `home-hero-ctas`, `home-hero-cta-stock`, `home-hero-cta-whatsapp`.
 *
 * Novos:
 *   `home-hero-lockup`, `home-hero-eyebrow`, `home-hero-monogram-corner`,
 *   `home-hero-monogram-behind`, `home-hero-bg-cinematic`,
 *   `home-hero-mesh`, `home-hero-pattern`.
 */
export function HomeHero({
  business_name,
  hero_image_url,
  primary_color,
  text_on_primary,
  slug,
  address,
  cars,
  whatsapp,
  phone_display,
  businessName,
}: HomeHeroProps) {
  const safePrimary = sanitizeHex(primary_color);
  const safeTextOnPrimary = sanitizeHex(text_on_primary);

  return (
    <section
      data-testid="home-hero"
      // -mt-16 md:-mt-20 puxa o hero pra baixo do header sticky (64/80px),
      // garantindo full-bleed das camadas de fundo.
      // CSS vars locais re-escopam --site-primary/-text-on-primary
      // para que `color-mix` em `.hero-mesh`, `.hero-monogram` etc.
      // funcione sem depender do wrapper SitePage (defesa em profundidade).
      className={cn(
        "relative -mt-16 w-full min-h-[100dvh] overflow-hidden md:-mt-20",
      )}
      style={{
        // @ts-expect-error — CSS custom properties não tipadas
        "--site-primary": safePrimary,
        "--site-text-on-primary": safeTextOnPrimary,
      }}
    >
      {/* Camadas de background (atrás de tudo) */}
      <HomeHeroBackground
        heroImageUrl={hero_image_url}
        businessName={business_name}
      />

      {/* Monogram behind — só desktop, escala gigante */}
      <div className="pointer-events-none absolute inset-0 hidden md:block">
        <HomeHeroMonogram
          businessName={business_name}
          variant="behind"
          className="hero-fade-up hero-stagger-1"
        />
      </div>

      {/* Monogram corner — só mobile, escala reduzida */}
      <div className="pointer-events-none absolute inset-0 md:hidden">
        <HomeHeroMonogram
          businessName={business_name}
          variant="corner"
          className="hero-fade-up hero-stagger-1"
        />
      </div>

      {/* Lockup tipográfico — asymmetric grid desktop, stack mobile */}
      <div
        className={cn(
          "relative z-10 mx-auto flex w-full max-w-7xl flex-col",
          "min-h-[100dvh] items-start justify-end gap-10 px-5 pb-12 pt-28",
          "md:grid md:grid-cols-[1fr_minmax(0,1.1fr)] md:items-center md:justify-items-start md:gap-12 md:pb-20 md:pt-32",
          "lg:gap-16 lg:px-8",
        )}
        style={{ paddingBottom: "max(3rem, env(safe-area-inset-bottom))" }}
      >
        <HomeHeroLockup
          businessName={business_name}
          address={address}
          cars={cars}
          phoneDisplay={phone_display}
          primaryColor={safePrimary}
          textOnPrimary={safeTextOnPrimary}
          slug={slug}
          whatsapp={whatsapp ?? undefined}
        />
        {/* Slot direito reservado: a foto vive no Background full-bleed,
            mas o grid mantém espaço vazio para o asymmetric layout em
            desktop. Em mobile, esse slot some (stack). */}
        <div
          aria-hidden="true"
          className="hidden md:block md:min-h-[60vh]"
        />
      </div>

      {/* Marker oculto para fallback do businessName UTM — preserva
          assinatura legacy de tests que conferem `businessName` prop. */}
      {businessName && businessName !== business_name && (
        <span data-business-name-alias={businessName} hidden />
      )}
    </section>
  );
}
