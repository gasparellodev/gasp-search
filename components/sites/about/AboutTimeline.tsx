import "server-only";

import { cn } from "@/lib/utils";

export interface TimelineEntry {
  year: number;
  title: string;
  description?: string;
}

interface AboutTimelineProps {
  entries: TimelineEntry[];
  businessName: string;
}

/**
 * Timeline vertical de marcos do negócio — página Sobre (#P5 reescopado).
 *
 * Server Component. Retorna `null` quando `entries` está vazio — nenhum
 * shell vazio no DOM. Schema deferred (variables.timeline ?? [] no caller).
 *
 * Animação via `data-reveal` conforme convenção de motion.ts (#290);
 * `prefers-reduced-motion` é honrado pela implementação client-side.
 */
export function AboutTimeline({ entries }: AboutTimelineProps) {
  if (entries.length === 0) return null;

  return (
    <section
      aria-labelledby="timeline-heading"
      className="w-full bg-background py-16 lg:py-24"
    >
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <header className="mb-12 lg:mb-16">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-foreground/55">
            Trajetória
          </p>
          <h2
            id="timeline-heading"
            className="mt-3 font-bold text-foreground"
            style={{ fontSize: "clamp(2rem, 4vw, 3.25rem)" }}
          >
            Nossa história
          </h2>
        </header>

        <ol
          data-reveal="timeline"
          className="relative border-l border-foreground/15"
          aria-label="Marcos da empresa"
        >
          {entries.map((entry, index) => (
            <li
              key={`${entry.year}-${index}`}
              data-reveal
              className={cn(
                "relative ml-8 pb-10 last:pb-0",
              )}
            >
              {/* Year marker dot */}
              <span
                aria-hidden="true"
                className="absolute -left-[2.625rem] flex size-5 items-center justify-center rounded-full border-2 border-foreground/20 bg-background"
              >
                <span className="size-2 rounded-full bg-foreground/60" />
              </span>

              {/* Year badge */}
              <time
                dateTime={String(entry.year)}
                className="mb-2 inline-block text-sm font-semibold uppercase tracking-[0.14em] text-foreground/50"
              >
                {entry.year}
              </time>

              {/* Card */}
              <div className="rounded-site-feature border border-foreground/10 bg-background p-6 shadow-sm md:p-8">
                <h3 className="text-lg font-semibold text-foreground md:text-xl">
                  {entry.title}
                </h3>
                {entry.description && (
                  <p className="mt-2 text-sm leading-relaxed text-foreground/70 md:text-base">
                    {entry.description}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
