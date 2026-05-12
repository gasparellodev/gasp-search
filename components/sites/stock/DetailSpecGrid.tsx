import "server-only";

import type { SiteCar } from "@/types/lead-site";

interface DetailSpecGridProps {
  car: SiteCar;
}

const KM = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 0,
});

const DATASHEET_ALLOWLIST = [/^motor$/i, /^cilindradas$/i, /^final.*placa$/i];

interface SpecItem {
  label: string;
  value: string;
}

export function DetailSpecGrid({ car }: DetailSpecGridProps) {
  const items = buildSpecItems(car);

  if (items.length === 0) return null;

  return (
    <section className="mt-12 md:mt-16" aria-labelledby="detail-spec-grid-title">
      <h2
        id="detail-spec-grid-title"
        className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl"
      >
        Ficha técnica
      </h2>
      <dl
        data-testid="detail-spec-grid"
        className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-[var(--auto-radius-md,8px)] border border-foreground/10 bg-foreground/10 md:grid-cols-3 lg:grid-cols-4"
      >
        {items.map((item) => (
          <div
            key={item.label}
            data-testid="detail-spec-item"
            className="min-h-24 bg-background p-4"
          >
            <dt className="text-xs font-medium uppercase text-foreground/55">
              {item.label}
            </dt>
            <dd className="mt-2 text-base font-medium text-foreground">
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function buildSpecItems(car: SiteCar): SpecItem[] {
  const items: SpecItem[] = [
    { label: "Marca", value: car.brand },
    { label: "Modelo", value: car.model },
    { label: "Ano", value: String(car.year) },
    { label: "Quilometragem", value: `${KM.format(car.km)} km` },
    { label: "Combustível", value: car.fuel },
    { label: "Câmbio", value: car.transmission },
    { label: "Cor", value: car.color },
  ];

  if (car.doors) {
    items.push({ label: "Portas", value: `${car.doors} portas` });
  }
  if (car.category) {
    items.push({ label: "Categoria", value: car.category });
  }

  for (const [label, value] of car.datasheet) {
    if (DATASHEET_ALLOWLIST.some((pattern) => pattern.test(label))) {
      items.push({ label, value });
    }
  }

  return items;
}
