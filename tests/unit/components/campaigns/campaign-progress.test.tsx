import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const toastMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: toastMock }));

const routerMock = vi.hoisted(() => ({
  refresh: vi.fn(),
  push: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  replace: vi.fn(),
  prefetch: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
}));

const supabaseChannel = vi.hoisted(() => ({
  on: vi.fn(),
  subscribe: vi.fn(),
}));
const supabaseClient = vi.hoisted(() => ({
  channel: vi.fn(() => supabaseChannel),
  removeChannel: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createBrowserSupabase: () => supabaseClient,
}));

import { CampaignProgress } from "@/components/campaigns/campaign-progress";

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  toastMock.success.mockReset();
  toastMock.error.mockReset();
  supabaseChannel.on.mockReset();
  supabaseChannel.subscribe.mockReset();
  supabaseClient.channel.mockClear();
  supabaseChannel.on.mockReturnValue(supabaseChannel);
  supabaseChannel.subscribe.mockReturnValue(supabaseChannel);
  routerMock.refresh.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CampaignProgress", () => {
  it("renderiza nome, status running e barra com %", () => {
    render(
      <CampaignProgress
        initial={{
          id: "c1",
          name: "Campanha X",
          status: "running",
          total_count: 4,
          sent_count: 1,
          failed_count: 1,
          started_at: null,
          completed_at: null,
        }}
      />,
    );
    expect(screen.getByText("Campanha X")).toBeInTheDocument();
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "50");
  });

  it("mostra botão Cancelar quando running", () => {
    render(
      <CampaignProgress
        initial={{
          id: "c1",
          name: "X",
          status: "running",
          total_count: 1,
          sent_count: 0,
          failed_count: 0,
          started_at: null,
          completed_at: null,
        }}
      />,
    );
    expect(
      screen.getByRole("button", { name: /cancelar/i }),
    ).toBeInTheDocument();
  });

  it("não mostra Cancelar quando completed", () => {
    render(
      <CampaignProgress
        initial={{
          id: "c1",
          name: "X",
          status: "completed",
          total_count: 1,
          sent_count: 1,
          failed_count: 0,
          started_at: null,
          completed_at: null,
        }}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /cancelar/i }),
    ).toBeNull();
    expect(screen.getByText(/conclu[ií]da/i)).toBeInTheDocument();
  });

  it("clica em Cancelar e chama PATCH", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(
      <CampaignProgress
        initial={{
          id: "c1",
          name: "X",
          status: "running",
          total_count: 1,
          sent_count: 0,
          failed_count: 0,
          started_at: null,
          completed_at: null,
        }}
      />,
    );
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ campaign: { id: "c1", status: "cancelled" } })),
    );
    await user.click(screen.getByRole("button", { name: /cancelar/i }));
    await waitFor(() => {
      expect(toastMock.success).toHaveBeenCalled();
    });
    expect(fetchMock.mock.calls[0]![0]).toBe("/api/campaigns/c1");
    expect((fetchMock.mock.calls[0]![1] as RequestInit).method).toBe("PATCH");
  });

  it("subscreve canal Realtime de campaigns", () => {
    render(
      <CampaignProgress
        initial={{
          id: "c1",
          name: "X",
          status: "running",
          total_count: 1,
          sent_count: 0,
          failed_count: 0,
          started_at: null,
          completed_at: null,
        }}
      />,
    );
    expect(supabaseClient.channel).toHaveBeenCalledWith("campaigns:c1");
  });
});
