import { render, screen, within } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { describe, expect, it } from "vitest";

import { ContactSection } from "@/components/sites/contact/ContactSection";

import { SITE_FIXTURE } from "../site-fixtures";

expect.extend(toHaveNoViolations);

const SITE_ID = "55555555-5555-4555-8555-555555555555";
const SLUG = "j7k2p9-touring-cars";
const MAPS_HREF =
  "https://www.google.com/maps/place/?q=Av.+Boa+Viagem%2C+Recife+-+PE";

const baseVariables = {
  whatsapp: SITE_FIXTURE.whatsapp,
  phone_display: SITE_FIXTURE.phone_display,
  email: SITE_FIXTURE.email,
  address: SITE_FIXTURE.address,
  hours: SITE_FIXTURE.hours,
  instagram_url: SITE_FIXTURE.instagram_url,
  facebook_url: SITE_FIXTURE.facebook_url,
  youtube_url: SITE_FIXTURE.youtube_url,
  business_name: SITE_FIXTURE.business_name,
  brand_assets: SITE_FIXTURE.brand_assets,
  business_slug: SITE_FIXTURE.business_slug,
};

function renderContact(overrides: Partial<typeof baseVariables> = {}) {
  return render(
    <ContactSection
      variables={{ ...baseVariables, ...overrides }}
      siteId={SITE_ID}
      slug={SLUG}
      staticMapUrl="https://maps.googleapis.com/maps/api/staticmap?x=1"
      mapsHref={MAPS_HREF}
    />,
  );
}

describe("<ContactSection />", () => {
  it("renderiza dual-pane com h1 Contato e mapa estático", () => {
    renderContact();
    expect(
      screen.getByRole("heading", { level: 1, name: "Contato" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: `Mapa — ${SITE_FIXTURE.business_name}` }),
    ).toHaveAttribute("src", "https://maps.googleapis.com/maps/api/staticmap?x=1");
  });

  it("renderiza fallback visual quando staticMapUrl está ausente", () => {
    render(
      <ContactSection
        variables={baseVariables}
        siteId={SITE_ID}
        slug={SLUG}
        staticMapUrl={null}
        mapsHref={MAPS_HREF}
      />,
    );
    expect(screen.getByText(/Mapa indisponível/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Abrir mapa/i })).toHaveAttribute(
      "href",
      MAPS_HREF,
    );
  });

  it("renderiza canais de email e endereço", () => {
    renderContact();
    const channels = screen.getByTestId("contact-channels");

    expect(
      within(channels).getByRole("link", { name: SITE_FIXTURE.email! }),
    ).toHaveAttribute("href", `mailto:${SITE_FIXTURE.email}`);
    expect(within(channels).getByText(/Av\. Boa Viagem/)).toBeInTheDocument();
  });

  it("omite email e endereço quando ausentes", () => {
    renderContact({ email: null, address: null });
    expect(screen.queryByRole("link", { name: /@/ })).toBeNull();
    expect(screen.queryByText(/Av\. Boa Viagem/)).toBeNull();
  });

  it("renderiza BusinessHours com fallback quando hours é null", () => {
    renderContact({ hours: null });
    expect(screen.getByTestId("business-hours")).toBeInTheDocument();
    expect(screen.getByText("Segunda a Sexta: 09h-18h")).toBeInTheDocument();
  });

  it("renderiza WhatsAppDirectCard e não duplica WhatsApp nas redes sociais", () => {
    renderContact();

    expect(screen.getByTestId("whatsapp-direct-card")).toBeInTheDocument();
    const socials = screen.getByTestId("contact-socials");
    expect(within(socials).getAllByRole("link")).toHaveLength(3);
  });

  it("oculta o bloco social inteiro quando todas as URLs são null", () => {
    renderContact({
      instagram_url: null,
      facebook_url: null,
      youtube_url: null,
    });
    expect(screen.queryByTestId("contact-socials")).toBeNull();
  });

  it("renderiza PaymentStrip e SiteForm variant contact", () => {
    renderContact();
    expect(
      screen.getByRole("group", { name: /Métodos de pagamento/i }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("site-form")).toHaveAttribute(
      "data-variant",
      "contact",
    );
  });

  it("não tem violações axe-core", async () => {
    const { container } = renderContact();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  }, 15_000);
});
