import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const toastMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: toastMock }));

import { MessageComposer } from "@/components/messages/message-composer";

const fetchMock = vi.fn<typeof fetch>();
const validLeadId = "11111111-1111-4111-8111-111111111111";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  toastMock.success.mockReset();
  toastMock.error.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("MessageComposer", () => {
  it("desabilita botão e mostra placeholder quando WhatsApp não conectado", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ status: "disconnected", phoneNumber: null }),
    );
    render(<MessageComposer leadId="lead-1" />);
    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(/conecte o whatsapp/i),
      ).toBeInTheDocument();
    });
    const btn = screen.getByRole("button", { name: /enviar mensagem/i });
    expect(btn).toBeDisabled();
  });

  it("envia mensagem ao clicar e mostra toast", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ status: "connected", phoneNumber: "5511" }),
    );
    render(<MessageComposer leadId="lead-1" />);
    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(/digite a mensagem/i),
      ).toBeInTheDocument();
    });

    fetchMock.mockResolvedValueOnce(
      jsonResponse({ messageId: "msg-1", status: "sent" }, 201),
    );
    await user.type(
      screen.getByPlaceholderText(/digite a mensagem/i),
      "Oi!",
    );
    await user.click(
      screen.getByRole("button", { name: /enviar mensagem/i }),
    );
    await waitFor(() => {
      expect(toastMock.success).toHaveBeenCalledWith(
        expect.stringMatching(/enviada/i),
      );
    });
    expect(fetchMock.mock.calls.at(-1)![0]).toBe("/api/whatsapp/send");
  });

  it("envia com Ctrl+Enter", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ status: "connected", phoneNumber: "5511" }),
    );
    render(<MessageComposer leadId="lead-1" />);
    await waitFor(() =>
      screen.getByPlaceholderText(/digite a mensagem/i),
    );
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ messageId: "x" }, 201),
    );
    const ta = screen.getByPlaceholderText(/digite a mensagem/i);
    await user.type(ta, "Mensagem{Control>}{Enter}{/Control}");
    await waitFor(() => {
      expect(toastMock.success).toHaveBeenCalled();
    });
  });

  it("toast de erro em status não-OK", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ status: "connected", phoneNumber: "5511" }),
    );
    render(<MessageComposer leadId="lead-1" />);
    await waitFor(() =>
      screen.getByPlaceholderText(/digite a mensagem/i),
    );
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: "boom" }, 502),
    );
    await user.type(
      screen.getByPlaceholderText(/digite a mensagem/i),
      "x",
    );
    await user.click(
      screen.getByRole("button", { name: /enviar mensagem/i }),
    );
    await waitFor(() => {
      expect(toastMock.error).toHaveBeenCalledWith("boom");
    });
  });

  it("emite typing imediatamente e paused após 2s sem digitar", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ status: "connected", phoneNumber: "5511" }),
    );
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }, 202));

    render(<MessageComposer leadId={validLeadId} />);
    await waitFor(() =>
      screen.getByPlaceholderText(/digite a mensagem/i),
    );

    vi.useFakeTimers();
    fireEvent.change(screen.getByPlaceholderText(/digite a mensagem/i), {
      target: { value: "Oi" },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/whatsapp/typing",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ leadId: validLeadId, presence: "typing" }),
      }),
    );

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/whatsapp/typing",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ leadId: validLeadId, presence: "paused" }),
      }),
    );
  });
});
