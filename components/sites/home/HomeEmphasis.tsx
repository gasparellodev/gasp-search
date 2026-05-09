import "server-only";

import Image from "next/image";

import type { SiteVariables } from "@/types/lead-site";

interface HomeEmphasisProps {
  /** `SiteVariables.emphasis` — destaque semanal. */
  emphasis: SiteVariables["emphasis"];
}

/**
 * Bloco "Em destaque" da Home (Phase 7 — issue #162).
 *
 * Server Component. Layout 2-cols: imagem à esquerda, card alabaster
 * (`rounded-[25px]`) à direita com title (`emphasis.title`),
 * `car_name` em Poppins SemiBold 24px e `description` em
 * `whitespace-pre-line` (preserva line-breaks da IA sem injetar HTML).
 *
 * **Anti-XSS** (per spec §13): nenhum uso de `dangerouslySetInnerHTML`
 * ou `react-markdown`. Line-breaks vêm do CSS, não de
 * markup interpretado.
 */
export function HomeEmphasis({ emphasis }: HomeEmphasisProps) {
  return (
    <section
      data-testid="home-emphasis"
      className="w-full bg-background"
      aria-labelledby="home-emphasis-title"
    >
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-stretch gap-6 px-4 py-12 md:grid-cols-2 md:gap-10 md:px-8 md:py-16">
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[25px] bg-foreground/5 md:aspect-auto">
          <Image
            src={emphasis.image_url}
            alt={`Destaque — ${emphasis.car_name}`}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover"
            unoptimized
          />
        </div>

        <div className="flex flex-col justify-center gap-4 rounded-[25px] bg-foreground/[0.04] p-8 md:p-10">
          <h2
            id="home-emphasis-title"
            className="text-base font-medium uppercase tracking-[0.18em] text-foreground/60"
          >
            {emphasis.title}
          </h2>
          <p className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
            {emphasis.car_name}
          </p>
          <p className="whitespace-pre-line text-base leading-relaxed text-foreground/80">
            {emphasis.description}
          </p>
        </div>
      </div>
    </section>
  );
}
