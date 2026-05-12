import "server-only";

import type { SiteCar, SiteVariablesV2 } from "@/types/lead-site";

import { SiteForm } from "../SiteForm";

import { DetailBreadcrumb } from "./DetailBreadcrumb";
import { DetailGalleryCinema } from "./DetailGalleryCinema";
import { DetailInfoBlock } from "./DetailInfoBlock";
import { DetailPriceBlock } from "./DetailPriceBlock";
import { DetailSpecGrid } from "./DetailSpecGrid";

type CarDetailVariables = Pick<
  SiteVariablesV2,
  | "business_name"
  | "business_slug"
  | "whatsapp"
  | "phone_display"
  | "brand_assets"
  | "address"
  | "cars"
>;

interface CarDetailSectionProps {
  variables: CarDetailVariables;
  car: SiteCar;
  siteId: string;
  slug: string;
}

/**
 * Section principal da rota `/sites/[slug]/estoque/[carSlug]` (Phase 7 —
 * issue #164, D1 refinado em #226). Server Component (com
 * `<DetailGalleryCinema>` e `<SiteForm>` client aninhados).
 *
 * Layout:
 *   - Breadcrumb visual shared (`<Breadcrumb>`).
 *   - Gallery cinema scroll-snap + lightbox Radix.
 *   - Info: model+year, GEO passage, badges e descrição.
 *   - Bloco de preço sticky (`<DetailPriceBlock>`): parcela, calculadora,
 *     selos e CTAs WhatsApp.
 *   - Spec grid híbrido top-level + datasheet permitido.
 *   - `<SiteForm variant="car-detail" prefillModel="<brand> <model>">` inline.
 *
 * Per spec §13: zero `dangerouslySetInnerHTML`. URLs externas com
 * `target="_blank" rel="noopener noreferrer"`.
 */
export function CarDetailSection({
  variables,
  car,
  siteId,
  slug,
}: CarDetailSectionProps) {
  const prefillModel = `${car.brand} ${car.model}`;

  return (
    <section data-testid="car-detail-section" className="w-full bg-background">
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-8 md:py-12">
        <DetailBreadcrumb
          slug={slug}
          brand={car.brand}
          model={car.model}
          year={car.year}
        />

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.75fr)] lg:gap-10">
          <DetailGalleryCinema car={car} />

          <aside className="flex flex-col gap-6 lg:self-start">
            <DetailInfoBlock
              variables={{
                business_name: variables.business_name,
                address: variables.address,
                cars: variables.cars,
              }}
              car={car}
            />

            <DetailPriceBlock
              variables={{
                business_name: variables.business_name,
                business_slug: variables.business_slug,
                whatsapp: variables.whatsapp,
              }}
              car={car}
            />
          </aside>
        </div>

        <DetailSpecGrid car={car} />

        <div className="mt-16 md:mt-20">
          <SiteForm
            siteId={siteId}
            slug={slug}
            variant="car-detail"
            prefillModel={prefillModel}
            primary_color={variables.brand_assets.primary_color}
            text_on_primary={variables.brand_assets.text_on_primary}
            title="Tem interesse nesse veículo?"
          />
        </div>
      </div>
    </section>
  );
}
