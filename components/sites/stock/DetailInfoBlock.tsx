import "server-only";

import type { SiteCar, SiteVariablesV2 } from "@/types/lead-site";

import { AICitableHero } from "../AICitableHero";

type DetailInfoVariables = Pick<
  SiteVariablesV2,
  "business_name" | "address" | "cars"
>;

interface DetailInfoBlockProps {
  variables: DetailInfoVariables;
  car: SiteCar;
}

const KM = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 0,
});

export function DetailInfoBlock({ variables, car }: DetailInfoBlockProps) {
  return (
    <div data-testid="detail-info-block" className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1
          className="font-bold leading-[1.05] text-foreground"
          style={{ fontSize: "clamp(2.25rem, 5vw, 4.5rem)" }}
        >
          {car.model} <span className="text-foreground/60">{car.year}</span>
        </h1>
        <AICitableHero
          variables={variables}
          page="detalhe"
          currentCar={{
            brand: car.brand,
            model: car.model,
            year: car.year,
          }}
        />
      </header>

      <ul
        data-testid="detail-info-badges"
        className="flex flex-wrap gap-2 text-sm"
      >
        {[car.brand, `${KM.format(car.km)} km`, car.transmission, car.fuel, car.color].map(
          (badge) => (
            <li
              key={badge}
              className="rounded-full border border-foreground/15 px-3 py-1 text-foreground/80"
            >
              {badge}
            </li>
          ),
        )}
      </ul>

      <div>
        <h2 className="text-sm font-medium uppercase text-foreground/60">
          Descrição
        </h2>
        <p
          data-testid="detail-info-description"
          className="mt-3 whitespace-pre-line text-base leading-relaxed text-foreground/80 md:text-lg"
        >
          {car.description}
        </p>
      </div>
    </div>
  );
}
