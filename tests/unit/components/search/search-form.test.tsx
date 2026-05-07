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

  it("envia busca Google Maps, mostra toast e redireciona para leads", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          jobId: "job-1",
          status: "succeeded",
          leadsCount: 3,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
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
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            searchStringsArray: ["barbearia Curitiba PR"],
            maxCrawledPlacesPerSearch: 25,
            language: "pt-BR",
            countryCode: "br",
          }),
        }),
      );
      expect(toastMock.success).toHaveBeenCalledWith(
        "Busca concluída",
        expect.objectContaining({ description: "3 leads encontrados." }),
      );
      expect(routerMock.push).toHaveBeenCalledWith("/leads?searchJobId=job-1");
    });
  });

  it("mostra progresso enquanto aguarda resposta da API", async () => {
    const user = userEvent.setup();
    let resolveFetch: (response: Response) => void = () => {};
    vi.mocked(fetch).mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      }),
    );
    const SearchForm = await loadComponent();
    render(<SearchForm />);

    await user.type(screen.getByLabelText(/termo de busca/i), "barbearia");
    await user.click(screen.getByRole("button", { name: /adicionar termo/i }));
    await user.type(screen.getByLabelText(/cidade/i), "Curitiba");
    await user.type(screen.getByLabelText(/estado/i), "PR");
    await user.click(screen.getByRole("button", { name: /^buscar$/i }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Executando Google Maps",
    );

    resolveFetch(
      new Response(
        JSON.stringify({
          jobId: "job-1",
          status: "succeeded",
          leadsCount: 1,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
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

  it("mostra toast de erro quando API falha", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: "Falha ao buscar" }), {
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
        expect.objectContaining({ description: "Falha ao buscar" }),
      );
      expect(routerMock.push).not.toHaveBeenCalled();
    });
  });

  it("mostra toast genérico quando fetch rejeita sem Error", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockRejectedValue("falha");
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
        expect.objectContaining({ description: "Erro inesperado" }),
      );
    });
  });
});
