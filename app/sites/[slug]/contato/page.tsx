/**
 * Rota pública `/sites/[slug]/contato` (Phase 7 — issue #163).
 *
 * Sub-rota Contato. Compartilha contrato de routing com `/sites/[slug]`
 * (M2.1 / M2.3 — #160 / #162). Renderiza `<ContactSection>` entre
 * Header e Footer com `activePage="contato"`.
 *
 * **`SiteVariables.safeParse`** antes do render — defesa em
 * profundidade contra JSON quebrado em `lead_sites.variables`.
 *
 * **`generateMetadata` dinâmico (#165)**: title + OG/Twitter via
 * `buildSiteMetadata` no happy path; fallback `noindex/nofollow` puro
 * preservado em todos os caminhos.
 */
import "server-only";

import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { ContactSection } from "@/components/sites/contact/ContactSection";
import { SitePage } from "@/components/sites/SitePage";
import { SiteSchema } from "@/components/sites/seo/SiteSchema";
import { resolveVisualIdentity } from "@/lib/sites/default-visual-identity";
import { getSite } from "@/lib/sites/get-site";
import { buildSiteMetadata } from "@/lib/sites/metadata";
import { readSiteVariablesSafe } from "@/lib/sites/migrate-variables";
import { env } from "@/lib/env";
import { buildBreadcrumbSchema } from "@/lib/sites/schema";
import {
  buildGoogleMapsPlaceHref,
  buildStaticMapUrl,
} from "@/lib/sites/static-map";
import type { SiteVariablesV2 } from "@/types/lead-site";

interface PageProps {
  params: Promise<{ slug: string }>;
}

const NOINDEX_FALLBACK: Metadata = {
  robots: { index: false, follow: false },
};

function formatAddressLine(address: SiteVariablesV2["address"]): string | null {
  if (!address) return null;
  return `${address.street}, ${address.number} - ${address.neighborhood}, ${address.city} - ${address.state}, ${address.zip}`;
}

function readRawObject(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {};
}

function extractMapRaw(raw: unknown): {
  placeId: string | null;
  lat: number | null;
  lng: number | null;
} {
  const obj = readRawObject(raw);
  const location = readRawObject(obj["location"]);
  const placeId =
    typeof obj["placeId"] === "string"
      ? obj["placeId"]
      : typeof obj["place_id"] === "string"
        ? obj["place_id"]
        : null;
  const lat =
    typeof location["lat"] === "number"
      ? location["lat"]
      : typeof obj["lat"] === "number"
        ? obj["lat"]
        : null;
  const lng =
    typeof location["lng"] === "number"
      ? location["lng"]
      : typeof obj["lng"] === "number"
        ? obj["lng"]
        : null;
  return { placeId, lat, lng };
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const site = await getSite(slug);
  if (!site) return NOINDEX_FALLBACK;
  if (site.status === "draft" || site.status === "archived") {
    return NOINDEX_FALLBACK;
  }
  const parsed = readSiteVariablesSafe(site.variables);
  if (!parsed.success) return NOINDEX_FALLBACK;
  return buildSiteMetadata({
    variables: parsed.data,
    pageLabel: "Contato",
    site,
    pathname: "/contato",
    route: { kind: "contato" },
  });
}

export default async function ContatoPage({ params }: PageProps) {
  const { slug } = await params;
  const site = await getSite(slug);

  if (!site) notFound();
  if (site.status === "draft" || site.status === "archived") {
    notFound();
  }

  const parsed = readSiteVariablesSafe(site.variables);
  if (!parsed.success) {
    console.error("[site:render:contato] invalid variables", {
      slug,
      issuePaths: parsed.error.issues.map((i) => i.path.join(".")),
    });
    notFound();
  }

  // BreadcrumbList per-page (sitewide graph fica no layout).
  const baseUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const siteUrl = `${baseUrl}/sites/${site.slug}`;
  const breadcrumbSchema = buildBreadcrumbSchema([
    { name: "Início", item: siteUrl },
    { name: "Contato", item: `${siteUrl}/contato` },
  ]);
  const addressLine = formatAddressLine(parsed.data.address);
  const mapRaw = extractMapRaw(site.lead_raw);
  const mapsHref = buildGoogleMapsPlaceHref(addressLine);
  const staticMapUrl = buildStaticMapUrl({
    apiKey: env.GOOGLE_MAPS_STATIC_API_KEY,
    placeId: mapRaw.placeId,
    lat: mapRaw.lat,
    lng: mapRaw.lng,
    address: addressLine,
  });

  return (
    <SitePage
      variables={parsed.data}
      siteId={site.id}
      slug={site.slug}
      activePage="contato"
      manifest={resolveVisualIdentity(site.visual_identity)}
    >
      <SiteSchema schemas={breadcrumbSchema} />
      <ContactSection
        variables={parsed.data}
        siteId={site.id}
        slug={site.slug}
        staticMapUrl={staticMapUrl}
        mapsHref={mapsHref}
      />
    </SitePage>
  );
}
