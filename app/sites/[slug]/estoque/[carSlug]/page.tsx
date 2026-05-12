/**
 * Rota pública `/sites/[slug]/estoque/[carSlug]` (Phase 7 — issue #164).
 *
 * Detalhe de carro individual. Compartilha contrato de routing com
 * `/sites/[slug]` (#160) e demais sub-rotas (#163):
 *   - `null` (slug missing) → `notFound()`.
 *   - `draft` / `archived` → `notFound()`.
 *   - `published` / `sent` → busca o car via `cars.find(c => c.slug ===
 *     carSlug)`. Se `undefined` → `notFound()` (carro não está no
 *     estoque deste site).
 *   - Caso contrário → renderiza `<SitePage activePage="estoque">` com
 *     `<CarDetailSection>`.
 *
 * **`SiteVariables.safeParse`** antes do render — defesa em
 * profundidade.
 *
 * **`generateMetadata` dinâmico (#165)**: title `${business_name} —
 * ${car.brand} ${car.model} ${car.year}` (ex: "Touring Cars — Toyota
 * Corolla 2022"), OG/Twitter via `buildSiteMetadata` no happy path.
 * Fallback `noindex/nofollow` puro também quando `cars.find` retorna
 * undefined — `noindex/nofollow` PRESERVADO em todos os caminhos.
 */
import "server-only";

import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";

import { CarDetailSection } from "@/components/sites/stock/CarDetailSection";
import { FloatingInstallmentBar } from "@/components/sites/FloatingInstallmentBar";
import { SitePage } from "@/components/sites/SitePage";
import { SiteSchema } from "@/components/sites/seo/SiteSchema";
import { getSite } from "@/lib/sites/get-site";
import { buildSiteMetadata } from "@/lib/sites/metadata";
import { readSiteVariablesSafe } from "@/lib/sites/migrate-variables";
import { env } from "@/lib/env";
import { slugify } from "@/lib/utils/slug";
import {
  buildBreadcrumbSchema,
  buildVehicleSchema,
} from "@/lib/sites/schema";

interface PageProps {
  params: Promise<{ slug: string; carSlug: string }>;
}

const NOINDEX_FALLBACK: Metadata = {
  robots: { index: false, follow: false },
};

function legacyVehicleSlug(car: { brand: string; model: string; year: number }) {
  return slugify(`${car.brand} ${car.model} ${car.year}`);
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug, carSlug } = await params;
  const site = await getSite(slug);
  if (!site) return NOINDEX_FALLBACK;
  if (site.status === "draft" || site.status === "archived") {
    return NOINDEX_FALLBACK;
  }
  const parsed = readSiteVariablesSafe(site.variables);
  if (!parsed.success) return NOINDEX_FALLBACK;
  const car = parsed.data.cars.find((c) => c.slug === carSlug);
  if (!car) return NOINDEX_FALLBACK;
  return buildSiteMetadata({
    variables: parsed.data,
    pageLabel: `${car.brand} ${car.model} ${car.year}`,
    site,
    pathname: `/estoque/${carSlug}`,
    route: {
      kind: "detalhe",
      car: {
        brand: car.brand,
        model: car.model,
        year: car.year,
        km: car.km,
        price: car.price,
      },
    },
  });
}

export default async function CarDetailPage({ params }: PageProps) {
  const { slug, carSlug } = await params;
  const site = await getSite(slug);

  if (!site) notFound();
  if (site.status === "draft" || site.status === "archived") {
    notFound();
  }

  const parsed = readSiteVariablesSafe(site.variables);
  if (!parsed.success) {
    console.error("[site:render:carDetail] invalid variables", {
      slug,
      issuePaths: parsed.error.issues.map((i) => i.path.join(".")),
    });
    notFound();
  }

  const car = parsed.data.cars.find((c) => c.slug === carSlug);
  if (!car) {
    const legacyMatch = parsed.data.cars.find(
      (candidate) => legacyVehicleSlug(candidate) === carSlug,
    );
    if (legacyMatch) {
      permanentRedirect(
        `/sites/${site.slug}/estoque/${legacyMatch.slug}`,
      );
    }
    notFound();
  }

  // Schemas per-page: Vehicle + BreadcrumbList (Início → Estoque → Carro).
  // Sitewide graph (AutoDealer/Organization/LocalBusiness) injetado pelo
  // layout — não duplicado aqui.
  const baseUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const siteUrl = `${baseUrl}/sites/${site.slug}`;
  const vehicleSchema = buildVehicleSchema(car, parsed.data);
  const breadcrumbSchema = buildBreadcrumbSchema([
    { name: "Início", item: siteUrl },
    { name: "Estoque", item: `${siteUrl}/estoque` },
    { name: `${car.brand} ${car.model} ${car.year}`, item: `${siteUrl}/estoque/${carSlug}` },
  ]);

  return (
    <SitePage
      variables={parsed.data}
      siteId={site.id}
      slug={site.slug}
      activePage="estoque"
      mainClassName="pb-24 lg:pb-0"
    >
      <SiteSchema schemas={[vehicleSchema, breadcrumbSchema]} />
      <CarDetailSection
        variables={parsed.data}
        car={car}
        siteId={site.id}
        slug={site.slug}
      />
      <FloatingInstallmentBar
        slug={site.slug}
        carSlug={car.slug}
        initialContext={{
          businessName: parsed.data.business_name,
          whatsapp: parsed.data.whatsapp,
          car,
        }}
      />
    </SitePage>
  );
}
