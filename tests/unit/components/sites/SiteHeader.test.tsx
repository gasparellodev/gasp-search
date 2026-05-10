import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { SiteHeader } from "@/components/sites/SiteHeader";

import { SITE_FIXTURE } from "./site-fixtures";

const slug = "abcd1234-touring-cars";
const headerVars = {
  business_name: SITE_FIXTURE.business_name,
  brand_assets: SITE_FIXTURE.brand_assets,

};

describe("<SiteHeader />", () => {
  it("renderiza logo como Link com href para `/sites/<slug>`", () => {
    render(
      <SiteHeader variables={headerVars} slug={slug} activePage="home" />,
    );
    const link = screen.getByRole("link", { name: /touring cars/i });
    expect(link).toHaveAttribute("href", `/sites/${slug}`);
  });

  it("renderiza logo como <Image> quando `logo_url` é truthy", () => {
    render(
      <SiteHeader variables={headerVars} slug={slug} activePage="home" />,
    );
    const img = screen.getByAltText(/touring cars/i);
    expect(img.tagName.toLowerCase()).toBe("img");
    expect(img.getAttribute("src")).toBe(headerVars.brand_assets.logo_url);
    expect(
      screen.queryByTestId("site-header-logo-text"),
    ).not.toBeInTheDocument();
  });

  it("cai em texto estilizado quando `logo_url` é vazio", () => {
    render(
      <SiteHeader
        variables={{ ...headerVars, brand_assets: { ...headerVars.brand_assets, logo_url: "" as unknown as `${string}` } }}
        slug={slug}
        activePage="home"
      />,
    );
    const text = screen.getByTestId("site-header-logo-text");
    expect(text).toBeInTheDocument();
    expect(text).toHaveTextContent(headerVars.business_name);
    expect(screen.queryByAltText(/touring cars/i)).not.toBeInTheDocument();
  });

  it("renderiza 4 links de navegação no nav desktop", () => {
    render(
      <SiteHeader variables={headerVars} slug={slug} activePage="home" />,
    );
    const nav = screen.getByRole("navigation", { name: /navegação principal/i });
    const links = within(nav).getAllByRole("link");
    expect(links).toHaveLength(4);
    expect(within(nav).getByText("Sobre")).toBeInTheDocument();
    expect(within(nav).getByText("Estoque")).toBeInTheDocument();
    expect(within(nav).getByText("Contato")).toBeInTheDocument();
    expect(within(nav).getByText("Anunciar")).toBeInTheDocument();
  });

  it("aplica aria-current='page' no link ativo (estoque)", () => {
    render(
      <SiteHeader variables={headerVars} slug={slug} activePage="estoque" />,
    );
    const nav = screen.getByRole("navigation", { name: /navegação principal/i });
    const estoque = within(nav).getByText("Estoque").closest("a");
    expect(estoque).toHaveAttribute("aria-current", "page");
    expect(estoque).toHaveAttribute("data-active", "true");
  });

  it("não aplica aria-current nos links inativos", () => {
    render(
      <SiteHeader variables={headerVars} slug={slug} activePage="estoque" />,
    );
    const nav = screen.getByRole("navigation", { name: /navegação principal/i });
    const sobre = within(nav).getByText("Sobre").closest("a");
    expect(sobre).not.toHaveAttribute("aria-current");
    expect(sobre).toHaveAttribute("data-active", "false");
  });

  it("aplica style com primary_color quando ativo (variant Selected)", () => {
    render(
      <SiteHeader
        variables={{ ...headerVars, brand_assets: { ...headerVars.brand_assets, primary_color: "#FF5733" as `#${string}` } }}
        slug={slug}
        activePage="contato"
      />,
    );
    const nav = screen.getByRole("navigation", { name: /navegação principal/i });
    const contato = within(nav).getByText("Contato").closest("a");
    expect(contato).toHaveStyle({ backgroundColor: "#FF5733" });
  });

  it("usa fallback de cor quando primary_color é inválido (proteção XSS)", () => {
    render(
      <SiteHeader
        variables={{ ...headerVars, brand_assets: { ...headerVars.brand_assets, primary_color: "javascript:alert(1)" as `#${string}` } }}
        slug={slug}
        activePage="contato"
      />,
    );
    const nav = screen.getByRole("navigation", { name: /navegação principal/i });
    const contato = within(nav).getByText("Contato").closest("a");
    expect(contato).toHaveStyle({ backgroundColor: "#0C0C0C" });
  });

  it("renderiza botão hambúrguer com aria-expanded inicialmente false", () => {
    render(
      <SiteHeader variables={headerVars} slug={slug} activePage="home" />,
    );
    const btn = screen.getByRole("button", { name: /abrir menu/i });
    expect(btn).toHaveAttribute("aria-expanded", "false");
    expect(btn).toHaveAttribute("aria-controls");
  });

  it("hambúrguer abre/fecha menu mobile e atualiza aria-expanded", async () => {
    const user = userEvent.setup();
    render(
      <SiteHeader variables={headerVars} slug={slug} activePage="home" />,
    );
    const btn = screen.getByRole("button", { name: /abrir menu/i });
    await user.click(btn);
    expect(
      screen.getByRole("button", { name: /fechar menu/i }),
    ).toHaveAttribute("aria-expanded", "true");
    const dialog = screen.getByRole("dialog", { name: /menu de navegação/i });
    expect(dialog).toHaveAttribute("aria-hidden", "false");
    await user.click(screen.getByRole("button", { name: /fechar menu/i }));
    expect(
      screen.getByRole("button", { name: /abrir menu/i }),
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("ESC fecha menu mobile aberto", async () => {
    const user = userEvent.setup();
    render(
      <SiteHeader variables={headerVars} slug={slug} activePage="home" />,
    );
    const btn = screen.getByRole("button", { name: /abrir menu/i });
    await user.click(btn);
    expect(
      screen.getByRole("button", { name: /fechar menu/i }),
    ).toHaveAttribute("aria-expanded", "true");
    await user.keyboard("{Escape}");
    expect(
      screen.getByRole("button", { name: /abrir menu/i }),
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("clicar em link do menu mobile fecha o menu", async () => {
    const user = userEvent.setup();
    render(
      <SiteHeader variables={headerVars} slug={slug} activePage="home" />,
    );
    await user.click(screen.getByRole("button", { name: /abrir menu/i }));
    const dialog = screen.getByRole("dialog", { name: /menu de navegação/i });
    const sobreLink = within(dialog).getByText("Sobre").closest("a")!;
    await user.click(sobreLink);
    expect(
      screen.getByRole("button", { name: /abrir menu/i }),
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("link mobile ativo aplica style com primary_color (Selected)", async () => {
    const user = userEvent.setup();
    render(
      <SiteHeader
        variables={{ ...headerVars, brand_assets: { ...headerVars.brand_assets, primary_color: "#FF5733" as `#${string}` } }}
        slug={slug}
        activePage="estoque"
      />,
    );
    await user.click(screen.getByRole("button", { name: /abrir menu/i }));
    const dialog = screen.getByRole("dialog", { name: /menu de navegação/i });
    const estoqueLink = within(dialog).getByText("Estoque").closest("a");
    expect(estoqueLink).toHaveStyle({ backgroundColor: "#FF5733" });
    expect(estoqueLink).toHaveAttribute("aria-current", "page");
  });
});
