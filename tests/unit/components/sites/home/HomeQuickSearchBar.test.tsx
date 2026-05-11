/**
 * Testes do <HomeQuickSearchBar /> (issue #221 / Sprint 4 / H1).
 *
 * Client Component embutido no Hero — 3 inputs (marca, modelo, preço máx)
 * + submit que redireciona para `/sites/<slug>/estoque?m=...&model=...&p=...`.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe, toHaveNoViolations } from "jest-axe";
import { describe, expect, it, vi } from "vitest";

import { HomeQuickSearchBar } from "@/components/sites/home/HomeQuickSearchBar";

expect.extend(toHaveNoViolations);

const pushMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

const SLUG = "j7k2p9-touring-cars";

const baseProps = {
  slug: SLUG,
  primary_color: "#D90429" as const,
  text_on_primary: "#FFFFFF" as const,
};

describe("<HomeQuickSearchBar />", () => {
  it("renderiza 3 inputs (marca, modelo, preço max) e botão submit", () => {
    render(<HomeQuickSearchBar {...baseProps} />);
    expect(screen.getByLabelText(/marca/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/modelo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/preço.*máx/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /buscar/i }),
    ).toBeInTheDocument();
  });

  it("submit redireciona com querystring `m`, `model`, `p`", async () => {
    pushMock.mockClear();
    const user = userEvent.setup();
    render(<HomeQuickSearchBar {...baseProps} />);
    await user.type(screen.getByLabelText(/marca/i), "Toyota");
    await user.type(screen.getByLabelText(/modelo/i), "Corolla");
    await user.type(screen.getByLabelText(/preço.*máx/i), "120000");
    await user.click(screen.getByRole("button", { name: /buscar/i }));
    expect(pushMock).toHaveBeenCalledTimes(1);
    expect(pushMock).toHaveBeenCalledWith(
      `/sites/${SLUG}/estoque?m=Toyota&model=Corolla&p=120000`,
    );
  });

  it("submit sem campos preenchidos cai em `/sites/<slug>/estoque` (sem QS)", async () => {
    pushMock.mockClear();
    const user = userEvent.setup();
    render(<HomeQuickSearchBar {...baseProps} />);
    await user.click(screen.getByRole("button", { name: /buscar/i }));
    expect(pushMock).toHaveBeenCalledWith(`/sites/${SLUG}/estoque`);
  });

  it("submit só com marca emite só `m=`", async () => {
    pushMock.mockClear();
    const user = userEvent.setup();
    render(<HomeQuickSearchBar {...baseProps} />);
    await user.type(screen.getByLabelText(/marca/i), "Honda");
    await user.click(screen.getByRole("button", { name: /buscar/i }));
    expect(pushMock).toHaveBeenCalledWith(
      `/sites/${SLUG}/estoque?m=Honda`,
    );
  });

  it("submit ignora whitespace puro nos campos", async () => {
    pushMock.mockClear();
    const user = userEvent.setup();
    render(<HomeQuickSearchBar {...baseProps} />);
    await user.type(screen.getByLabelText(/marca/i), "   ");
    await user.click(screen.getByRole("button", { name: /buscar/i }));
    expect(pushMock).toHaveBeenCalledWith(`/sites/${SLUG}/estoque`);
  });

  it("aplica primary_color no botão submit via style inline (sanitizado)", () => {
    render(<HomeQuickSearchBar {...baseProps} />);
    const button = screen.getByRole("button", { name: /buscar/i });
    expect(button).toHaveStyle({
      backgroundColor: "#D90429",
      color: "#FFFFFF",
    });
  });

  it("zero violations a11y (axe-core)", async () => {
    const { container } = render(<HomeQuickSearchBar {...baseProps} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
