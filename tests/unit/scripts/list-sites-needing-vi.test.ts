import { describe, expect, it } from "vitest";

import { projectSiteRow } from "@/scripts/list-sites-needing-vi";

function makeRow(
  overrides: Partial<{
    slug: string;
    lead_id: string;
    user_id: string;
    status: string;
    variables: unknown;
  }> = {},
) {
  return {
    slug: "abc12345-loja",
    lead_id: "00000000-0000-0000-0000-000000000001",
    user_id: "00000000-0000-0000-0000-000000000002",
    status: "published",
    variables: {
      business_name: "Loja Demo",
      brand_assets: {
        logo_url: "https://example.com/logo.png",
      },
      cars: [
        {
          brand: "Toyota",
          model: "Corolla",
          thumbnail_url: "https://cdn.example.com/corolla.jpg",
        },
      ],
    },
    ...overrides,
  };
}

describe("projectSiteRow", () => {
  it("returns a clean summary for a healthy row", () => {
    const summary = projectSiteRow(makeRow());

    expect(summary).toEqual({
      slug: "abc12345-loja",
      lead_id: "00000000-0000-0000-0000-000000000001",
      user_id: "00000000-0000-0000-0000-000000000002",
      status: "published",
      business_name: "Loja Demo",
      has_google_maps_logo: false,
      cars_count: 1,
      has_placeholder_cars: false,
    });
  });

  it("flags has_placeholder_cars when a thumbnail uses placehold.co", () => {
    const summary = projectSiteRow(
      makeRow({
        variables: {
          business_name: "Loja",
          brand_assets: { logo_url: "https://example.com/logo.png" },
          cars: [
            {
              brand: "Honda",
              model: "Civic",
              thumbnail_url: "https://placehold.co/600x400.png",
            },
          ],
        },
      }),
    );

    expect(summary.has_placeholder_cars).toBe(true);
    expect(summary.cars_count).toBe(1);
  });

  it("flags has_placeholder_cars when model matches 'Modelo N' pattern", () => {
    const summary = projectSiteRow(
      makeRow({
        variables: {
          business_name: "Loja",
          brand_assets: { logo_url: "https://example.com/logo.png" },
          cars: [
            { brand: "Custom", model: "Modelo N", thumbnail_url: null },
            { brand: "Custom", model: "Modelo XYZ", thumbnail_url: null },
          ],
        },
      }),
    );

    expect(summary.has_placeholder_cars).toBe(true);
    expect(summary.cars_count).toBe(2);
  });

  it("flags has_placeholder_cars when brand contains 'Ducarmo'", () => {
    const summary = projectSiteRow(
      makeRow({
        variables: {
          business_name: "Loja",
          brand_assets: { logo_url: "https://example.com/logo.png" },
          cars: [
            { brand: "Ducarmo Motors", model: "Sedan A", thumbnail_url: null },
          ],
        },
      }),
    );

    expect(summary.has_placeholder_cars).toBe(true);
  });

  it("flags has_google_maps_logo when logo_url is a Google Maps photo", () => {
    const summary = projectSiteRow(
      makeRow({
        variables: {
          business_name: "Loja",
          brand_assets: {
            logo_url:
              "https://lh3.googleusercontent.com/p/AF1QipMSomeRandomHash=s1024",
          },
          cars: [
            {
              brand: "Toyota",
              model: "Corolla",
              thumbnail_url: "https://cdn.example.com/corolla.jpg",
            },
          ],
        },
      }),
    );

    expect(summary.has_google_maps_logo).toBe(true);
    expect(summary.has_placeholder_cars).toBe(false);
  });

  it("handles missing/null variables defensively", () => {
    const summary = projectSiteRow(
      makeRow({
        variables: null,
      }),
    );

    expect(summary).toEqual({
      slug: "abc12345-loja",
      lead_id: "00000000-0000-0000-0000-000000000001",
      user_id: "00000000-0000-0000-0000-000000000002",
      status: "published",
      business_name: "(unknown)",
      has_google_maps_logo: false,
      cars_count: 0,
      has_placeholder_cars: false,
    });
  });

  it("handles v1 flat shape with logo_url at the top level", () => {
    const summary = projectSiteRow(
      makeRow({
        variables: {
          business_name: "Loja V1",
          logo_url: "https://lh3.googleusercontent.com/p/abc=s512",
          car_placeholder_urls: [],
          cars: [],
        },
      }),
    );

    expect(summary.has_google_maps_logo).toBe(true);
    expect(summary.cars_count).toBe(0);
  });
});
