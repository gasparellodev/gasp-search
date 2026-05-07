import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const themeMock = vi.hoisted(() => ({
  theme: "dark",
  setTheme: vi.fn(),
}));

vi.mock("next-themes", () => ({
  useTheme: () => themeMock,
}));

beforeEach(() => {
  themeMock.theme = "dark";
  themeMock.setTheme.mockReset();
});

afterEach(() => {
  vi.resetModules();
});

describe("ThemeToggle", () => {
  it("renderiza com aria-label 'Alternar tema'", async () => {
    const { ThemeToggle } = await import("@/components/layout/theme-toggle");
    render(<ThemeToggle />);
    expect(
      screen.getByRole("button", { name: /alternar tema/i }),
    ).toBeInTheDocument();
  });

  it("clica e troca de dark para light", async () => {
    const user = userEvent.setup();
    const { ThemeToggle } = await import("@/components/layout/theme-toggle");
    render(<ThemeToggle />);
    await user.click(screen.getByRole("button", { name: /alternar tema/i }));
    expect(themeMock.setTheme).toHaveBeenCalledWith("light");
  });

  it("clica e troca de light para dark", async () => {
    themeMock.theme = "light";
    const user = userEvent.setup();
    const { ThemeToggle } = await import("@/components/layout/theme-toggle");
    render(<ThemeToggle />);
    await user.click(screen.getByRole("button", { name: /alternar tema/i }));
    expect(themeMock.setTheme).toHaveBeenCalledWith("dark");
  });
});
