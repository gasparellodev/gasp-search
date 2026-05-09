import "server-only";

import Image from "next/image";
import Link from "next/link";

import { sanitizeHex } from "@/lib/sites/sanitize";

interface HomeHeroProps {
  /** Nome do negócio (usado no alt da imagem hero). */
  business_name: string;
  /** Slogan canônico — vira o `<h1>` da Home. */
  slogan: string;
  /** URL da imagem hero (CDN do brand-pipeline). */
  hero_image_url: string;
  /** Cor primária do site (hex sanitizado) — bg do CTA pill. */
  primary_color: string;
  /** Cor de texto sobre primário — texto do CTA pill. */
  text_on_primary: string;
  /** Slug do site, usado pra construir o href do CTA. */
  slug: string;
}

/**
 * Hero da Home (Phase 7 — issue #162).
 *
 * Server Component. Layout 2-cols desktop (texto à esquerda, imagem à
 * direita) e stack vertical no mobile. O slogan é renderizado num `<h1>`
 * com tipografia Poppins Bold ~105px desktop (clamp 56-105px no mobile).
 *
 * O CTA pill usa `--site-primary` via `style` inline (sanitizado) — a
 * cor é a chave visual do brand do lead, então preferimos o caminho mais
 * robusto pra Tailwind v4 (style inline ao invés de `bg-[var(...)]`).
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

  return (
    <section
      data-testid="home-hero"
      className="w-full bg-background"
    >
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-10 px-4 py-12 md:grid-cols-2 md:gap-12 md:px-8 md:py-20 lg:gap-16">
        <div className="flex flex-col items-start gap-8 md:gap-10">
          <h1
            className="font-bold leading-[0.95] tracking-tight text-foreground"
            style={{ fontSize: "clamp(3.5rem, 9vw, 6.5rem)" }}
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

        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl bg-foreground/5 md:aspect-[5/4]">
          <Image
            src={hero_image_url}
            alt={`Hero — ${business_name}`}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover"
            priority
            unoptimized
          />
        </div>
      </div>
    </section>
  );
}
