import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SitePage } from "@/components/sites/SitePage";

import { SITE_FIXTURE } from "./site-fixtures";

const SITE_ID = "33333333-3333-4333-8333-333333333333";
const SLUG = "j7k2p9-touring-cars";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => `/sites/${SLUG}`,
}));

describe("<SitePage />", () => {
  it("renderiza H1 canônico `<biz> — Carros seminovos em <city>` (Sprint 4 #221)", () => {
    render(<SitePage variables={SITE_FIXTURE} siteId={SITE_ID} slug={SLUG} />);
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1.textContent).toBe(
      `${SITE_FIXTURE.business_name} — Carros seminovos em ${SITE_FIXTURE.address!.city}`,
    );
  });

  it("compõe a Home V2 (Sprint 4 H1+H2+H3 — issues #221, #222, #223): Hero, TrustStrip, CategoriesCars, RecentArrivals, FinancingWidget, Warranty, Process3Steps, BanksPartners, TestimonialsGrid, FAQ, GoogleReviews", () => {
    render(<SitePage variables={SITE_FIXTURE} siteId={SITE_ID} slug={SLUG} />);
    expect(screen.getByTestId("home-hero")).toBeInTheDocument();
    expect(screen.getByTestId("home-trust-strip")).toBeInTheDocument();
    expect(screen.getByTestId("home-categories-cars")).toBeInTheDocument();
    expect(screen.getByTestId("home-recent-arrivals")).toBeInTheDocument();
    expect(screen.getByTestId("home-financing-widget")).toBeInTheDocument();
    // #223 — 7 sections H3 (substituem home-form + home-emphasis V1):
    expect(screen.getByTestId("home-warranty-section")).toBeInTheDocument();
    expect(screen.getByTestId("home-process-3steps")).toBeInTheDocument();
    expect(screen.getByTestId("home-banks-partners")).toBeInTheDocument();
    expect(screen.getByTestId("home-testimonials-grid")).toBeInTheDocument();
    expect(screen.getByTestId("home-faq-section")).toBeInTheDocument();
    expect(screen.getByTestId("home-google-reviews-embed")).toBeInTheDocument();
    // home-contact-form-quick é conditional render via env flag — testado em
    // tests/unit/components/sites/home/HomeContactFormQuick.test.tsx; aqui
    // o flag fica OFF por default (sem env override) então NÃO renderiza.
  });

  it("renderiza <SiteHeader> e <SiteFooter>", () => {
    render(<SitePage variables={SITE_FIXTURE} siteId={SITE_ID} slug={SLUG} />);
    expect(screen.getByTestId("site-header")).toBeInTheDocument();
    // Múltiplos `<footer>` no DOM (cards de testimonial usam `<footer>`)
    // — selecionamos o footer global pelo data-testid do SiteFooter.
    expect(screen.getByTestId("site-footer")).toBeInTheDocument();
  });

  it("Quick search bar renderiza no Hero", () => {
    render(<SitePage variables={SITE_FIXTURE} siteId={SITE_ID} slug={SLUG} />);
    expect(
      screen.getByRole("button", { name: /buscar/i }),
    ).toBeInTheDocument();
  });

  it("aplica CSS vars --site-primary e --site-text-on-primary no wrapper", () => {
    const { container } = render(
      <SitePage variables={SITE_FIXTURE} siteId={SITE_ID} slug={SLUG} />,
    );
    const wrapper = container.querySelector<HTMLElement>(".site-page");
    expect(wrapper).not.toBeNull();
    expect(
      wrapper!.style.getPropertyValue("--site-primary"),
    ).toBe(SITE_FIXTURE.brand_assets.primary_color);
    expect(
      wrapper!.style.getPropertyValue("--site-text-on-primary"),
    ).toBe(SITE_FIXTURE.brand_assets.text_on_primary);
  });

  it("expõe `data-site-id` igual ao siteId recebido (contrato pra E2E)", () => {
    const { container } = render(
      <SitePage variables={SITE_FIXTURE} siteId={SITE_ID} slug={SLUG} />,
    );
    const wrapper = container.querySelector<HTMLElement>("[data-site-id]");
    expect(wrapper?.getAttribute("data-site-id")).toBe(SITE_ID);
  });

  it("sanitiza cores via sanitizeHex — input adversarial vira fallback", () => {
    const adversarial = {
      ...SITE_FIXTURE,
      brand_assets: {
        ...SITE_FIXTURE.brand_assets,
        primary_color: "red; background: url(x);" as unknown as `#${string}`,
      },
    };
    const { container } = render(
      <SitePage variables={adversarial} siteId={SITE_ID} slug={SLUG} />,
    );
    const wrapper = container.querySelector<HTMLElement>(".site-page");
    expect(wrapper).not.toBeNull();
    expect(
      wrapper!.style.getPropertyValue("--site-primary"),
    ).toBe("#0C0C0C");
  });

  // #217 — manifest fallback
  it("manifest=null → HomeHero usa `brand_assets.hero_image_url`", () => {
    render(
      <SitePage
        variables={SITE_FIXTURE}
        siteId={SITE_ID}
        slug={SLUG}
        manifest={null}
      />,
    );
    const img = screen.getByAltText(`Hero — ${SITE_FIXTURE.business_name}`);
    expect(img.getAttribute("src")).toBe(
      SITE_FIXTURE.brand_assets.hero_image_url,
    );
  });

  it("manifest.hero_url presente → HomeHero usa manifest.hero_url (precedência)", () => {
    const manifest = {
      hero_url: "https://cdn.example.com/ai-hero.png",
      categories_urls: ["https://cdn.example.com/ai-cat-1.png"],
      about_url: "https://cdn.example.com/ai-about.png",
      contact_url: "https://cdn.example.com/ai-contact.png",
      generated_at: "2026-05-11T07:00:00.000Z",
      model: "gpt-image-2-2026-04-21" as const,
      cost_estimate_brl: 2.45,
    };
    render(
      <SitePage
        variables={SITE_FIXTURE}
        siteId={SITE_ID}
        slug={SLUG}
        manifest={manifest}
      />,
    );
    const img = screen.getByAltText(`Hero — ${SITE_FIXTURE.business_name}`);
    expect(img.getAttribute("src")).toBe(manifest.hero_url);
  });

  // #221 — manifest.categories_urls precedência em HomeCategoriesCars
  it("manifest.categories_urls é propagado para HomeCategoriesCars (Sprint 4 #221)", () => {
    const manifest = {
      hero_url: "https://cdn.example.com/ai-hero.png",
      categories_urls: [
        "https://cdn.example.com/cat-suv.png",
        "https://cdn.example.com/cat-sedan.png",
        "https://cdn.example.com/cat-hatch.png",
        "https://cdn.example.com/cat-pickup.png",
        "https://cdn.example.com/cat-sport.png",
        "https://cdn.example.com/cat-conv.png",
      ],
      about_url: "https://cdn.example.com/ai-about.png",
      contact_url: "https://cdn.example.com/ai-contact.png",
      generated_at: "2026-05-11T07:00:00.000Z",
      model: "gpt-image-2-2026-04-21" as const,
      cost_estimate_brl: 2.45,
    };
    render(
      <SitePage
        variables={SITE_FIXTURE}
        siteId={SITE_ID}
        slug={SLUG}
        manifest={manifest}
      />,
    );
    const suvImg = screen.getByAltText(/Categoria SUV/i);
    expect(suvImg.getAttribute("src")).toBe(manifest.categories_urls[0]);
  });

  // #221 — rating/reviewsCount props relay
  it("propaga `rating`/`reviewsCount` para HomeTrustStrip (Sprint 4 #221)", () => {
    render(
      <SitePage
        variables={SITE_FIXTURE}
        siteId={SITE_ID}
        slug={SLUG}
        rating={4.9}
        reviewsCount={142}
      />,
    );
    expect(screen.getByText(/4\.9★ 142 reviews/)).toBeInTheDocument();
  });

  it("sem rating/reviewsCount: HomeTrustStrip cai no fallback '4.8★ 87 reviews'", () => {
    render(<SitePage variables={SITE_FIXTURE} siteId={SITE_ID} slug={SLUG} />);
    expect(screen.getByText(/4\.8★ 87 reviews/)).toBeInTheDocument();
  });
});
