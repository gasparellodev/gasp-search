import { render, screen, within } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { describe, expect, it } from "vitest";

import { ContactSection } from "@/components/sites/contact/ContactSection";

import { SITE_FIXTURE } from "../site-fixtures";

expect.extend(toHaveNoViolations);

const SITE_ID = "55555555-5555-4555-8555-555555555555";
const SLUG = "j7k2p9-touring-cars";

const baseVariables = {
  contact_hero_image_url: SITE_FIXTURE.contact_hero_image_url,
  whatsapp: SITE_FIXTURE.whatsapp,
  phone_display: SITE_FIXTURE.phone_display,
  email: SITE_FIXTURE.email,
  address_line: SITE_FIXTURE.address_line,
  hours: SITE_FIXTURE.hours,
  instagram_url: SITE_FIXTURE.instagram_url,
  facebook_url: SITE_FIXTURE.facebook_url,
  youtube_url: SITE_FIXTURE.youtube_url,
  business_name: SITE_FIXTURE.business_name,
  primary_color: SITE_FIXTURE.primary_color,
  text_on_primary: SITE_FIXTURE.text_on_primary,
};

describe("<ContactSection />", () => {
  it("renderiza <h1> 'Contato'", () => {
    render(
      <ContactSection
        variables={baseVariables}
        siteId={SITE_ID}
        slug={SLUG}
      />,
    );
    expect(
      screen.getByRole("heading", { level: 1, name: /Contato/i }),
    ).toBeInTheDocument();
  });

  it("link WhatsApp aponta pra wa.me com somente os dígitos do whatsapp", () => {
    const variables = { ...baseVariables, whatsapp: "55 81 9 8100-0000" };
    render(
      <ContactSection variables={variables} siteId={SITE_ID} slug={SLUG} />,
    );
    const channels = screen.getByTestId("contact-channels");
    const link = within(channels).getByRole("link", { name: /WhatsApp/i });
    expect(link).toHaveAttribute("href", "https://wa.me/5581981000000");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("link tel: usa `tel:+<digits>`", () => {
    render(
      <ContactSection
        variables={baseVariables}
        siteId={SITE_ID}
        slug={SLUG}
      />,
    );
    const channels = screen.getByTestId("contact-channels");
    const links = within(channels).getAllByRole("link");
    const tel = links.find((a) =>
      a.getAttribute("href")?.startsWith("tel:+"),
    );
    expect(tel).toBeDefined();
    expect(tel!.getAttribute("href")).toBe("tel:+5581981000000");
  });

  it("renderiza link mailto: quando email presente", () => {
    render(
      <ContactSection
        variables={baseVariables}
        siteId={SITE_ID}
        slug={SLUG}
      />,
    );
    const link = screen.getByRole("link", {
      name: SITE_FIXTURE.email!,
    });
    expect(link).toHaveAttribute(
      "href",
      `mailto:${SITE_FIXTURE.email}`,
    );
  });

  it("omite mailto: quando email é null", () => {
    const variables = { ...baseVariables, email: null };
    render(
      <ContactSection variables={variables} siteId={SITE_ID} slug={SLUG} />,
    );
    expect(
      screen.queryByText(/mailto/i),
    ).toBeNull();
    expect(
      screen.queryByRole("link", { name: /@/ }),
    ).toBeNull();
  });

  it("omite endereço quando address_line é null", () => {
    const variables = { ...baseVariables, address_line: null };
    render(
      <ContactSection variables={variables} siteId={SITE_ID} slug={SLUG} />,
    );
    expect(
      screen.queryByText(SITE_FIXTURE.address_line!),
    ).toBeNull();
  });

  it("usa fallback 'Sob consulta' quando hours é null", () => {
    const variables = { ...baseVariables, hours: null };
    render(
      <ContactSection variables={variables} siteId={SITE_ID} slug={SLUG} />,
    );
    expect(screen.getByText(/Sob consulta/i)).toBeInTheDocument();
  });

  it("renderiza ícones sociais com target=_blank/rel=noopener noreferrer (sem WhatsApp duplicado)", () => {
    render(
      <ContactSection
        variables={baseVariables}
        siteId={SITE_ID}
        slug={SLUG}
      />,
    );
    const socials = screen.getByTestId("contact-socials");
    const links = within(socials).getAllByRole("link");
    // Instagram + Facebook + YouTube — WhatsApp está no canal principal acima,
    // não duplica nas redes sociais (decisão UX 2026-05-09).
    expect(links).toHaveLength(3);
    for (const link of links) {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
  });

  it("oculta o bloco social inteiro quando todas as URLs são null", () => {
    const variables = {
      ...baseVariables,
      instagram_url: null,
      facebook_url: null,
      youtube_url: null,
    };
    render(
      <ContactSection variables={variables} siteId={SITE_ID} slug={SLUG} />,
    );
    // <ul data-testid="contact-socials"> é renderizado só quando há ao menos
    // uma rede social. Sem nenhuma, o bloco não aparece (evita "WhatsApp atoa").
    expect(screen.queryByTestId("contact-socials")).toBeNull();
  });

  it("renderiza imagem hero com alt descritivo", () => {
    render(
      <ContactSection
        variables={baseVariables}
        siteId={SITE_ID}
        slug={SLUG}
      />,
    );
    const img = screen.getByAltText(
      `Contato — ${SITE_FIXTURE.business_name}`,
    );
    expect(img).toBeInTheDocument();
  });

  it("renderiza <SiteForm> com variant='contact'", () => {
    render(
      <ContactSection
        variables={baseVariables}
        siteId={SITE_ID}
        slug={SLUG}
      />,
    );
    const form = screen.getByTestId("site-form");
    expect(form).toHaveAttribute("data-variant", "contact");
  });

  // AC7 round 3 — runtime axe-core (M2.3 #162 pattern). Cobre links
  // externos, ícones sociais e form de contato em conjunto.
  it("não tem violações axe-core (a11y runtime)", async () => {
    const { container } = render(
      <ContactSection
        variables={baseVariables}
        siteId={SITE_ID}
        slug={SLUG}
      />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  }, 15_000);
});
