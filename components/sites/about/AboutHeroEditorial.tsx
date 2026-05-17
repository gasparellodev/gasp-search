import "server-only";

import Image from "next/image";

import type { SiteVariablesV2 } from "@/types/lead-site";

const FALLBACK_ABOUT_IMAGE = "/assets/about/porsche-model.png";

type AboutHeroVariables = Pick<
  SiteVariablesV2,
  "about_text" | "address" | "brand_assets" | "business_name" | "slogan"
>;

interface AboutHeroEditorialProps {
  variables: AboutHeroVariables;
  manifestAboutUrl?: string | null;
}

function firstParagraph(text: string): string {
  return (
    text
      .split("\n\n")
      .find((paragraph) => paragraph.trim().length > 0)
      ?.trim() ?? text
  );
}

function resolveTagline(variables: AboutHeroVariables): string {
  if (variables.slogan && variables.slogan.trim().length > 0) {
    return variables.slogan;
  }
  if (variables.address?.city) {
    return `Concessionária de carros seminovos em ${variables.address.city}`;
  }
  return "Sua próxima compra de confiança.";
}

/**
 * Hero editorial da página Sobre (#229).
 *
 * Server Component. Mantém um único `<h1>` na rota, usa `dvh` para
 * evitar bugs de browser chrome mobile e renderiza copy IA como texto
 * React seguro, nunca HTML interpretado.
 */
export function AboutHeroEditorial({
  variables,
  manifestAboutUrl,
}: AboutHeroEditorialProps) {
  const aboutImageUrl =
    manifestAboutUrl ??
    (variables.brand_assets.about_image_url.length > 0
      ? variables.brand_assets.about_image_url
      : FALLBACK_ABOUT_IMAGE);
  const intro = firstParagraph(variables.about_text);
  const tagline = resolveTagline(variables);

  return (
    <section
      data-testid="about-hero-editorial"
      className="relative flex min-h-[50dvh] w-full items-end overflow-hidden bg-foreground text-background md:min-h-[60dvh]"
      aria-label={`Sobre ${variables.business_name}`}
    >
      <Image
        src={aboutImageUrl}
        alt={`Sobre — ${variables.business_name}`}
        fill
        priority
        sizes="100vw"
        className="object-cover"
        unoptimized
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-black/10"
      />
      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 pb-12 pt-28 md:px-8 md:pb-16">
        <p className="max-w-2xl text-sm font-medium uppercase tracking-[0.18em] text-white/75">
          {tagline}
        </p>
        <h1 className="as-h1 max-w-4xl text-white">
          Sobre a {variables.business_name}
        </h1>
        <p className="max-w-3xl text-base leading-relaxed text-white/85 md:text-xl">
          {intro}
        </p>
      </div>
    </section>
  );
}
