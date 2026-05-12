import "server-only";

import type { SiteVariablesV2 } from "@/types/lead-site";

type AboutMissionVisionVariables = Pick<
  SiteVariablesV2,
  "mission" | "vision" | "values"
>;

interface AboutMissionVisionProps {
  variables: AboutMissionVisionVariables;
}

/**
 * Missão, visão e valores da página Sobre (#229).
 *
 * O conteúdo vem direto de `SiteVariablesV2`; o schema já garante os
 * mínimos de copy, então não há fallback hardcoded neste componente.
 */
export function AboutMissionVision({ variables }: AboutMissionVisionProps) {
  return (
    <section className="w-full bg-background py-16 md:py-24">
      <div
        data-testid="about-mission-vision"
        className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 md:grid-cols-3 md:px-8"
      >
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

        <article
          data-testid="about-values"
          className="rounded-site-feature bg-site-surface-feature p-8 text-site-text-on-feature md:p-10"
        >
          <h2 className="text-sm font-medium uppercase tracking-[0.18em] text-site-text-on-feature/60">
            Valores
          </h2>
          <ul className="mt-4 space-y-3 text-base leading-relaxed text-site-text-on-feature/90 md:text-lg">
            {variables.values.map((value) => (
              <li key={value} className="flex items-start gap-3">
                <span
                  aria-hidden="true"
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
