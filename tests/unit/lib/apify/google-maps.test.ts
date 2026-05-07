import { describe, expect, it } from "vitest";
import {
  mapGoogleMapsPlace,
  normalizeWebsite,
  type GoogleMapsPlace,
} from "@/lib/apify/google-maps";
import fixture from "../../../fixtures/google-maps-place.json";

const ctx = { userId: "user-1", jobId: "job-1", source: "google_maps" } as const;

describe("normalizeWebsite", () => {
  it("lowercase", () => {
    expect(normalizeWebsite("https://Bigode.COM.br")).toBe("bigode.com.br");
  });
  it("remove https:// e http://", () => {
    expect(normalizeWebsite("https://x.com")).toBe("x.com");
    expect(normalizeWebsite("http://x.com")).toBe("x.com");
  });
  it("remove trailing slash e tracking params", () => {
    expect(normalizeWebsite("https://x.com/?utm_source=g")).toBe("x.com");
    expect(normalizeWebsite("https://x.com/sub/")).toBe("x.com/sub");
  });
  it("remove www.", () => {
    expect(normalizeWebsite("https://www.x.com")).toBe("x.com");
  });
  it("retorna null para input vazio", () => {
    expect(normalizeWebsite("")).toBeNull();
    expect(normalizeWebsite(null)).toBeNull();
    expect(normalizeWebsite(undefined)).toBeNull();
  });
});

describe("mapGoogleMapsPlace", () => {
  it("mapeia campos básicos", () => {
    const lead = mapGoogleMapsPlace(fixture as GoogleMapsPlace, ctx);
    expect(lead).not.toBeNull();
    expect(lead!.name).toBe("Barbearia Bigode");
    expect(lead!.category).toBe("Barbearia");
    expect(lead!.city).toBe("Curitiba");
    expect(lead!.state).toBe("PR");
    expect(lead!.country).toBe("BR");
    expect(lead!.phone).toBe("+55 41 99999-1234");
    expect(lead!.user_id).toBe("user-1");
    expect(lead!.source).toBe("google_maps");
    expect(lead!.source_search_job_id).toBe("job-1");
  });

  it("normaliza website e seta has_website true", () => {
    const lead = mapGoogleMapsPlace(fixture as GoogleMapsPlace, ctx);
    expect(lead!.website).toBe("bigode.com.br");
    expect(lead!.has_website).toBe(true);
  });

  it("rating + reviews_count", () => {
    const lead = mapGoogleMapsPlace(fixture as GoogleMapsPlace, ctx);
    expect(lead!.rating).toBe(4.7);
    expect(lead!.reviews_count).toBe(152);
  });

  it("place sem website tem has_website=false", () => {
    const place = { ...fixture, website: undefined } as unknown as GoogleMapsPlace;
    const lead = mapGoogleMapsPlace(place, ctx);
    expect(lead!.has_website).toBe(false);
    expect(lead!.website).toBeNull();
  });

  it("retorna null quando title está ausente (item inválido)", () => {
    const place = { ...fixture, title: "" } as GoogleMapsPlace;
    expect(mapGoogleMapsPlace(place, ctx)).toBeNull();
  });

  it("inclui raw payload completo", () => {
    const lead = mapGoogleMapsPlace(fixture as GoogleMapsPlace, ctx);
    expect(lead!.raw).toEqual(fixture);
  });
});
