import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/dashboard",
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "dark", setTheme: vi.fn() }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createBrowserSupabase: () => ({ auth: { signOut: vi.fn() } }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

describe("Topbar", () => {
  it("renderiza ThemeToggle e UserMenu", async () => {
    const { Topbar } = await import("@/components/layout/topbar");
    render(<Topbar email="v@b.com" name="Vini" avatarUrl={null} />);
    expect(
      screen.getByRole("button", { name: /alternar tema/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /menu do usuário/i }),
    ).toBeInTheDocument();
  });

  it("abre navegação mobile pelo Topbar", async () => {
    const { Topbar } = await import("@/components/layout/topbar");
    render(<Topbar email="v@b.com" name="Vini" avatarUrl={null} />);

    await userEvent.click(
      screen.getByRole("button", { name: /abrir menu principal/i }),
    );

    expect(
      screen.getByRole("dialog", { name: /navegação principal/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /dashboard/i })).toHaveAttribute(
      "href",
      "/dashboard",
    );
    expect(screen.getByRole("link", { name: /leads/i })).toHaveAttribute(
      "href",
      "/leads",
    );
  });
});
