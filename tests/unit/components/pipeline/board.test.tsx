import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { PipelineBoard } from "@/components/pipeline/board";
import type { PipelineBoard as Board } from "@/lib/leads/list-by-stage";
import type { LeadListItem } from "@/lib/leads/list-leads";

const hoisted = vi.hoisted(() => ({
  refreshSpy: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: hoisted.refreshSpy,
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: hoisted.toastSuccess,
    error: hoisted.toastError,
  },
}));

const board: Board = {
  new: [
    {
      id: "lead-1",
      name: "Barbearia A",
      stage: "new",
      score: 10,
      category: "Barbearia",
      city: "Curitiba",
      state: "PR",
    },
    {
      id: "lead-2",
      name: "Estética B",
      stage: "new",
      score: 20,
      category: null,
      city: null,
      state: null,
    },
  ],
  contacted: [],
  in_conversation: [],
  qualified: [],
  closed_won: [],
  closed_lost: [],
};

beforeEach(() => {
  hoisted.refreshSpy.mockReset();
  hoisted.toastError.mockReset();
  hoisted.toastSuccess.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PipelineBoard", () => {
  it("renderiza colunas com labels traduzidas e cards", () => {
    render(<PipelineBoard board={board} />);
    expect(screen.getByRole("region", { name: /^novo$/i })).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: /^contatado$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: /em conversa/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Barbearia A")).toBeInTheDocument();
    expect(screen.getByText("Estética B")).toBeInTheDocument();
  });

  it("mostra contagem por coluna", () => {
    render(<PipelineBoard board={board} />);
    const novo = screen.getByRole("region", { name: /^novo$/i });
    expect(novo.textContent).toMatch(/2/);
  });

  it("oferece seletor mobile para acessar estágios sem scroll lateral global", async () => {
    render(<PipelineBoard board={board} />);

    const select = screen.getByLabelText(/visualizar estágio/i);
    expect(select).toBeInTheDocument();
    expect(screen.getByTestId("pipeline-board")).toHaveClass("flex");
    expect(screen.getByTestId("pipeline-board")).toHaveClass("overflow-x-auto");

    await userEvent.selectOptions(select, "qualified");

    expect(select).toHaveValue("qualified");
    expect(
      screen.getByRole("region", { name: /^qualificado$/i }),
    ).toBeInTheDocument();
  });

  it("mostra estado vazio com CTA quando não há leads no pipeline", () => {
    render(
      <PipelineBoard
        board={{
          new: [],
          contacted: [],
          in_conversation: [],
          qualified: [],
          closed_won: [],
          closed_lost: [],
        }}
      />,
    );

    expect(screen.getByText(/nenhum lead no pipeline/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /faça sua primeira busca/i }),
    ).toHaveAttribute("href", "/search");
  });

  it("mantém o board na viewport, com scroll horizontal no board e vertical apenas nas colunas", () => {
    render(<PipelineBoard board={board} />);

    expect(screen.getByTestId("pipeline-viewport")).toHaveClass("min-h-0");
    expect(screen.getByTestId("pipeline-viewport")).toHaveClass("flex-1");
    expect(screen.getByTestId("pipeline-board")).toHaveClass("h-full");
    expect(screen.getByTestId("pipeline-board")).toHaveClass("overflow-x-auto");

    const novo = screen.getByRole("region", { name: /^novo$/i });
    expect(novo).toHaveClass("h-full");
    expect(novo).toHaveClass("w-[28rem]");
    expect(novo).toHaveClass("shrink-0");
    expect(novo).toHaveClass("overflow-hidden");
    expect(screen.getByTestId("pipeline-column-list-new")).toHaveClass(
      "overflow-y-auto",
    );
  });

  it("moveLead (helper exposto via prop) faz PATCH otimista, refresh em sucesso", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "lead-1", stage: "contacted" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    let trigger: ((args: { leadId: string; toStage: string }) => void) | null =
      null;
    render(
      <PipelineBoard
        board={board}
        onMoveCommand={(fn) => {
          trigger = fn;
        }}
      />,
    );

    expect(trigger).not.toBeNull();
    trigger!({ leadId: "lead-1", toStage: "contacted" });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    expect(fetchMock.mock.calls[0]![0]).toBe("/api/leads/lead-1");
    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body as string)).toEqual({ stage: "contacted" });

    await waitFor(() => {
      expect(hoisted.refreshSpy).toHaveBeenCalled();
    });
    expect(hoisted.toastError).not.toHaveBeenCalled();
  });

  it("rollback + toast.error quando PATCH falha", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "boom" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    let trigger: ((args: { leadId: string; toStage: string }) => void) | null =
      null;
    render(
      <PipelineBoard
        board={board}
        onMoveCommand={(fn) => {
          trigger = fn;
        }}
      />,
    );

    trigger!({ leadId: "lead-1", toStage: "qualified" });

    await waitFor(() => {
      expect(hoisted.toastError).toHaveBeenCalled();
    });
    expect(hoisted.refreshSpy).not.toHaveBeenCalled();
    // O card volta para a coluna "Novo"
    const novo = screen.getByRole("region", { name: /^novo$/i });
    expect(novo.textContent).toContain("Barbearia A");
  });

  it("noop quando toStage === fromStage", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    let trigger: ((args: { leadId: string; toStage: string }) => void) | null =
      null;
    render(
      <PipelineBoard
        board={board}
        onMoveCommand={(fn) => {
          trigger = fn;
        }}
      />,
    );

    trigger!({ leadId: "lead-1", toStage: "new" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("click em card abre o drawer com o lead carregado via GET /api/leads/[id] (#137)", async () => {
    const user = userEvent.setup();
    const fullLead: LeadListItem = {
      id: "lead-1",
      user_id: "u1",
      name: "Barbearia A",
      source: "google_maps",
      source_search_job_id: null,
      website: null,
      instagram_handle: null,
      phone: null,
      whatsapp: null,
      email: null,
      category: "Barbearia",
      city: "Curitiba",
      state: "PR",
      country: "Brasil",
      has_website: false,
      rating: null,
      reviews_count: null,
      followers_count: null,
      stage: "new",
      score: 10,
      notes: null,
      raw: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      enriched_at: null,
      tags: [],
    };

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url === "/api/leads/lead-1") {
        return {
          ok: true,
          json: async () => fullLead,
        } as Response;
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<PipelineBoard board={board} tags={[]} />);

    await user.click(screen.getByText("Barbearia A"));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/leads/lead-1");
    });

    // Drawer abre com o lead carregado — SheetTitle do drawer mostra o nome.
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { level: 2, name: "Barbearia A" }),
      ).toBeInTheDocument();
    });
  });

  it("toast.error quando GET /api/leads/[id] falha — drawer não abre", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Lead não encontrado" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<PipelineBoard board={board} tags={[]} />);

    await user.click(screen.getByText("Barbearia A"));

    await waitFor(() => {
      expect(hoisted.toastError).toHaveBeenCalled();
    });
    expect(
      screen.queryByRole("heading", { level: 2, name: "Barbearia A" }),
    ).not.toBeInTheDocument();
  });
});
