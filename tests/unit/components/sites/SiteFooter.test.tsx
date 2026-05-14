import { axe, toHaveNoViolations } from "jest-axe";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BanksStrip } from "@/components/sites/BanksStrip";
import { SiteFooter } from "@/components/sites/SiteFooter";

import { SITE_FIXTURE } from "./site-fixtures";

expect.extend(toHaveNoViolations);

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
  it("renderiza layout 4 colunas com marca, NAP, horários e navegação", () => {
    render(<SiteFooter variables={footerVars} />);

    expect(screen.getByRole("heading", { name: "Contato" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Horários" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Navegação" })).toBeInTheDocument();

    const footer = screen.getByTestId("site-footer");
    expect(within(footer).getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/sites/touring-cars",
    );
    expect(
      within(footer).getByRole("link", { name: "Política de privacidade LGPD" }),
    ).toHaveAttribute("href", "/sites/touring-cars/lgpd");
  });

  it("renderiza NAP completo em <address> semântico", () => {
    render(<SiteFooter variables={footerVars} />);

    const address = screen.getByTestId("site-footer-address");
    expect(address.tagName).toBe("ADDRESS");
    expect(within(address).getByText("Touring Cars")).toBeInTheDocument();
    expect(within(address).getByText("(81) 3512-9411")).toBeInTheDocument();
    expect(within(address).getByText("contato@touringcars.com.br")).toBeInTheDocument();
    expect(
      within(address).getByText(
        "Av. Boa Viagem, 1000 - Boa Viagem, Recife - PE, 51020-000",
      ),
    ).toBeInTheDocument();
  });

  it("usa fallback de horários quando variables.hours é null", () => {
    render(<SiteFooter variables={{ ...footerVars, hours: null }} />);

    expect(
      screen.getByText("Segunda a Sexta: 09h-18h | Sábado: 09h-13h"),
    ).toBeInTheDocument();
  });

  it("renderiza banks-strip e microbranding (PaymentStrip removido — #295)", () => {
    render(<SiteFooter variables={footerVars} />);

    expect(screen.getByRole("group", { name: "Bancos parceiros" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Santander" })).toHaveAttribute(
      "src",
      "/assets/banks/santander.png",
    );
    expect(screen.getByRole("img", { name: "Porto Bank" })).toHaveAttribute(
      "width",
      "40",
    );
    // #295: PaymentStrip removido — não deve mais renderizar group "Métodos de pagamento"
    expect(
      screen.queryByRole("group", { name: /Métodos de pagamento/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Pix" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Site por GaspLab" })).toHaveAttribute(
      "href",
      "https://gasplab.com",
    );
  });

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

  it("omite address_line e hours quando ambos null", () => {
    render(
      <SiteFooter
        variables={{ ...footerVars, address: null, hours: null }}
      />,
    );
    expect(
      screen.queryByText(/Av\. Boa Viagem/i),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/Segunda a Sexta/i)).toBeInTheDocument();
  });

  it("omite email quando null mas mantém phone_display e WhatsApp", () => {
    render(<SiteFooter variables={{ ...footerVars, email: null }} />);
    expect(
      screen.queryByText("contato@touringcars.com.br"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("(81) 3512-9411")).toBeInTheDocument();
    expect(screen.getByLabelText("WhatsApp")).toBeInTheDocument();
  });

  it("não tem violações axe-core (a11y runtime)", async () => {
    const { container } = render(<SiteFooter variables={footerVars} />);
    const results = await axe(container);

    expect(results).toHaveNoViolations();
  });

  it("mantém snapshot estrutural do footer global", () => {
    const { container } = render(<SiteFooter variables={footerVars} />);

    expect(container.firstChild).toMatchSnapshot();
  });
});

describe("<BanksStrip />", () => {
  it("renderiza os 7 bancos com assets SVG estáveis", () => {
    render(<BanksStrip />);

    const banks = [
      "Santander",
      "Bradesco",
      "Itaú",
      "BV",
      "Banco PAN",
      "Caixa",
      "Porto Bank",
    ];
    for (const bank of banks) {
      const icon = screen.getByRole("img", { name: bank });
      expect(icon).toHaveAttribute("width", "40");
      expect(icon).toHaveAttribute("height", "40");
    }
  });
});

