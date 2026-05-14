/**
 * Testes do <AnnouncementBar /> (Phase 7 / WP2 — issue #291).
 *
 * Server Component que decide renderizar baseado em sanitização do texto.
 * O marquee animado (Client) é testado indiretamente — aqui o foco é o
 * comportamento de renderização condicional do wrapper.
 */
import { render, screen } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AnnouncementBar } from "@/components/sites/AnnouncementBar";

expect.extend(toHaveNoViolations);

beforeEach(() => {
  // jsdom não implementa `window.matchMedia` — `prefersReducedMotion()` do
  // motion helper depende dele. Mock retornando `matches: true` força o
  // branch reduced-motion no `<AnnouncementBarMarquee>` (Client), evitando
  // chamar `loadAnime()` no test e mantendo o teste focado no
  // comportamento do wrapper Server.
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

describe("<AnnouncementBar />", () => {
  it("renderiza com role complementary + aria-label quando text é válido", () => {
    render(<AnnouncementBar text="Black Friday — descontos em todo estoque" />);
    const bar = screen.getByRole("complementary", { name: /avisos da loja/i });
    expect(bar).toBeInTheDocument();
    expect(bar.getAttribute("data-testid")).toBe("announcement-bar");
  });

  it("renderiza o texto sanitizado no track + sr-only", () => {
    render(<AnnouncementBar text="Black Friday — descontos em todo estoque" />);
    // Marquee duplica o texto 4× no track + 1× sr-only = 5 ocorrências.
    // Assertamos a presença múltipla pra documentar o contrato.
    const matches = screen.getAllByText(
      "Black Friday — descontos em todo estoque",
    );
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it("retorna null quando text é null", () => {
    const { container } = render(<AnnouncementBar text={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("retorna null quando text é undefined", () => {
    const { container } = render(<AnnouncementBar text={undefined} />);
    expect(container.firstChild).toBeNull();
  });

  it("retorna null quando text é string vazia", () => {
    const { container } = render(<AnnouncementBar text="" />);
    expect(container.firstChild).toBeNull();
  });

  it("retorna null quando text é apenas whitespace", () => {
    // Em JSX, escapes em atributos string-literal não são processados;
    // usamos expressão `{...}` pra passar real \n\t.
    const { container } = render(<AnnouncementBar text={"   \n\t  "} />);
    expect(container.firstChild).toBeNull();
  });

  it("retorna null quando text contém só tags HTML (strip vira vazio)", () => {
    const { container } = render(<AnnouncementBar text="<div></div>" />);
    expect(container.firstChild).toBeNull();
  });

  it("sanitiza HTML inline mantendo só o conteúdo textual", () => {
    render(
      <AnnouncementBar text='Promoção <script>alert("xss")</script> ativa' />,
    );
    // Marquee replica → múltiplos matches esperados; usar getAllByText.
    const matches = screen.getAllByText(/Promoção/);
    expect(matches.length).toBeGreaterThanOrEqual(2);
    // O conteúdo das tags some — não deve sobrar "script" textual em nenhum
    // lugar.
    expect(screen.queryByText(/script/i)).toBeNull();
  });

  it("a11y — jest-axe ZERO violations", async () => {
    const { container } = render(
      <AnnouncementBar text="Estamos abertos no feriado" />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("a11y — sem violações quando o bar não renderiza", async () => {
    const { container } = render(<AnnouncementBar text={null} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
