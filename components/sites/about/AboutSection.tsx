import "server-only";

import Image from "next/image";

import type { SiteVariables } from "@/types/lead-site";

type AboutVariables = Pick<
  SiteVariables,
  | "about_text"
  | "brand_assets"
  | "mission"
  | "vision"
  | "values"
  | "business_name"
>;

interface AboutSectionProps {
  variables: AboutVariables;
}

/**
 * Section principal da rota `/sites/[slug]/sobre` (Phase 7 — issue #163).
 *
 * Server Component. Renderiza:
 *   - Hero com `brand_assets.about_image_url` e `<h1>` "Sobre a {business_name}".
 *   - Bloco texto longo: `about_text.split('\n\n')` em parágrafos
 *     separados (nunca `dangerouslySetInnerHTML`).
 *   - 3 cards Mission/Vision/Values em grid (1-col mobile, 3-col desktop).
 *   - Lista `<ul>` de `values` dentro do card "Valores".
 *
 * **Anti-XSS (per spec §13)**: zero uso de `dangerouslySetInnerHTML`
 * e zero `react-markdown`. Os parágrafos vêm do split do texto IA,
 * renderizados como children React seguros.
 *
 * **v2 (issue #197)**: `about_image_url` migrou de root para
 * `brand_assets.about_image_url`. Acesso via destructuring no topo.
 */
export function AboutSection({ variables }: AboutSectionProps) {
  const paragraphs = variables.about_text.split("\n\n").filter(Boolean);
  const aboutImageUrl = variables.brand_assets.about_image_url;

  return (
    <section data-testid="about-section" className="w-full bg-background">
      <div className="mx-auto max-w-7xl px-4 py-12 md:px-8 md:py-20">
        {/* Hero */}
        <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-2 md:gap-12 lg:gap-16">
          <div className="flex flex-col gap-6">
            <h1
              className="font-bold leading-[1.05] tracking-tight text-foreground"
              style={{ fontSize: "clamp(2.5rem, 6vw, 4.5rem)" }}
            >
              Sobre a {variables.business_name}
            </h1>
            <div className="space-y-4 text-base leading-relaxed text-foreground/80 md:text-lg">
              {paragraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </div>
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl bg-foreground/5 md:aspect-[5/4]">
            <Image
              src={aboutImageUrl}
              alt={`Sobre — ${variables.business_name}`}
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover"
              priority
              unoptimized
            />
          </div>
        </div>

        {/* Mission + Vision — 2 dark cards 2-cols (Figma About.png) */}
        <div className="mt-12 grid grid-cols-1 gap-6 md:mt-16 md:grid-cols-2 md:gap-8">
          <article
            data-testid="about-mission"
            className="rounded-site-feature bg-site-surface-feature p-8 text-site-text-on-feature md:p-10"
          >
            <h2 className="text-sm font-medium uppercase tracking-[0.18em] text-site-text-on-feature/60">
              Missão
            </h2>
            <p className="mt-4 text-base leading-relaxed text-site-text-on-feature/90 md:text-lg">
              {variables.mission}
            </p>
          </article>

          <article
            data-testid="about-vision"
            className="rounded-site-feature bg-site-surface-feature p-8 text-site-text-on-feature md:p-10"
          >
            <h2 className="text-sm font-medium uppercase tracking-[0.18em] text-site-text-on-feature/60">
              Visão
            </h2>
            <p className="mt-4 text-base leading-relaxed text-site-text-on-feature/90 md:text-lg">
              {variables.vision}
            </p>
          </article>
        </div>

        {/* Values — 1 dark wide card (Figma About.png) */}
        <article
          data-testid="about-values"
          className="mt-6 rounded-site-feature bg-site-surface-feature p-8 text-site-text-on-feature md:mt-8 md:p-10"
        >
          <h2 className="text-sm font-medium uppercase tracking-[0.18em] text-site-text-on-feature/60">
            Valores
          </h2>
          <ul className="mt-4 space-y-2 text-base leading-relaxed text-site-text-on-feature/90 md:text-lg">
            {variables.values.map((value) => (
              <li key={value} className="flex items-start gap-2">
                <span
                  aria-hidden
                  className="mt-2 inline-block size-1.5 flex-none rounded-full bg-site-text-on-feature/60"
                />
                <span>{value}</span>
              </li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  );
}
