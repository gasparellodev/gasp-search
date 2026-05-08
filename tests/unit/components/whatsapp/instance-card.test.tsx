import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const toastMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: toastMock }));

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

import { InstanceCard } from "@/components/whatsapp/instance-card";

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  toastMock.success.mockReset();
  toastMock.error.mockReset();
  supabaseChannel.on.mockReset();
  supabaseChannel.subscribe.mockReset();
  supabaseClient.channel.mockClear();
  supabaseClient.removeChannel.mockClear();
  supabaseChannel.on.mockReturnValue(supabaseChannel);
  supabaseChannel.subscribe.mockReturnValue(supabaseChannel);
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("InstanceCard", () => {
  it("renderiza skeleton enquanto carrega o estado inicial", () => {
    fetchMock.mockImplementation(() => new Promise(() => {})); // never resolves
    render(<InstanceCard />);
    expect(screen.queryByTestId("whatsapp-instance-card")).toBeNull();
  });

  it("mostra estado disconnected com botão Conectar", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        status: "disconnected",
        phoneNumber: null,
        lastSeenAt: null,
      }),
    );
    render(<InstanceCard />);
    await waitFor(() => {
      expect(screen.getByText(/nenhum número conectado/i)).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /conectar/i })).toBeInTheDocument();
    expect(screen.getByTestId("whatsapp-status")).toHaveTextContent(
      /desconectado/i,
    );
  });

  it("mostra estado connected com phone e botão Desconectar", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        status: "connected",
        phoneNumber: "5511999998888",
        lastSeenAt: "2026-05-08T10:00:00Z",
      }),
    );
    render(<InstanceCard />);
    await waitFor(() => {
      expect(screen.getByText(/5511999998888/)).toBeInTheDocument();
    });
    expect(
      screen.getByRole("button", { name: /desconectar/i }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("whatsapp-status")).toHaveTextContent(
      /conectado/i,
    );
  });

  it("clica em Conectar e mostra QR Code retornado", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        status: "disconnected",
        phoneNumber: null,
        lastSeenAt: null,
      }),
    );
    render(<InstanceCard />);
    await waitFor(() => screen.getByRole("button", { name: /conectar/i }));

    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        { status: "qr_pending", qrcode: "data:image/png;base64,abc" },
        201,
      ),
    );
    // Polling do QR depois que o estado vira qr_pending — devolve mesmo QR.
    fetchMock.mockResolvedValue(
      jsonResponse({
        qrcode: "data:image/png;base64,abc",
        pairingCode: null,
        status: "qr_pending",
      }),
    );

    await user.click(screen.getByRole("button", { name: /conectar/i }));
    await waitFor(() => {
      expect(screen.getByTestId("whatsapp-qrcode")).toHaveAttribute(
        "src",
        "data:image/png;base64,abc",
      );
    });
    expect(toastMock.success).toHaveBeenCalled();
  });

  it("dispara toast de erro quando POST falha", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        status: "disconnected",
        phoneNumber: null,
        lastSeenAt: null,
      }),
    );
    render(<InstanceCard />);
    await waitFor(() => screen.getByRole("button", { name: /conectar/i }));

    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: "EVOLUTION_API_KEY ausente" }, 502),
    );
    await user.click(screen.getByRole("button", { name: /conectar/i }));
    await waitFor(() => {
      expect(toastMock.error).toHaveBeenCalledWith(
        expect.stringMatching(/EVOLUTION_API_KEY/),
      );
    });
  });

  it("clica em Desconectar e chama DELETE com confirm", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        status: "connected",
        phoneNumber: "5511",
        lastSeenAt: null,
      }),
    );
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<InstanceCard />);
    await waitFor(() => screen.getByRole("button", { name: /desconectar/i }));

    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await user.click(screen.getByRole("button", { name: /desconectar/i }));
    await waitFor(() => {
      expect(toastMock.success).toHaveBeenCalledWith(
        expect.stringMatching(/desconectado/i),
      );
    });
    expect(confirmSpy).toHaveBeenCalled();
    const lastCall = fetchMock.mock.calls.at(-1);
    expect(lastCall?.[0]).toBe("/api/whatsapp/instance");
    expect((lastCall?.[1] as RequestInit).method).toBe("DELETE");
  });

  it("subscreve canal Realtime de whatsapp_instances", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        status: "disconnected",
        phoneNumber: null,
        lastSeenAt: null,
      }),
    );
    render(<InstanceCard />);
    await waitFor(() => {
      expect(supabaseClient.channel).toHaveBeenCalledWith(
        "whatsapp_instances:self",
      );
    });
  });
});
