import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MessageHistory } from "@/components/ai/message-history";
import type { LeadMessage } from "@/lib/ai/messages";

const toastMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: toastMock,
}));

const messages: LeadMessage[] = [
  {
    id: "message-2",
    lead_id: "lead-1",
    channel: "email",
    tone: "direto",
    content: "Mensagem mais nova",
    created_at: "2026-05-07T12:02:00Z",
  },
  {
    id: "message-1",
    lead_id: "lead-1",
    channel: "whatsapp",
    tone: "consultivo",
    content: "Mensagem antiga",
    created_at: "2026-05-07T12:01:00Z",
  },
];

beforeEach(() => {
  toastMock.success.mockReset();
  toastMock.error.mockReset();
});

describe("MessageHistory", () => {
  it("exibe mensagens em ordem recebida e copia uma mensagem", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    render(
      <MessageHistory
        leadId="lead-1"
        messages={messages}
        page={1}
        totalPages={1}
        totalCount={2}
      />,
    );

    expect(screen.getByText("Mensagem mais nova")).toBeInTheDocument();
    expect(screen.getByText("Mensagem antiga")).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: /copiar mensagem/i }),
    ).toHaveLength(2);

    await user.click(screen.getAllByRole("button", { name: /copiar/i })[0]!);
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("Mensagem mais nova");
    });
    expect(toastMock.success).toHaveBeenCalledWith("Mensagem copiada");
  });

  it("mostra paginação quando há mais de uma página", () => {
    render(
      <MessageHistory
        leadId="lead-1"
        messages={messages}
        page={2}
        totalPages={3}
        totalCount={41}
      />,
    );

    expect(screen.getByText(/41 mensagens/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /anterior/i })).toHaveAttribute(
      "href",
      "/leads/lead-1?messagesPage=1",
    );
    expect(screen.getByRole("link", { name: /próxima/i })).toHaveAttribute(
      "href",
      "/leads/lead-1?messagesPage=3",
    );
  });

  it("renderiza empty state quando não há histórico", () => {
    render(
      <MessageHistory
        leadId="lead-1"
        messages={[]}
        page={1}
        totalPages={0}
        totalCount={0}
      />,
    );

    expect(screen.getByText("Nenhuma mensagem gerada")).toBeInTheDocument();
  });
});
