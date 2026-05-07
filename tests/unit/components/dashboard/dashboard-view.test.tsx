import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { DashboardView } from "@/components/dashboard/dashboard-view";

const summary = {
  totalLeads: 128,
  newLeadsLast7Days: 19,
  leadsByStage: {
    new: 40,
    contacted: 25,
    in_conversation: 18,
    qualified: 12,
    closed_won: 21,
    closed_lost: 12,
  },
  recentSearches: [
    {
      id: "job-1",
      source: "google_maps",
      status: "succeeded",
      resultsCount: 32,
      errorMessage: null,
      createdAt: "2026-05-07T12:00:00Z",
      finishedAt: "2026-05-07T12:01:00Z",
    },
  ],
};

function mockFetchOnce(body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => body,
  });
}

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetchOnce(summary));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("DashboardView", () => {
  it("mostra skeleton inicial e renderiza cards/lista após carregar", async () => {
    render(<DashboardView />);

    expect(screen.getByTestId("dashboard-skeleton")).toBeInTheDocument();

    expect(await screen.findByText("128")).toBeInTheDocument();
    expect(screen.getByText("19")).toBeInTheDocument();
    expect(screen.getByText("Em conversa")).toBeInTheDocument();
    expect(screen.getByText("18")).toBeInTheDocument();
    expect(screen.getByText("Google Maps")).toBeInTheDocument();
    expect(screen.getByText("Concluída")).toBeInTheDocument();
    expect(screen.getByText("32 leads")).toBeInTheDocument();
  });

  it("atualiza dados ao voltar o foco da janela", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => summary,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...summary,
          totalLeads: 129,
          newLeadsLast7Days: 20,
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    render(<DashboardView />);

    expect(await screen.findByText("128")).toBeInTheDocument();

    window.dispatchEvent(new Event("focus"));

    await waitFor(() => {
      expect(screen.getByText("129")).toBeInTheDocument();
    });
    expect(screen.getByText("20")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("renderiza estado vazio quando não há buscas recentes", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchOnce({
        ...summary,
        recentSearches: [],
      }),
    );

    render(<DashboardView />);

    expect(
      await screen.findByText("Nenhuma busca executada ainda."),
    ).toBeInTheDocument();
  });
});
