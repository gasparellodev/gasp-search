import "server-only";

import Link from "next/link";

import { buildWhatsAppLink } from "@/lib/whatsapp";
import type { SiteCar, SiteVariablesV2 } from "@/types/lead-site";

import { SiteForm } from "../SiteForm";

import { CarGallery } from "./CarGallery";

type CarDetailVariables = Pick<
  SiteVariablesV2,
  | "business_name"
  | "business_slug"
  | "whatsapp"
  | "phone_display"
  | "brand_assets"
>;

interface CarDetailSectionProps {
  variables: CarDetailVariables;
  car: SiteCar;
  siteId: string;
  slug: string;
}

const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

const KM = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 0,
});

/**
 * Section principal da rota `/sites/[slug]/estoque/[carSlug]` (Phase 7 —
 * issue #164). Server Component (com `<CarGallery>` e `<SiteForm>` client
 * aninhados).
 *
 * Layout:
 *   - Hero galeria via `<CarGallery>` (lightbox + thumbs).
 *   - Info: brand+model+year, badges (km, transmission, fuel, color) + price.
 *   - WhatsApp CTA: gerado via `buildWhatsAppLink` (template `vehicle`).
 *   - Description em `<p className="whitespace-pre-line">` (zero
 *     `dangerouslySetInnerHTML`).
 *   - Datasheet `<dl>` com cada `[label, value]` da `car.datasheet[]`.
 *   - Link "Voltar ao estoque".
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
  const whatsappHref = buildWhatsAppLink({
    template: "vehicle",
    phone: variables.whatsapp,
    businessName: variables.business_name,
    siteSlug: variables.business_slug,
    component: "car-detail",
    vehicle: {
      brand: car.brand,
      model: car.model,
      year: car.year,
      price: car.price,
      carSlug: car.slug,
    },
  });
  const galleryAlt = `${car.brand} ${car.model} ${car.year}`;
  const prefillModel = `${car.brand} ${car.model}`;

  return (
    <section data-testid="car-detail-section" className="w-full bg-background">
      <div className="mx-auto max-w-7xl px-4 py-12 md:px-8 md:py-20">
        <nav aria-label="Voltar" className="mb-6">
          <Link
            href={`/sites/${slug}/estoque`}
            className="inline-flex items-center text-sm text-foreground/70 transition hover:text-foreground"
          >
            ← Voltar ao estoque
          </Link>
        </nav>

        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 md:gap-12 lg:gap-16">
          <div>
            <CarGallery images={car.gallery_urls} alt={galleryAlt} />
          </div>
          <div className="flex flex-col gap-6">
            <header className="flex flex-col gap-2">
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-foreground/60">
                {car.brand}
              </p>
              <h1
                className="font-bold leading-[1.05] tracking-tight text-foreground"
                style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)" }}
              >
                {car.model} <span className="text-foreground/60">{car.year}</span>
              </h1>
            </header>

            <ul
              data-testid="car-detail-badges"
              className="flex flex-wrap gap-2 text-sm"
            >
              <li className="rounded-full border border-foreground/15 px-3 py-1">
                {KM.format(car.km)} km
              </li>
              <li className="rounded-full border border-foreground/15 px-3 py-1">
                {car.transmission}
              </li>
              <li className="rounded-full border border-foreground/15 px-3 py-1">
                {car.fuel}
              </li>
              <li className="rounded-full border border-foreground/15 px-3 py-1">
                {car.color}
              </li>
            </ul>

            <p
              data-testid="car-detail-price"
              className="text-3xl font-bold text-foreground md:text-4xl"
            >
              {car.price === null ? "Sob consulta" : BRL.format(car.price)}
            </p>

            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="car-detail-cta-whatsapp"
              aria-label={`Falar no WhatsApp sobre ${car.brand} ${car.model} ${car.year}`}
              className="inline-flex h-12 items-center justify-center rounded-full bg-foreground px-8 text-sm font-medium text-background transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40"
            >
              Falar no WhatsApp
            </a>

            <div className="mt-2">
              <h2 className="text-sm font-medium uppercase tracking-[0.18em] text-foreground/60">
                Descrição
              </h2>
              <p
                data-testid="car-detail-description"
                className="mt-3 whitespace-pre-line text-base leading-relaxed text-foreground/80 md:text-lg"
              >
                {car.description}
              </p>
            </div>
          </div>
        </div>

        {car.datasheet.length > 0 && (
          <section className="mt-16 md:mt-20">
            <h2 className="mb-6 text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
              Ficha técnica
            </h2>
            <dl
              data-testid="car-detail-datasheet"
              className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 md:grid-cols-3"
            >
              {car.datasheet.map(([label, value], idx) => (
                <div
                  // datasheet pode ter labels duplicadas; combinamos com idx.
                  key={`${label}-${idx}`}
                  className="flex flex-col gap-1 border-b border-foreground/10 pb-3"
                >
                  <dt className="text-xs font-medium uppercase tracking-[0.18em] text-foreground/60">
                    {label}
                  </dt>
                  <dd className="text-base text-foreground">{value}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

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
