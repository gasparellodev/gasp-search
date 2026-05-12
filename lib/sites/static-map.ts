const GOOGLE_STATIC_MAPS_ENDPOINT =
  "https://maps.googleapis.com/maps/api/staticmap";
const GOOGLE_MAPS_PLACE_ENDPOINT = "https://www.google.com/maps/place/";

export interface StaticMapInput {
  apiKey?: string | null;
  placeId?: string | null;
  lat?: number | null;
  lng?: number | null;
  address?: string | null;
  width?: number;
  height?: number;
}

function normalizeText(input: string | null | undefined): string | null {
  const value = input?.trim();
  return value && value.length > 0 ? value : null;
}

function resolveMapTarget(input: StaticMapInput): string | null {
  const placeId = normalizeText(input.placeId);
  if (placeId) return `place_id:${placeId}`;
  if (typeof input.lat === "number" && typeof input.lng === "number") {
    return `${input.lat},${input.lng}`;
  }
  return normalizeText(input.address);
}

export function buildStaticMapUrl(input: StaticMapInput): string | null {
  const apiKey = normalizeText(input.apiKey);
  if (!apiKey) return null;

  const target = resolveMapTarget(input);
  if (!target) return null;

  const width = input.width ?? 600;
  const height = input.height ?? 400;
  const params = new URLSearchParams({
    center: target,
    zoom: "15",
    size: `${width}x${height}`,
    scale: "2",
    markers: `color:red|${target}`,
    key: apiKey,
  });

  return `${GOOGLE_STATIC_MAPS_ENDPOINT}?${params.toString()}`;
}

export function buildGoogleMapsPlaceHref(address: string | null): string {
  const params = new URLSearchParams({
    q: normalizeText(address) ?? "concessionária de carros seminovos",
  });
  return `${GOOGLE_MAPS_PLACE_ENDPOINT}?${params.toString()}`;
}
