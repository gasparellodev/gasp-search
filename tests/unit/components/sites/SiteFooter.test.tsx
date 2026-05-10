import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SiteFooter } from "@/components/sites/SiteFooter";

import { SITE_FIXTURE } from "./site-fixtures";

const footerVars = {
  business_name: SITE_FIXTURE.business_name,
  brand_assets: SITE_FIXTURE.brand_assets,
  business_slug: SITE_FIXTURE.business_slug,

  whatsapp: SITE_FIXTURE.whatsapp,
  phone_display: SITE_FIXTURE.phone_display,
  email: SITE_FIXTURE.email,
  instagram_url: SITE_FIXTURE.instagram_url,
  facebook_url: SITE_FIXTURE.facebook_url,
  youtube_url: SITE_FIXTURE.youtube_url,
  address: SITE_FIXTURE.address,
  hours: SITE_FIXTURE.hours,

};

describe("<SiteFooter />", () => {
  it("renderiza copyright com ano corrente e business_name", () => {
    render(<SiteFooter variables={footerVars} />);
    const year = new Date().getFullYear().toString();
    expect(
      screen.getByText(new RegExp(`© ${year} Touring Cars`)),
    ).toBeInTheDocument();
  });

  it("renderiza 4 ícones sociais quando todos os URLs presentes", () => {
    render(<SiteFooter variables={footerVars} />);
    expect(screen.getByLabelText("Instagram")).toBeInTheDocument();
    expect(screen.getByLabelText("Facebook")).toBeInTheDocument();
    expect(screen.getByLabelText("YouTube")).toBeInTheDocument();
    expect(screen.getByLabelText("WhatsApp")).toBeInTheDocument();
  });

  it("omite ícone de Instagram quando URL é null", () => {
    render(
      <SiteFooter variables={{ ...footerVars, instagram_url: null }} />,
    );
    expect(screen.queryByLabelText("Instagram")).not.toBeInTheDocument();
    // WhatsApp segue presente porque é construído via `whatsapp` (sem URL).
    expect(screen.getByLabelText("WhatsApp")).toBeInTheDocument();
  });

  it("omite ícones de Facebook e YouTube quando URLs nulos", () => {
    render(
      <SiteFooter
        variables={{
          ...footerVars,
          facebook_url: null,
          youtube_url: null,
        }}
      />,
    );
    expect(screen.queryByLabelText("Facebook")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("YouTube")).not.toBeInTheDocument();
  });

  it("links sociais externos têm target=_blank e rel='noopener noreferrer'", () => {
    render(<SiteFooter variables={footerVars} />);
    const instagram = screen.getByLabelText("Instagram");
    expect(instagram).toHaveAttribute("target", "_blank");
    expect(instagram).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("link WhatsApp aponta para wa.me/<numero> com UTM (template general)", () => {
    render(<SiteFooter variables={footerVars} />);
    const wa = screen.getByLabelText("WhatsApp");
    const href = wa.getAttribute("href")!;
    expect(href).toMatch(new RegExp(`^https://wa\\.me/${footerVars.whatsapp}\\?text=`));
    expect(href).toContain("utm_source=site");
    expect(href).toContain("utm_medium=whatsapp");
    expect(href).toContain("utm_campaign=general");
    expect(href).toContain("utm_content=footer");
    expect(href).toContain(`utm_term=${footerVars.business_slug}`);
  });

  it("renderiza email e phone_display na coluna de contato", () => {
    render(<SiteFooter variables={footerVars} />);
    expect(screen.getByText("contato@touringcars.com.br")).toBeInTheDocument();
    expect(screen.getByText("(81) 3512-9411")).toBeInTheDocument();
  });

  it("newsletter form é visual-only (input desabilitado, sem name)", () => {
    render(<SiteFooter variables={footerVars} />);
    const form = screen.getByTestId("newsletter-form");
    const input = within(form).getByLabelText(/e-mail para newsletter/i);
    expect(input).toBeDisabled();
    expect(input).not.toHaveAttribute("name");
  });

  it("omite address_line e hours quando ambos null", () => {
    render(
      <SiteFooter
        variables={{ ...footerVars, address: null, hours: null }}
      />,
    );
    expect(
      screen.queryByText(/Av\. Boa Viagem/i),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Seg–Sex/i)).not.toBeInTheDocument();
  });

it("omite email quando null mas mantém phone_display e WhatsApp", () => {
    render(<SiteFooter variables={{ ...footerVars, email: null }} />);
    expect(
      screen.queryByText("contato@touringcars.com.br"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("(81) 3512-9411")).toBeInTheDocument();
    expect(screen.getByLabelText("WhatsApp")).toBeInTheDocument();
  });
});
