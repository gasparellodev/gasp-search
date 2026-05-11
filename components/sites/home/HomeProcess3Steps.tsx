import "server-only";

import { PROCESS_STEPS_TEMPLATE } from "@/lib/sites/process-steps-template";

/**
 * Process / "Como funciona" — 3 steps horizontais (Phase 7 / Sprint 4 /
 * #H3 — issue #223).
 *
 * Layout: 3 cards horizontais (desktop) / stack vertical (mobile). Cada
 * card: ícone Lucide + h3 + body 2-3 linhas. Conteúdo hardcoded em
 * `lib/sites/process-steps-template.ts` (single source of truth PT-BR).
 *
 * Server Component. Sem state — render estático.
 */
export function HomeProcess3Steps() {
  return (
    <section
      data-testid="home-process-3steps"
      aria-label="Como funciona"
      className="w-full bg-foreground/[0.02] py-16 md:py-24"
    >
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <header className="mb-10 flex flex-col gap-3 text-center md:mb-14">
          <p
            className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground/60"
            aria-hidden="true"
          >
            Como funciona
          </p>
          <h2
            className="font-bold leading-tight tracking-tight text-foreground"
            style={{ fontSize: "clamp(1.875rem, 4vw, 3rem)" }}
          >
            Comprar o seu próximo carro em 3 passos
          </h2>
        </header>

        <ol
          className="grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-8"
          role="list"
        >
          {PROCESS_STEPS_TEMPLATE.map((step, idx) => {
            const Icon = step.icon;
            return (
              <li
                key={step.title}
                className="flex flex-col gap-4 rounded-2xl border border-foreground/10 bg-background p-6 md:p-8"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="flex size-12 items-center justify-center rounded-xl"
                    style={{
                      backgroundColor: "var(--site-primary)",
                      color: "var(--site-text-on-primary)",
                    }}
                  >
                    <Icon className="size-6" aria-hidden="true" />
                  </div>
                  <span
                    className="text-sm font-semibold tabular-nums text-foreground/50"
                    aria-hidden="true"
                  >
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                </div>
                <h3 className="text-xl font-semibold tracking-tight text-foreground md:text-2xl">
                  {step.title}
                </h3>
                <p className="text-sm text-foreground/70 md:text-base">
                  {step.body}
                </p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
