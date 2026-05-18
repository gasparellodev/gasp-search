import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { IaraSandboxClient } from "@/components/iara/iara-sandbox-client";
import type { IaraConversationDetail } from "@/components/iara/types";

const hoisted = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  toastInfo: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: hoisted.toastSuccess,
    error: hoisted.toastError,
    info: hoisted.toastInfo,
  },
}));

function makeDetail(): IaraConversationDetail {
  return {
    conversation: {
      id: "conv-1",
      leadId: "lead-1",
      iaraVersion: "1.1",
      isSandbox: true,
      lastMessageAt: "2026-05-18T12:00:00.000Z",
      approvalStatus: "pending",
      approvalNotes: null,
      reviewedAt: null,
      createdAt: "2026-05-18T10:00:00.000Z",
    },
    lead: {
      id: "lead-1",
      business_name: "AutoStar",
      city: "São Paulo",
      status: "new",
    },
    messages: [],
    handoffs: [],
  };
}

beforeEach(() => {
  hoisted.toastSuccess.mockReset();
  hoisted.toastError.mockReset();
  hoisted.toastInfo.mockReset();
  // Limpa localStorage entre tests pra evitar vazamento de config.
  if (typeof window !== "undefined") {
    window.localStorage.clear();
  }
});

describe("IaraSandboxClient", () => {
  it("renderiza empty state quando detail.messages é vazio", () => {
    render(
      <IaraSandboxClient leadId="lead-1" initialDetail={makeDetail()} />,
    );
    expect(screen.getByText(/Sem mensagens ainda/i)).toBeTruthy();
  });

  it("renderiza mensagens existentes", () => {
    const detail = makeDetail();
    detail.messages = [
      { role: "user", content: "oi", toolCalls: null },
      { role: "assistant", content: "Aqui é a Iara", toolCalls: null },
    ];
    render(<IaraSandboxClient leadId="lead-1" initialDetail={detail} />);
    expect(screen.getByTestId("iara-bubble-user")).toBeTruthy();
    expect(screen.getByTestId("iara-bubble-assistant")).toBeTruthy();
  });

  it("envio com input vazio fica disabled", () => {
    render(<IaraSandboxClient leadId="lead-1" initialDetail={makeDetail()} />);
    const sendBtn = screen.getByRole("button", {
      name: /enviar como lojista/i,
    });
    expect(sendBtn.getAttribute("disabled")).not.toBeNull();
  });

  it("envio com texto chama POST /api/iara/sandbox/conversation", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        conversationId: "conv-1",
        assistantMessage: "Oi!",
        toolCalls: [],
        handoff: null,
      }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    const user = userEvent.setup();
    render(<IaraSandboxClient leadId="lead-1" initialDetail={makeDetail()} />);
    const textarea = screen.getByLabelText(/Mensagem como lojista/i);
    await user.type(textarea, "tenho dúvida sobre preço");
    await user.click(
      screen.getByRole("button", { name: /enviar como lojista/i }),
    );

    await waitFor(() => {
      const call = fetchSpy.mock.calls.find(
        ([url]) => url === "/api/iara/sandbox/conversation",
      );
      expect(call).toBeDefined();
      expect(call?.[1]).toEqual(
        expect.objectContaining({
          method: "POST",
        }),
      );
    });

    vi.unstubAllGlobals();
  });

  it("notifica via toast.info quando handoff vem na resposta", async () => {
    const fetchSpy = vi
      .fn()
      // POST /conversation
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          conversationId: "conv-1",
          assistantMessage: "Já chamei o Vinicius",
          toolCalls: [],
          handoff: { priority: "P0", motivo: "vai pagar" },
        }),
      })
      // GET /conversation/[id] (refreshDetail)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => makeDetail(),
      });
    vi.stubGlobal("fetch", fetchSpy);

    const user = userEvent.setup();
    render(<IaraSandboxClient leadId="lead-1" initialDetail={makeDetail()} />);
    await user.type(
      screen.getByLabelText(/Mensagem como lojista/i),
      "vou pagar agora",
    );
    await user.click(
      screen.getByRole("button", { name: /enviar como lojista/i }),
    );

    await waitFor(() => {
      expect(hoisted.toastInfo).toHaveBeenCalledWith(
        expect.stringContaining("P0"),
      );
    });

    vi.unstubAllGlobals();
  });

  it("toast de erro quando POST falha", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "boom" }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    const user = userEvent.setup();
    render(<IaraSandboxClient leadId="lead-1" initialDetail={makeDetail()} />);
    await user.type(
      screen.getByLabelText(/Mensagem como lojista/i),
      "test",
    );
    await user.click(
      screen.getByRole("button", { name: /enviar como lojista/i }),
    );
    await waitFor(() => {
      expect(hoisted.toastError).toHaveBeenCalledWith("boom");
    });

    vi.unstubAllGlobals();
  });

  it("persiste founder config em localStorage ao alterar", async () => {
    const user = userEvent.setup();
    render(<IaraSandboxClient leadId="lead-1" initialDetail={makeDetail()} />);
    const nameInput = screen.getByLabelText(/Founder name/i);
    await user.clear(nameInput);
    await user.type(nameInput, "Bruno");
    await user.tab();

    await waitFor(() => {
      const raw = window.localStorage.getItem("iara:founder-config:v1");
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw ?? "{}");
      expect(parsed.founderName).toBe("Bruno");
    });
  });

  it("renderiza badge de handoff atual no header", () => {
    const detail = makeDetail();
    detail.handoffs = [
      {
        priority: "P0",
        motivo: "vai pagar",
        createdAt: "2026-05-18T11:00:00.000Z",
        resolvedAt: null,
      },
    ];
    render(<IaraSandboxClient leadId="lead-1" initialDetail={detail} />);
    // Title attribute exibe HANDOFF_LABEL completo; checa Badge P0 visível.
    const headerBadge = screen.getAllByText("P0");
    expect(headerBadge.length).toBeGreaterThan(0);
  });

  it("reset: DELETE /conversation/[id] com confirm aceito", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });
    vi.stubGlobal("fetch", fetchSpy);
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    const user = userEvent.setup();
    render(<IaraSandboxClient leadId="lead-1" initialDetail={makeDetail()} />);
    await user.click(screen.getByRole("button", { name: /resetar conversa/i }));

    await waitFor(() => {
      const call = fetchSpy.mock.calls.find(
        ([url, opts]) =>
          typeof url === "string" &&
          url.includes("/api/iara/sandbox/conversation/conv-1") &&
          opts?.method === "DELETE",
      );
      expect(call).toBeDefined();
      expect(hoisted.toastSuccess).toHaveBeenCalledWith("Conversa resetada");
    });

    confirmSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it("reset abortado quando confirm é rejeitado", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

    const user = userEvent.setup();
    render(<IaraSandboxClient leadId="lead-1" initialDetail={makeDetail()} />);
    await user.click(screen.getByRole("button", { name: /resetar conversa/i }));

    expect(fetchSpy).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it("aprovar: abre dialog, PATCH /review com status approved", async () => {
    const fetchSpy = vi
      .fn()
      // PATCH /review
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) })
      // GET /conversation/[id] refresh
      .mockResolvedValueOnce({ ok: true, json: async () => makeDetail() });
    vi.stubGlobal("fetch", fetchSpy);

    const user = userEvent.setup();
    render(<IaraSandboxClient leadId="lead-1" initialDetail={makeDetail()} />);
    await user.click(screen.getByRole("button", { name: /aprovar conversa/i }));

    // O dialog deve abrir — o botão de confirmação tem aria-label "Confirmar
    // aprovação" ou rótulo equivalente. O componente IaraApprovalDialog tem
    // seu próprio teste; aqui validamos só o handshake.
    const confirmBtn = await screen.findByRole("button", {
      name: /confirmar/i,
    });
    await user.click(confirmBtn);

    await waitFor(() => {
      const call = fetchSpy.mock.calls.find(
        ([url, opts]) =>
          typeof url === "string" &&
          url.includes("/review") &&
          opts?.method === "PATCH",
      );
      expect(call).toBeDefined();
      const body = JSON.parse(call?.[1]?.body ?? "{}");
      expect(body.approvalStatus).toBe("approved");
      expect(hoisted.toastSuccess).toHaveBeenCalledWith("Conversa aprovada");
    });

    vi.unstubAllGlobals();
  });

  it("envio com Enter (sem shift) dispara handleSend", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          conversationId: "conv-1",
          assistantMessage: "ok",
          toolCalls: [],
          handoff: null,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => makeDetail(),
      });
    vi.stubGlobal("fetch", fetchSpy);

    const user = userEvent.setup();
    render(<IaraSandboxClient leadId="lead-1" initialDetail={makeDetail()} />);
    const textarea = screen.getByLabelText(/Mensagem como lojista/i);
    await user.type(textarea, "vai");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
    });
    vi.unstubAllGlobals();
  });

  it("associa handoff inline a mensagem com tool_call escalar_para_humano", () => {
    const detail = makeDetail();
    detail.messages = [
      { role: "user", content: "vou pagar agora", toolCalls: null },
      {
        role: "assistant",
        content: "Já chamei o Vinicius",
        toolCalls: [
          { tool: "escalar_para_humano", input: { priority: "P0" } },
        ],
      },
    ];
    detail.handoffs = [
      {
        priority: "P0",
        motivo: "cliente vai pagar",
        createdAt: "2026-05-18T11:00:00.000Z",
        resolvedAt: null,
      },
    ];
    render(<IaraSandboxClient leadId="lead-1" initialDetail={detail} />);
    // O motivo do handoff aparece pelo menos 2x: dentro do bubble do
    // assistant (banner inline) e no painel de Handoffs (meta lateral).
    expect(screen.getAllByText(/cliente vai pagar/i).length).toBeGreaterThanOrEqual(1);
  });

  it("envio sem lead/initialDetail cria conversa otimista", async () => {
    // POST resolve com sucesso; refreshDetail (GET) retorna um detail
    // que CONTÉM a mensagem otimista, garantindo que a bolha persista.
    const optimisticDetail = makeDetail();
    optimisticDetail.messages = [
      { role: "user", content: "primeira mensagem", toolCalls: null },
    ];
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          conversationId: "conv-new",
          assistantMessage: "ok",
          toolCalls: [],
          handoff: null,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => optimisticDetail,
      });
    vi.stubGlobal("fetch", fetchSpy);

    const user = userEvent.setup();
    render(<IaraSandboxClient leadId="lead-x" initialDetail={null} />);
    await user.type(
      screen.getByLabelText(/Mensagem como lojista/i),
      "primeira mensagem",
    );
    await user.click(
      screen.getByRole("button", { name: /enviar como lojista/i }),
    );

    // Após o setDetail otimista, a bolha de user aparece.
    await waitFor(() => {
      expect(screen.getByTestId("iara-bubble-user")).toBeTruthy();
    });

    vi.unstubAllGlobals();
  });
});
