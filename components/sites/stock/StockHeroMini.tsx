import "server-only";

import type { SiteVariablesV2 } from "@/types/lead-site";

import { AICitableHero } from "../AICitableHero";

interface StockHeroMiniProps {
  variables: SiteVariablesV2;
}

export function StockHeroMini({ variables }: StockHeroMiniProps) {
  return (
    <section
      data-testid="stock-hero-mini"
      className="relative min-h-[30dvh] overflow-hidden bg-[linear-gradient(135deg,var(--auto-primary,#0a0a0a),#111827)] text-[var(--auto-on-primary,#fafafa)] [&_[data-testid=ai-citable-hero]]:text-current/80"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgb(255_255_255_/_0.18),transparent_32%)]" />
      <div className="relative mx-auto flex min-h-[30dvh] max-w-7xl flex-col justify-end px-4 pb-10 pt-24 md:px-8 md:pb-12">
        <h1 className="max-w-4xl text-5xl font-semibold leading-none tracking-normal md:text-7xl">
          Nosso Estoque
        </h1>
        <AICitableHero
          variables={{
            business_name: variables.business_name,
            address: variables.address,
            cars: variables.cars,
          }}
          page="estoque"
        />
        <p className="mt-4 text-sm font-medium text-current/80 md:text-base">
          {variables.cars.length} carros disponíveis
        </p>
      </div>
    </section>
  );
}
