import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const PUBLIC_ENV = {
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key-123",
} as const;

let savedEnv: NodeJS.ProcessEnv;

const supabaseMock = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  signInWithOAuth: vi.fn(),
}));

const routerMock = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
}));

const searchParamsMock = vi.hoisted(() => ({
  get: vi.fn(),
}));

const toastMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
  useSearchParams: () => searchParamsMock,
}));

vi.mock("sonner", () => ({
  toast: toastMock,
  Toaster: () => null,
}));

vi.mock("@/lib/supabase/client", () => ({
  createBrowserSupabase: () => ({ auth: supabaseMock }),
}));

beforeEach(() => {
  savedEnv = { ...process.env };
  Object.assign(process.env, PUBLIC_ENV);
  supabaseMock.signInWithPassword.mockReset();
  supabaseMock.signUp.mockReset();
  supabaseMock.signInWithOAuth.mockReset();
  routerMock.push.mockReset();
  routerMock.refresh.mockReset();
  searchParamsMock.get.mockReset();
  searchParamsMock.get.mockImplementation((key: string) => {
    if (key === "redirectTo") return null;
    if (key === "error") return null;
    return null;
  });
  toastMock.success.mockReset();
  toastMock.error.mockReset();
  vi.resetModules();
});

afterEach(() => {
  process.env = savedEnv;
  vi.resetModules();
});

async function loadPage() {
  const mod = await import("@/app/(auth)/login/page");
  return mod.default;
}

describe("LoginPage", () => {
  it("renderiza tabs Entrar/Cadastrar e botão Google", async () => {
    const Page = await loadPage();
    render(<Page />);
    expect(screen.getByRole("tab", { name: "Entrar" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Cadastrar" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /continuar com google/i }),
    ).toBeInTheDocument();
  });

  it("valida campos vazios no Entrar (não chama supabase)", async () => {
    const user = userEvent.setup();
    const Page = await loadPage();
    render(<Page />);
    await user.click(screen.getByRole("button", { name: /^entrar$/i }));
    expect(supabaseMock.signInWithPassword).not.toHaveBeenCalled();
    expect(screen.getByText(/e-mail inválido/i)).toBeInTheDocument();
  });

  it("submete signIn válido e redireciona em sucesso", async () => {
    const user = userEvent.setup();
    supabaseMock.signInWithPassword.mockResolvedValue({ error: null });
    const Page = await loadPage();
    render(<Page />);
    await user.type(screen.getAllByLabelText(/e-mail/i)[0]!, "v@gasplab.com");
    await user.type(screen.getAllByLabelText(/senha/i)[0]!, "minhasenha");
    await user.click(screen.getByRole("button", { name: /^entrar$/i }));

    await vi.waitFor(() => {
      expect(supabaseMock.signInWithPassword).toHaveBeenCalledWith({
        email: "v@gasplab.com",
        password: "minhasenha",
      });
      expect(toastMock.success).toHaveBeenCalled();
      expect(routerMock.push).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("usa redirectTo da URL como destino do push", async () => {
    searchParamsMock.get.mockImplementation((k: string) =>
      k === "redirectTo" ? "/leads" : null,
    );
    const user = userEvent.setup();
    supabaseMock.signInWithPassword.mockResolvedValue({ error: null });
    const Page = await loadPage();
    render(<Page />);
    await user.type(screen.getAllByLabelText(/e-mail/i)[0]!, "v@gasplab.com");
    await user.type(screen.getAllByLabelText(/senha/i)[0]!, "minhasenha");
    await user.click(screen.getByRole("button", { name: /^entrar$/i }));
    await vi.waitFor(() => {
      expect(routerMock.push).toHaveBeenCalledWith("/leads");
    });
  });

  it("mostra toast de erro quando signIn falha", async () => {
    const user = userEvent.setup();
    supabaseMock.signInWithPassword.mockResolvedValue({
      error: { message: "Credenciais inválidas" },
    });
    const Page = await loadPage();
    render(<Page />);
    await user.type(screen.getAllByLabelText(/e-mail/i)[0]!, "v@gasplab.com");
    await user.type(screen.getAllByLabelText(/senha/i)[0]!, "minhasenha");
    await user.click(screen.getByRole("button", { name: /^entrar$/i }));
    await vi.waitFor(() => {
      expect(toastMock.error).toHaveBeenCalled();
      expect(routerMock.push).not.toHaveBeenCalled();
    });
  });

  it("Google OAuth usa redirectTo correto codificado", async () => {
    searchParamsMock.get.mockImplementation((k: string) =>
      k === "redirectTo" ? "/leads?stage=new" : null,
    );
    const user = userEvent.setup();
    supabaseMock.signInWithOAuth.mockResolvedValue({ error: null });
    const Page = await loadPage();
    render(<Page />);
    await user.click(
      screen.getByRole("button", { name: /continuar com google/i }),
    );
    await vi.waitFor(() => {
      expect(supabaseMock.signInWithOAuth).toHaveBeenCalled();
    });
    const call = supabaseMock.signInWithOAuth.mock.calls[0]![0]!;
    expect(call).toMatchObject({ provider: "google" });
    expect(call.options.redirectTo).toContain(
      "/callback?redirectTo=" + encodeURIComponent("/leads?stage=new"),
    );
  });

  it("exibe erro vindo de ?error= na URL", async () => {
    searchParamsMock.get.mockImplementation((k: string) =>
      k === "error" ? "Sessão expirou, faça login novamente." : null,
    );
    const Page = await loadPage();
    render(<Page />);
    expect(
      screen.getByText("Sessão expirou, faça login novamente."),
    ).toBeInTheDocument();
  });
});
