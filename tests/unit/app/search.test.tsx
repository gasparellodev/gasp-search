import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import SearchPage from "@/app/(app)/search/page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe("SearchPage", () => {
  it("renderiza o formulário de busca Google Maps", () => {
    render(<SearchPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Buscar" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: /google maps/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("form", { name: /buscar leads/i }))
      .toBeInTheDocument();
  });
});
