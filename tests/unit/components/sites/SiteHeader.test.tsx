import { render, screen, within, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe, toHaveNoViolations } from "jest-axe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SiteHeader } from "@/components/sites/SiteHeader";

import { SITE_FIXTURE } from "./site-fixtures";

expect.extend(toHaveNoViolations);

const pathnameMock = vi.hoisted(() => ({ value: "/sites/abcd1234-touring-cars" }));

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameMock.value,
}));

const slug = "abcd1234-touring-cars";
const headerVars = {
  business_name: SITE_FIXTURE.business_name,
  brand_assets: SITE_FIXTURE.brand_assets,
  whatsapp: SITE_FIXTURE.whatsapp,
  cars: SITE_FIXTURE.cars,
};

type IntersectionObserverCallback = ConstructorParameters<typeof IntersectionObserver>[0];

const observerState = vi.hoisted(() => ({
  callback: null as IntersectionObserverCallback | null,
  observe: vi.fn(),
  disconnect: vi.fn(),
}));

describe("<SiteHeader />", () => {
  beforeEach(() => {
    pathnameMock.value = `/sites/${slug}`;
    observerState.callback = null;
    observerState.observe.mockClear();
    observerState.disconnect.mockClear();
    class IntersectionObserverMock {
      constructor(callback: IntersectionObserverCallback) {
        observerState.callback = callback;
      }
      observe = observerState.observe;
      disconnect = observerState.disconnect;
      unobserve = vi.fn();
      takeRecords = vi.fn(() => []);
      root = null;
      rootMargin = "";
      thresholds = [];
    }
    vi.stubGlobal("IntersectionObserver", IntersectionObserverMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

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

  it("cai em texto estilizado quando a imagem do logo falha", () => {
    render(
      <SiteHeader variables={headerVars} slug={slug} activePage="home" />,
    );
    const img = screen.getByAltText(/touring cars/i);
    fireEvent.error(img);
    expect(screen.getByTestId("site-header-logo-text")).toHaveTextContent(
      headerVars.business_name,
    );
  });

  it("renderiza 5 links de navegação no nav desktop quando há estoque", () => {
    render(
      <SiteHeader variables={headerVars} slug={slug} activePage="home" />,
    );
    const nav = screen.getByRole("navigation", { name: /navegação principal/i });
    const links = within(nav).getAllByRole("link");
    expect(links).toHaveLength(5);
    expect(within(nav).getByText("Home")).toBeInTheDocument();
    expect(within(nav).getByText("Sobre")).toBeInTheDocument();
    expect(within(nav).getByText("Estoque")).toBeInTheDocument();
    expect(within(nav).getByText("Contato")).toBeInTheDocument();
    expect(within(nav).getByText("Anunciar")).toBeInTheDocument();
  });

  it("Wave A3 (D-13): esconde 'Estoque' quando cars.length === 0", () => {
    render(
      <SiteHeader
        variables={{ ...headerVars, cars: [] }}
        slug={slug}
        activePage="home"
      />,
    );
    const nav = screen.getByRole("navigation", { name: /navegação principal/i });
    expect(within(nav).queryByText("Estoque")).not.toBeInTheDocument();
    expect(within(nav).getAllByRole("link")).toHaveLength(4);
  });

  it("aplica aria-current='page' no link ativo (estoque)", () => {
    pathnameMock.value = `/sites/${slug}/estoque`;
    render(
      <SiteHeader variables={headerVars} slug={slug} activePage="home" />,
    );
    const nav = screen.getByRole("navigation", { name: /navegação principal/i });
    const estoque = within(nav).getByText("Estoque").closest("a");
    expect(estoque).toHaveAttribute("aria-current", "page");
    expect(estoque).toHaveAttribute("data-active", "true");
  });

  it("não aplica aria-current nos links inativos", () => {
    pathnameMock.value = `/sites/${slug}/estoque`;
    render(
      <SiteHeader variables={headerVars} slug={slug} activePage="home" />,
    );
    const nav = screen.getByRole("navigation", { name: /navegação principal/i });
    const sobre = within(nav).getByText("Sobre").closest("a");
    expect(sobre).not.toHaveAttribute("aria-current");
    expect(sobre).toHaveAttribute("data-active", "false");
  });

  it("aplica style com primary_color quando ativo (variant Selected)", () => {
    pathnameMock.value = `/sites/${slug}/contato`;
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
    pathnameMock.value = `/sites/${slug}/contato`;
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

  it("renderiza CTA WhatsApp com template general e UTM header", () => {
    render(
      <SiteHeader variables={headerVars} slug={slug} activePage="home" />,
    );
    const link = screen.getByRole("link", { name: /^WhatsApp$/i });
    expect(link).toHaveAttribute("href", expect.stringContaining("wa.me/"));
    expect(link).toHaveAttribute("href", expect.stringContaining("utm_campaign=general"));
    expect(link).toHaveAttribute("href", expect.stringContaining("utm_content=header"));
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("inicia transparente e aplica glass quando o sentinel sai do viewport", () => {
    render(
      <>
        <div data-site-header-sentinel />
        <SiteHeader variables={headerVars} slug={slug} activePage="home" />
      </>,
    );
    const header = screen.getByTestId("site-header");
    expect(header).toHaveAttribute("data-scrolled", "false");
    expect(observerState.observe).toHaveBeenCalled();

    act(() => {
      observerState.callback?.(
        [{ isIntersecting: false } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });

    expect(header).toHaveAttribute("data-scrolled", "true");
    expect(header.className).toContain("backdrop-blur-xl");
  });

  it("renderiza botão hambúrguer com aria-expanded inicialmente false", () => {
    render(
      <SiteHeader variables={headerVars} slug={slug} activePage="home" />,
    );
    const btn = screen.getByRole("button", { name: /abrir menu/i });
    expect(btn).toHaveAttribute("aria-expanded", "false");
    expect(btn).toHaveAttribute("aria-controls");
  });

  it("hambúrguer abre/fecha menu mobile fullscreen e atualiza aria-expanded", async () => {
    const user = userEvent.setup();
    render(
      <SiteHeader variables={headerVars} slug={slug} activePage="home" />,
    );
    const btn = screen.getByRole("button", { name: /abrir menu/i });
    await user.click(btn);
    expect(btn).toHaveAttribute("aria-expanded", "true");
    const dialog = screen.getByRole("dialog", { name: /menu de navegação/i });
    expect(dialog).toHaveAttribute("data-mobile-nav", "content");
    expect(dialog.className).toContain("inset-0");
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
    expect(btn).toHaveAttribute("aria-expanded", "true");
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
    pathnameMock.value = `/sites/${slug}/estoque`;
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

  it("não tem violações axe-core no header e mobile nav aberto", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <SiteHeader variables={headerVars} slug={slug} activePage="home" />,
    );
    await user.click(screen.getByRole("button", { name: /abrir menu/i }));

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
