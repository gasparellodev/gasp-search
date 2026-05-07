import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
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
});
