import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const routerMock = vi.hoisted(() => ({
  push: vi.fn(),
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

beforeEach(() => {
  routerMock.push.mockReset();
  toastMock.success.mockReset();
  toastMock.error.mockReset();
  vi.stubGlobal("fetch", vi.fn());
  vi.resetModules();
  vi.useRealTimers();
});

async function loadComponent() {
  const mod = await import("@/components/search/search-form");
  return mod.SearchForm;
}

describe("SearchForm", () => {
  it("renderiza estado de progresso", async () => {
    const { SearchProgress } = await import(
      "@/components/search/search-progress"
    );
    render(<SearchProgress />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Executando Google Maps",
    );
  });

  it("adiciona e remove chips de termos", async () => {
    const user = userEvent.setup();
    const SearchForm = await loadComponent();
    render(<SearchForm />);

    await user.type(screen.getByLabelText(/termo de busca/i), "barbearia");
    await user.click(screen.getByRole("button", { name: /adicionar termo/i }));

    expect(screen.getByText("barbearia")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /remover termo barbearia/i }),
    );

    expect(screen.queryByText("barbearia")).not.toBeInTheDocument();
  });

  it("organiza termo de busca em layout responsivo", async () => {
    const SearchForm = await loadComponent();
    render(<SearchForm />);

    const termInput = screen.getByLabelText(/termo de busca/i);
    const termRow = termInput.closest("[data-testid='search-term-row']");
    const addButton = screen.getByRole("button", {
      name: /adicionar termo/i,
    });

    expect(termRow).toHaveClass("flex-col");
    expect(termRow).toHaveClass("sm:flex-row");
    expect(addButton).toHaveClass("w-full");
    expect(addButton).toHaveClass("sm:w-auto");
  });

  it("adiciona termo com Enter e ignora duplicados", async () => {
    const user = userEvent.setup();
    const SearchForm = await loadComponent();
    render(<SearchForm />);

    const termInput = screen.getByLabelText(/termo de busca/i);
    await user.type(termInput, "barbearia{Enter}");
    await user.type(termInput, "barbearia");
    await user.click(screen.getByRole("button", { name: /adicionar termo/i }));

    expect(screen.getAllByText("barbearia")).toHaveLength(1);
    expect(termInput).toHaveValue("");
  });

  it("valida formulário sem termos antes de chamar API", async () => {
    const user = userEvent.setup();
    const SearchForm = await loadComponent();
    render(<SearchForm />);

    await user.type(screen.getByLabelText(/cidade/i), "Curitiba");
    await user.type(screen.getByLabelText(/estado/i), "PR");
    await user.click(screen.getByRole("button", { name: /^buscar$/i }));

    expect(await screen.findByText(/adicione ao menos um termo/i)).toBeVisible();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("envia busca Google Maps e faz polling do status com sucesso", async () => {
    const user = userEvent.setup();

    // Mock the initial POST request
    vi.mocked(fetch).mockImplementation(async (url) => {
      if (url === "/api/apify/google-maps") {
        return new Response(
          JSON.stringify({
            jobId: "job-1",
            status: "queued",
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      // Mock the GET polling request
      if (url === "/api/search-jobs/job-1") {
        return new Response(
          JSON.stringify({
            id: "job-1",
            status: "succeeded",
            results_count: 5,
            error_message: null
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
      return new Response(null, { status: 404 });
    });

    const SearchForm = await loadComponent();
    render(<SearchForm />);

    await user.type(screen.getByLabelText(/termo de busca/i), "barbearia");
    await user.click(screen.getByRole("button", { name: /adicionar termo/i }));
    await user.type(screen.getByLabelText(/cidade/i), "Curitiba");
    await user.type(screen.getByLabelText(/estado/i), "PR");
    await user.clear(screen.getByLabelText(/quantidade por termo/i));
    await user.type(screen.getByLabelText(/quantidade por termo/i), "25");
    await user.click(screen.getByRole("button", { name: /^buscar$/i }));

    await vi.waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/apify/google-maps",
        expect.objectContaining({ method: "POST" })
      );

      // Verify polling occurred
      expect(fetch).toHaveBeenCalledWith("/api/search-jobs/job-1");

      expect(toastMock.success).toHaveBeenCalledWith(
        "Busca concluída",
        expect.objectContaining({ description: "5 leads encontrados." }),
      );
      expect(routerMock.push).toHaveBeenCalledWith("/leads?searchJobId=job-1");
    });

    vi.useRealTimers();
  });

  it("mostra toast de erro quando API retorna payload inválido", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const SearchForm = await loadComponent();
    render(<SearchForm />);

    await user.type(screen.getByLabelText(/termo de busca/i), "barbearia");
    await user.click(screen.getByRole("button", { name: /adicionar termo/i }));
    await user.type(screen.getByLabelText(/cidade/i), "Curitiba");
    await user.type(screen.getByLabelText(/estado/i), "PR");
    await user.click(screen.getByRole("button", { name: /^buscar$/i }));

    await vi.waitFor(() => {
      expect(toastMock.error).toHaveBeenCalledWith(
        "Busca falhou",
        expect.objectContaining({ description: "Resposta inválida" }),
      );
    });
  });

  it("mostra toast de erro quando API de inicialização falha", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: "Falha ao criar busca no Google Maps. Tente novamente." }), {
        status: 502,
        headers: { "content-type": "application/json" },
      }),
    );
    const SearchForm = await loadComponent();
    render(<SearchForm />);

    await user.type(screen.getByLabelText(/termo de busca/i), "barbearia");
    await user.click(screen.getByRole("button", { name: /adicionar termo/i }));
    await user.type(screen.getByLabelText(/cidade/i), "Curitiba");
    await user.type(screen.getByLabelText(/estado/i), "PR");
    await user.click(screen.getByRole("button", { name: /^buscar$/i }));

    await vi.waitFor(() => {
      expect(toastMock.error).toHaveBeenCalledWith(
        "Busca falhou",
        expect.objectContaining({ description: "Falha ao criar busca no Google Maps. Tente novamente." }),
      );
      expect(routerMock.push).not.toHaveBeenCalled();
    });
  });

  it("mostra toast de erro quando o polling detecta falha do job", async () => {
    const user = userEvent.setup();

    vi.mocked(fetch).mockImplementation(async (url) => {
      if (url === "/api/apify/google-maps") {
        return new Response(JSON.stringify({ jobId: "job-err", status: "queued" }), { status: 200 });
      }
      if (url === "/api/search-jobs/job-err") {
        return new Response(
          JSON.stringify({ id: "job-err", status: "failed", results_count: 0, error_message: "actor timeout" }),
          { status: 200 }
        );
      }
      return new Response(null, { status: 404 });
    });

    const SearchForm = await loadComponent();
    render(<SearchForm />);

    await user.type(screen.getByLabelText(/termo de busca/i), "barbearia");
    await user.click(screen.getByRole("button", { name: /adicionar termo/i }));
    await user.type(screen.getByLabelText(/cidade/i), "Curitiba");
    await user.type(screen.getByLabelText(/estado/i), "PR");
    await user.click(screen.getByRole("button", { name: /^buscar$/i }));

    await vi.waitFor(() => {
      expect(toastMock.error).toHaveBeenCalledWith(
        "Busca falhou",
        expect.objectContaining({ description: "actor timeout" }),
      );
    });

    vi.useRealTimers();
  });
});
