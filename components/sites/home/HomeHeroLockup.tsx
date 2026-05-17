import "server-only";

import { buildWhatsAppLink } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";
import type { SiteVariablesV2 } from "@/types/lead-site";

import { AICitableHero } from "../AICitableHero";

import { HomeQuickSearchBar } from "./HomeQuickSearchBar";

interface HomeHeroLockupProps {
  businessName: string;
  address: SiteVariablesV2["address"];
  cars: SiteVariablesV2["cars"];
  phoneDisplay: SiteVariablesV2["phone_display"];
  primaryColor: string;
  textOnPrimary: string;
  slug: string;
  whatsapp?: SiteVariablesV2["whatsapp"];
}

/**
 * Lockup tipográfico do hero "Cinematic Dark Showroom" (Hero Redesign).
 *
 * Server Component. Compositor puro: recebe dados, renderiza
 * hierarquia eyebrow → H1 → AI passage → quick search → CTAs. Não
 * gerencia layout do hero (asymmetric grid ou stack) — isso é
 * responsabilidade do parent (`HomeHero`).
 *
 * Animação: cada bloco recebe `.hero-fade-up` + `.hero-stagger-N`
 * (CSS-only via keyframes, motion-safe).
 *
 * `<HomeQuickSearchBar>` é ilha client; AICitableHero é server.
 */
export function HomeHeroLockup({
  businessName,
  address,
  cars,
  phoneDisplay,
  primaryColor,
  textOnPrimary,
  slug,
  whatsapp,
}: HomeHeroLockupProps) {
  const heroH1 = address?.city
    ? `${businessName} — Carros seminovos em ${address.city}`
    : `${businessName} — Carros seminovos`;

  const eyebrow = address?.state
    ? `Showroom Premium · ${address.state}`
    : "Showroom Premium · Seminovos";

  const carsCount = cars?.length ?? 0;
  const whatsappHref = whatsapp
    ? buildWhatsAppLink({
        template: "general",
        phone: whatsapp,
        businessName,
        siteSlug: slug,
        component: "home-cta",
      })
    : null;

  return (
    <div
      data-testid="home-hero-lockup"
      className="flex flex-col gap-6 text-white md:gap-8"
    >
      {/* Eyebrow */}
      <p
        data-testid="home-hero-eyebrow"
        className={cn("hero-eyebrow-luxe hero-fade-up hero-stagger-1")}
      >
        {eyebrow}
      </p>

      {/* H1 */}
      <h1
        className={cn(
          "as-h1 hero-fade-up hero-stagger-2",
          "text-white [text-shadow:0_2px_24px_rgb(0_0_0_/_0.45)]",
        )}
      >
        {heroH1}
      </h1>

      {/* AI passage (citable) — render em white/80, sobrescreve muted-foreground default */}
      <div
        className={cn(
          "hero-fade-up hero-stagger-3",
          "max-w-xl text-base text-white/80 [&_*]:!text-white/80 md:text-lg",
        )}
      >
        <AICitableHero
          variables={{
            business_name: businessName,
            address,
            cars,
            phone_display: phoneDisplay,
          }}
          page="home"
        />
      </div>

      {/* Quick search */}
      <div
        className={cn("hero-fade-up hero-stagger-3", "max-w-2xl")}
      >
        <HomeQuickSearchBar
          slug={slug}
          primary_color={primaryColor}
          text_on_primary={textOnPrimary}
        />
      </div>

      {/* CTAs */}
      {(carsCount > 0 || whatsappHref) && (
        <div
          data-testid="home-hero-ctas"
          className={cn(
            "hero-fade-up hero-stagger-4",
            "flex flex-col gap-3 sm:flex-row sm:gap-4",
          )}
        >
          {carsCount > 0 && (
            <a
              href={`/sites/${slug}/estoque`}
              data-testid="home-hero-cta-stock"
              className={cn(
                "hero-cta-primary as-btn-lift",
                "inline-flex h-12 items-center justify-center rounded-full px-7 text-sm font-semibold",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70",
              )}
            >
              Ver estoque ({carsCount} {carsCount === 1 ? "carro" : "carros"})
            </a>
          )}
          {whatsappHref && (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="home-hero-cta-whatsapp"
              className={cn(
                "hero-cta-ghost",
                "inline-flex h-12 items-center justify-center rounded-full px-7 text-sm font-semibold",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70",
              )}
            >
              Falar no WhatsApp
            </a>
          )}
        </div>
      )}
    </div>
  );
}
