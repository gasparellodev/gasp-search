import "server-only";
import type { LeadInsert, MapperContext } from "@/lib/apify/run-and-persist";

/**
 * Shape parcial do output do actor `compass~crawler-google-places` no Apify.
 * Documenta apenas os campos que consumimos. Há muitos outros (openingHours,
 * imageUrls, etc.) que vão para `raw` mas não são tipados.
 */
export interface GoogleMapsPlace {
  title?: string;
  categoryName?: string;
  city?: string | null;
  state?: string | null;
  countryCode?: string | null;
  phone?: string | null;
  website?: string | null;
  url?: string | null;
  totalScore?: number | null;
  reviewsCount?: number | null;
  placeId?: string | null;
  address?: string | null;
}

/**
 * Normaliza uma URL para forma canônica e dedupable:
 * - lowercase
 * - sem protocolo (http://, https://)
 * - sem `www.`
 * - sem query string com tracking params (`?utm_*`, `?fbclid`, etc.)
 * - sem trailing slash
 * Retorna null se input for vazio/inválido.
 */
export function normalizeWebsite(
  url: string | null | undefined,
): string | null {
  if (!url) return null;
  let s = url.trim().toLowerCase();
  if (!s) return null;

  s = s.replace(/^https?:\/\//, "");
  s = s.replace(/^www\./, "");

  const queryStart = s.indexOf("?");
  if (queryStart !== -1) s = s.slice(0, queryStart);

  s = s.replace(/\/+$/, "");

  return s || null;
}

/**
 * Mapeia um item do dataset do Google Maps Apify para `LeadInsert`.
 * Retorna null se o item não tiver título mínimo.
 */
export function mapGoogleMapsPlace(
  place: GoogleMapsPlace,
  ctx: MapperContext,
): LeadInsert | null {
  const name = place.title?.trim();
  if (!name) return null;

  const website = normalizeWebsite(place.website);

  return {
    user_id: ctx.userId,
    source: ctx.source,
    source_search_job_id: ctx.jobId,
    name,
    category: place.categoryName ?? null,
    city: place.city ?? null,
    state: place.state ?? null,
    country: place.countryCode ?? null,
    phone: place.phone ?? null,
    website,
    has_website: website !== null,
    rating: place.totalScore ?? null,
    reviews_count: place.reviewsCount ?? null,
    raw: place as never,
  };
}
