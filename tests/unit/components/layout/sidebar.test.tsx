import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const pathnameMock = vi.hoisted(() => ({ value: "/dashboard" }));

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameMock.value,
}));

beforeEach(() => {
  pathnameMock.value = "/dashboard";
});

describe("Sidebar", () => {
  it("renderiza os 5 itens de navegação", async () => {
    const { Sidebar } = await import("@/components/layout/sidebar");
    render(<Sidebar />);
    expect(screen.getByRole("link", { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /buscar/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /leads/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /pipeline/i })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /configurações/i }),
    ).toBeInTheDocument();
  });

  it("marca o link atual com aria-current=page", async () => {
    pathnameMock.value = "/leads";
    const { Sidebar } = await import("@/components/layout/sidebar");
    render(<Sidebar />);
    const active = screen.getByRole("link", { name: /leads/i });
    expect(active).toHaveAttribute("aria-current", "page");
    expect(
      screen.getByRole("link", { name: /dashboard/i }),
    ).not.toHaveAttribute("aria-current");
  });

  it("considera subpaths como ativos (e.g., /leads/123)", async () => {
    pathnameMock.value = "/leads/abc-123";
    const { Sidebar } = await import("@/components/layout/sidebar");
    render(<Sidebar />);
    expect(screen.getByRole("link", { name: /leads/i })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("tem aria-label de navegação principal", async () => {
    const { Sidebar } = await import("@/components/layout/sidebar");
    render(<Sidebar />);
    expect(
      screen.getByRole("complementary", { name: /navegação principal/i }),
    ).toBeInTheDocument();
  });
});
