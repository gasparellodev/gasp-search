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
  sourceBreakdown: [
    {
      source: "google_maps",
      total: 80,
      closedWon: 15,
      conversionRate: 0.1875,
    },
    {
      source: "instagram",
      total: 30,
      closedWon: 6,
      conversionRate: 0.2,
    },
    {
      source: "website_contact",
      total: 18,
      closedWon: 0,
      conversionRate: 0,
    },
  ],
  funnel: [
    { stage: "new", count: 40, dropRate: null },
    { stage: "contacted", count: 25, dropRate: 0.375 },
    { stage: "in_conversation", count: 18, dropRate: 0.28 },
    { stage: "qualified", count: 12, dropRate: 0.333 },
    { stage: "closed_won", count: 21, dropRate: -0.75 },
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
    expect(screen.getAllByText("Em conversa").length).toBeGreaterThan(0);
    expect(screen.getAllByText("18").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Google Maps").length).toBeGreaterThan(0);
    expect(screen.getByText("Concluída")).toBeInTheDocument();
    expect(screen.getByText("32 leads")).toBeInTheDocument();
    expect(screen.getByText("Atribuição por fonte")).toBeInTheDocument();
    expect(screen.getByText("Funil de conversão")).toBeInTheDocument();
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

  it("renderiza CTA quando a base ainda está vazia", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchOnce({
        ...summary,
        totalLeads: 0,
        newLeadsLast7Days: 0,
        leadsByStage: {
          new: 0,
          contacted: 0,
          in_conversation: 0,
          qualified: 0,
          closed_won: 0,
          closed_lost: 0,
        },
        recentSearches: [],
        sourceBreakdown: [],
        funnel: [
          { stage: "new", count: 0, dropRate: null },
          { stage: "contacted", count: 0, dropRate: null },
          { stage: "in_conversation", count: 0, dropRate: null },
          { stage: "qualified", count: 0, dropRate: null },
          { stage: "closed_won", count: 0, dropRate: null },
        ],
      }),
    );

    render(<DashboardView />);

    expect(await screen.findByText("Base ainda vazia")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /faça sua primeira busca/i }),
    ).toHaveAttribute("href", "/search");
  });
});
