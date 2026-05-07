import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

import { PipelineBoard } from "@/components/pipeline/board";
import type { PipelineBoard as Board } from "@/lib/leads/list-by-stage";

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
});
