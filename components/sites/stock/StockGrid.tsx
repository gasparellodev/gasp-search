import { CarCard } from "@/components/sites/cars/CarCard";
import type { SiteCar } from "@/types/lead-site";

interface StockGridProps {
  /** Carros já filtrados/ordenados/paginados pelo parent. */
  cars: ReadonlyArray<SiteCar>;
  /** Slug do site, usado pra construir o href de cada card. */
  slug: string;
  /** Telefone do WhatsApp para CTA inline do card compartilhado. */
  whatsappPhone: string;
  /** Nome do negócio para template de WhatsApp. */
  businessName: string;
}

/**
 * Grid de cards de carros (Phase 7 — issue #164, refactor #225).
 *
 * Renderiza cards via `<CarCard>` compartilhado para manter anatomia,
 * WhatsApp inline e raio 8px consistentes entre Home, Estoque e Detalhe.
 */
export function StockGrid({
  cars,
  slug,
  whatsappPhone,
  businessName,
}: StockGridProps) {
  return (
    <ul
      data-testid="stock-grid"
      className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
    >
      {cars.map((car) => (
        <li key={car.slug}>
          <CarCard
            car={car}
            siteSlug={slug}
            whatsappPhone={whatsappPhone}
            businessName={businessName}
          />
        </li>
      ))}
    </ul>
  );
}
