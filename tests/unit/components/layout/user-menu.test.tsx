import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const PUBLIC_ENV = {
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
} as const;

let savedEnv: NodeJS.ProcessEnv;

const supabaseMock = vi.hoisted(() => ({
  signOut: vi.fn(),
}));

const routerMock = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
}));

const toastMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
}));

vi.mock("sonner", () => ({
  toast: toastMock,
}));

vi.mock("@/lib/supabase/client", () => ({
  createBrowserSupabase: () => ({ auth: supabaseMock }),
}));

beforeEach(() => {
  savedEnv = { ...process.env };
  Object.assign(process.env, PUBLIC_ENV);
  supabaseMock.signOut.mockReset();
  routerMock.push.mockReset();
  routerMock.refresh.mockReset();
  toastMock.success.mockReset();
  toastMock.error.mockReset();
  vi.resetModules();
});

afterEach(() => {
  process.env = savedEnv;
  vi.resetModules();
});

describe("UserMenu", () => {
  it("renderiza avatar com inicials do nome", async () => {
    const { UserMenu } = await import("@/components/layout/user-menu");
    render(
      <UserMenu
        email="vini@gasp.com"
        name="Vini Gasparello"
        avatarUrl={null}
      />,
    );
    expect(screen.getByText("VG")).toBeInTheDocument();
  });

  it("usa primeira letra do email quando name é null", async () => {
    const { UserMenu } = await import("@/components/layout/user-menu");
    render(
      <UserMenu email="alice@gasp.com" name={null} avatarUrl={null} />,
    );
    expect(screen.getByText("A")).toBeInTheDocument();
  });

  it("nome com uma palavra usa só primeira letra", async () => {
    const { UserMenu } = await import("@/components/layout/user-menu");
    render(<UserMenu email="x@y.com" name="Vini" avatarUrl={null} />);
    expect(screen.getByText("V")).toBeInTheDocument();
  });

  it("logout chama supabase.signOut e redireciona para /login em sucesso", async () => {
    supabaseMock.signOut.mockResolvedValue({ error: null });
    const user = userEvent.setup();
    const { UserMenu } = await import("@/components/layout/user-menu");
    render(
      <UserMenu email="v@gasp.com" name="Vini" avatarUrl={null} />,
    );
    await user.click(screen.getByRole("button", { name: /menu do usuário/i }));
    await user.click(screen.getByRole("menuitem", { name: /sair/i }));
    expect(supabaseMock.signOut).toHaveBeenCalled();
    expect(toastMock.success).toHaveBeenCalled();
    expect(routerMock.push).toHaveBeenCalledWith("/login");
  });

  it("mostra toast de erro quando signOut falha", async () => {
    supabaseMock.signOut.mockResolvedValue({
      error: { message: "Falha de rede" },
    });
    const user = userEvent.setup();
    const { UserMenu } = await import("@/components/layout/user-menu");
    render(
      <UserMenu email="v@gasp.com" name="Vini" avatarUrl={null} />,
    );
    await user.click(screen.getByRole("button", { name: /menu do usuário/i }));
    await user.click(screen.getByRole("menuitem", { name: /sair/i }));
    expect(toastMock.error).toHaveBeenCalled();
    expect(routerMock.push).not.toHaveBeenCalled();
  });
});
