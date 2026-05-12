import { describe, expect, it } from "vitest";

import {
  buildGoogleMapsPlaceHref,
  buildStaticMapUrl,
} from "@/lib/sites/static-map";

describe("static-map helpers (#230)", () => {
  it("retorna null quando GOOGLE_MAPS_STATIC_API_KEY está ausente", () => {
    expect(
      buildStaticMapUrl({
        apiKey: undefined,
        placeId: "abc",
        address: "Av. Boa Viagem, Recife",
      }),
    ).toBeNull();
  });

  it("prioriza placeId sobre coordenadas e endereço", () => {
    const url = buildStaticMapUrl({
      apiKey: "key-123",
      placeId: "ChIJ123",
      lat: -8.1,
      lng: -34.9,
      address: "Av. Boa Viagem, Recife",
    });

    expect(url).toContain("center=place_id%3AChIJ123");
    expect(url).toContain("markers=color%3Ared%7Cplace_id%3AChIJ123");
  });

  it("usa lat,lng quando placeId está ausente", () => {
    const url = buildStaticMapUrl({
      apiKey: "key-123",
      lat: -8.123456,
      lng: -34.987654,
      address: "Av. Boa Viagem, Recife",
    });

    expect(url).toContain("center=-8.123456%2C-34.987654");
  });

  it("usa endereço textual quando não há placeId nem coordenadas", () => {
    const url = buildStaticMapUrl({
      apiKey: "key-123",
      address: "Av. Boa Viagem, Recife - PE",
    });

    expect(url).toContain("center=Av.+Boa+Viagem%2C+Recife+-+PE");
  });

  it("retorna null quando não há alvo de mapa", () => {
    expect(buildStaticMapUrl({ apiKey: "key-123" })).toBeNull();
  });

  it("monta fallback href para Google Maps usando endereço", () => {
    expect(buildGoogleMapsPlaceHref("Av. Boa Viagem, Recife - PE")).toBe(
      "https://www.google.com/maps/place/?q=Av.+Boa+Viagem%2C+Recife+-+PE",
    );
  });
});
