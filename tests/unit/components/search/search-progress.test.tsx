import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";

import { SearchProgress } from "@/components/search/search-progress";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("SearchProgress", () => {
  it("renderiza o nome do actor e tempo inicial", () => {
    render(<SearchProgress actorName="Google Maps Scraper" />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Executando Google Maps Scraper",
    );
    expect(screen.getByText("0s")).toBeInTheDocument();
  });

  it("incrementa o contador a cada segundo enquanto está executando", () => {
    vi.useFakeTimers();

    render(<SearchProgress actorName="Google Maps Scraper" />);

    act(() => vi.advanceTimersByTime(3_000));

    expect(screen.getByText("3s")).toBeInTheDocument();

  });

  it("para de incrementar quando encerra com sucesso ou erro", () => {
    vi.useFakeTimers();

    const { rerender } = render(
      <SearchProgress actorName="Google Maps Scraper" />,
    );

    act(() => vi.advanceTimersByTime(2_000));
    rerender(
      <SearchProgress actorName="Google Maps Scraper" status="succeeded" />,
    );
    act(() => vi.advanceTimersByTime(3_000));

    expect(screen.getByText("2s")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Google Maps Scraper concluído",
    );

    rerender(<SearchProgress actorName="Google Maps Scraper" status="failed" />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Google Maps Scraper falhou",
    );
    expect(screen.getByText("2s")).toBeInTheDocument();

  });

  it("limpa o intervalo quando desmonta", () => {
    vi.useFakeTimers();
    const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval");

    const { unmount } = render(
      <SearchProgress actorName="Google Maps Scraper" />,
    );

    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();

  });
});
