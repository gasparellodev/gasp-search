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
 * **`metadata.robots`**: noindex/nofollow.
 */
import "server-only";

import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { CarDetailSection } from "@/components/sites/stock/CarDetailSection";
import { SitePage } from "@/components/sites/SitePage";
import { getSite } from "@/lib/sites/get-site";
import { SiteVariables } from "@/types/lead-site";

interface PageProps {
  params: Promise<{ slug: string; carSlug: string }>;
}

export default async function CarDetailPage({ params }: PageProps) {
  const { slug, carSlug } = await params;
  const site = await getSite(slug);

  if (!site) notFound();
  if (site.status === "draft" || site.status === "archived") {
    notFound();
  }

  const parsed = SiteVariables.safeParse(site.variables);
  if (!parsed.success) {
    console.error("[site:render:carDetail] invalid variables", {
      slug,
      issuePaths: parsed.error.issues.map((i) => i.path.join(".")),
    });
    notFound();
  }

  const car = parsed.data.cars.find((c) => c.slug === carSlug);
  if (!car) notFound();

  return (
    <SitePage
      variables={parsed.data}
      siteId={site.id}
      slug={site.slug}
      activePage="estoque"
    >
      <CarDetailSection
        variables={parsed.data}
        car={car}
        siteId={site.id}
        slug={site.slug}
      />
    </SitePage>
  );
}

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};
