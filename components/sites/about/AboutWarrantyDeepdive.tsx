import "server-only";

import { Headphones, Search, ShieldCheck } from "lucide-react";

import {
  WARRANTY_PROCESS,
  type WarrantyProcessIcon,
} from "@/lib/sites/warranty-process";

const ICONS = {
  Search,
  ShieldCheck,
  Headphones,
} satisfies Record<WarrantyProcessIcon, typeof Search>;

/**
 * Deep-dive de garantia da página Sobre (#229).
 *
 * O `id="garantia"` é um contrato público de deep-link. O scroll margin
 * compensa o header glass-sticky de 80px.
 */
export function AboutWarrantyDeepdive() {
  return (
    <section
      id="garantia"
      data-testid="about-warranty-deepdive"
      className="scroll-mt-20 bg-foreground/[0.02] py-16 md:scroll-mt-20 md:py-24"
    >
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <header className="mx-auto mb-10 max-w-3xl text-center md:mb-14">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-foreground/55">
            Compra segura
          </p>
          <h2
            className="mt-3 font-bold leading-tight text-foreground"
            style={{ fontSize: "clamp(2rem, 4vw, 3.25rem)" }}
          >
            Garantia e pós-venda sem surpresa
          </h2>
          <p className="mt-4 text-base leading-relaxed text-foreground/70 md:text-lg">
            O processo de entrega combina vistoria, documentação e
            atendimento direto para que cada compra saia com procedência
            clara.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {WARRANTY_PROCESS.map((step) => {
            const Icon = ICONS[step.icon];
            return (
              <article
                key={step.title}
                className="rounded-site-feature border border-foreground/10 bg-background p-7 shadow-sm md:p-8"
              >
                <div className="mb-6 flex size-12 items-center justify-center rounded-full bg-foreground text-background">
                  <Icon className="size-6" aria-hidden="true" />
                </div>
                <h3 className="text-xl font-semibold text-foreground">
                  {step.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-foreground/70 md:text-base">
                  {step.body}
                </p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
