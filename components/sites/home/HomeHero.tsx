import "server-only";

import { ChevronDown } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { sanitizeHex } from "@/lib/sites/sanitize";
import { resolveHeroImageUrl } from "@/lib/sites/site-assets";

interface HomeHeroProps {
  /** Nome do negócio (usado no alt da imagem hero). */
  business_name: string;
  /** Slogan canônico — vira o `<h1>` da Home. */
  slogan: string;
  /** URL/path da imagem hero (cutout transparente). Cai em demo cutout quando ausente. */
  hero_image_url: string | null | undefined;
  /** Cor primária do site (hex sanitizado) — bg do CTA pill (vermelho da marca). */
  primary_color: string;
  /** Cor de texto sobre primário — texto do CTA pill. */
  text_on_primary: string;
  /** Slug do site, usado pra construir o href do CTA. */
  slug: string;
}

/**
 * Hero da Home (Phase 7 — Figma-fiel light, decisão final 2026-05-09).
 *
 * Server Component. **Hero NÃO É dark card** (correção 12:06 — minha leitura
 * anterior do Figma estava errada). Layout 2-cols com fundo branco
 * (`bg-background`), slogan `<h1>` em preto à esquerda + CTA pill vermelho
 * (`primary_color` do lead). À direita: cutout do carro (transparent PNG,
 * `object-contain`) sobre o fundo branco. Mobile: stack vertical.
 *
 * Os únicos dark cards do site público estão em:
 *   - HomeEmphasis right side ("Destaque semanal")
 *   - AboutSection Missão/Visão/Valores
 */
export function HomeHero({
  business_name,
  slogan,
  hero_image_url,
  primary_color,
  text_on_primary,
  slug,
}: HomeHeroProps) {
  const safePrimary = sanitizeHex(primary_color);
  const safeTextOnPrimary = sanitizeHex(text_on_primary);
  const carImage = resolveHeroImageUrl(hero_image_url);

  return (
    <section
      data-testid="home-hero"
      className="w-full bg-background"
    >
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-8 px-4 py-10 md:grid-cols-[1fr_1.5fr] md:gap-12 md:px-8 md:py-16 lg:gap-16 lg:py-20">
        <div className="flex flex-col items-start gap-8 md:gap-10">
          <h1
            className="font-bold leading-[0.95] tracking-tight text-foreground"
            style={{ fontSize: "clamp(2.5rem, 7vw, 5rem)" }}
          >
            {slogan}
          </h1>
          <Link
            href={`/sites/${slug}/estoque`}
            data-testid="home-hero-cta"
            style={{
              backgroundColor: safePrimary,
              color: safeTextOnPrimary,
            }}
            className="inline-flex h-14 items-center justify-center rounded-full px-8 text-base font-medium transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30"
          >
            Acessar estoque completo
          </Link>
        </div>

        <div className="relative aspect-[4/3] w-full md:aspect-auto md:h-[520px] lg:h-[600px]">
          <Image
            src={carImage}
            alt={`Hero — ${business_name}`}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-contain object-center"
            priority
            unoptimized
          />
        </div>
      </div>

      <div
        aria-hidden
        data-testid="home-hero-scroll-cue"
        className="flex justify-center pb-4 md:pb-6"
      >
        <ChevronDown className="size-5 text-foreground/40" />
      </div>
    </section>
  );
}
