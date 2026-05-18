import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { IaraConversationMeta } from "@/components/iara/iara-conversation-meta";
import type { IaraConversationDetail } from "@/components/iara/types";

function makeDetail(
  overrides: Partial<IaraConversationDetail> = {},
): IaraConversationDetail {
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
    messages: [
      {
        role: "user",
        content: "oi",
        toolCalls: null,
      },
      {
        role: "assistant",
        content: "Aqui é a Iara",
        toolCalls: null,
      },
    ],
    handoffs: [
      {
        priority: "P1",
        motivo: "Cliente pediu desconto",
        createdAt: "2026-05-18T11:30:00.000Z",
        resolvedAt: null,
      },
    ],
    ...overrides,
  };
}

describe("IaraConversationMeta", () => {
  it("renderiza somente config quando detail é null", () => {
    render(
      <IaraConversationMeta
        detail={null}
        founderName="Vinicius"
        founderDescricao=""
        onFounderConfigChange={() => {}}
        onReset={() => {}}
        onApprove={() => {}}
        onReject={() => {}}
      />,
    );
    expect(screen.getByLabelText(/Founder name/i)).toBeTruthy();
    // Botões de ação não aparecem sem detail.
    expect(screen.queryByRole("button", { name: /aprovar conversa/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /resetar conversa/i })).toBeNull();
  });

  it("renderiza dados do lead, stats, handoff e botões com detail", () => {
    render(
      <IaraConversationMeta
        detail={makeDetail()}
        founderName="Vinicius"
        founderDescricao=""
        onFounderConfigChange={() => {}}
        onReset={() => {}}
        onApprove={() => {}}
        onReject={() => {}}
      />,
    );
    expect(screen.getByText("AutoStar")).toBeTruthy();
    expect(screen.getByText("São Paulo")).toBeTruthy();
    expect(screen.getByText(/Cliente pediu desconto/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /aprovar conversa/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /reprovar conversa/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /resetar conversa/i })).toBeTruthy();
  });

  it("aprovar/reprovar/resetar disparam callbacks", async () => {
    const onApprove = vi.fn();
    const onReject = vi.fn();
    const onReset = vi.fn();
    const user = userEvent.setup();
    render(
      <IaraConversationMeta
        detail={makeDetail()}
        founderName="Vinicius"
        founderDescricao=""
        onFounderConfigChange={() => {}}
        onReset={onReset}
        onApprove={onApprove}
        onReject={onReject}
      />,
    );
    await user.click(screen.getByRole("button", { name: /aprovar conversa/i }));
    await user.click(screen.getByRole("button", { name: /reprovar conversa/i }));
    await user.click(screen.getByRole("button", { name: /resetar conversa/i }));
    expect(onApprove).toHaveBeenCalledOnce();
    expect(onReject).toHaveBeenCalledOnce();
    expect(onReset).toHaveBeenCalledOnce();
  });

  it("onBlur do input/textarea persiste founder config", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <IaraConversationMeta
        detail={null}
        founderName=""
        founderDescricao=""
        onFounderConfigChange={onChange}
        onReset={() => {}}
        onApprove={() => {}}
        onReject={() => {}}
      />,
    );
    const nameInput = screen.getByLabelText(/Founder name/i);
    await user.type(nameInput, "Bruno");
    await user.tab(); // blur
    expect(onChange).toHaveBeenCalled();
    const last = onChange.mock.calls[onChange.mock.calls.length - 1];
    expect(last).toBeDefined();
    expect(last?.[0]).toBe("Bruno");
  });

  it("onBlur da textarea de descrição também dispara callback", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <IaraConversationMeta
        detail={null}
        founderName="Bruno"
        founderDescricao=""
        onFounderConfigChange={onChange}
        onReset={() => {}}
        onApprove={() => {}}
        onReject={() => {}}
      />,
    );
    const descArea = screen.getByLabelText(/Founder descrição/i);
    await user.type(descArea, "ex-consultor 10 anos");
    await user.tab();
    expect(onChange).toHaveBeenCalled();
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1];
    expect(lastCall?.[1]).toContain("ex-consultor");
  });

  it("formatDateTime cai no fallback quando data é inválida", () => {
    render(
      <IaraConversationMeta
        detail={makeDetail({
          conversation: {
            id: "x",
            leadId: "lead-1",
            iaraVersion: "1.1",
            isSandbox: true,
            // Data inválida força o catch do formatDateTime — retorna a
            // string como-é.
            lastMessageAt: "not-a-date",
            approvalStatus: "pending",
            approvalNotes: null,
            reviewedAt: null,
            createdAt: "also-bad",
          },
        })}
        founderName="V"
        founderDescricao=""
        onFounderConfigChange={() => {}}
        onReset={() => {}}
        onApprove={() => {}}
        onReject={() => {}}
      />,
    );
    // O componente não deve crashar com dates inválidas.
    expect(screen.getByText("AutoStar")).toBeTruthy();
  });

  it("renderiza P0 com ícone vermelho (cor não é único indicador)", () => {
    render(
      <IaraConversationMeta
        detail={makeDetail({
          handoffs: [
            {
              priority: "P0",
              motivo: "Cliente vai pagar agora",
              createdAt: "2026-05-18T11:30:00.000Z",
              resolvedAt: null,
            },
          ],
        })}
        founderName="V"
        founderDescricao=""
        onFounderConfigChange={() => {}}
        onReset={() => {}}
        onApprove={() => {}}
        onReject={() => {}}
      />,
    );
    expect(screen.getByText(/🔴/)).toBeTruthy();
  });
});
