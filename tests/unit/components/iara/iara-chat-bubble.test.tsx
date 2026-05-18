import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { IaraChatBubble } from "@/components/iara/iara-chat-bubble";
import type { IaraChatMessage } from "@/components/iara/types";

function userMsg(content: string): IaraChatMessage {
  return { role: "user", content, toolCalls: null };
}

function assistantMsg(
  content: string,
  toolCalls: unknown[] | null = null,
): IaraChatMessage {
  return { role: "assistant", content, toolCalls };
}

describe("IaraChatBubble", () => {
  it("renderiza mensagem do user com testid e conteúdo", () => {
    render(<IaraChatBubble message={userMsg("Oi, tudo bem?")} />);
    const bubble = screen.getByTestId("iara-bubble-user");
    expect(bubble).toBeTruthy();
    expect(bubble.textContent).toContain("Oi, tudo bem?");
  });

  it("renderiza mensagem do assistant com testid distinto", () => {
    render(<IaraChatBubble message={assistantMsg("Aqui é a Iara")} />);
    const bubble = screen.getByTestId("iara-bubble-assistant");
    expect(bubble.textContent).toContain("Aqui é a Iara");
  });

  it("placeholder '(vazio)' quando content é string vazia", () => {
    render(<IaraChatBubble message={assistantMsg("")} />);
    expect(screen.getByText("(vazio)")).toBeTruthy();
  });

  it("mostra chip de tool_call quando toolCalls existe", () => {
    const msg = assistantMsg("Já te escalei", [
      {
        tool: "escalar_para_humano",
        input: { priority: "P0", motivo: "vai pagar agora" },
      },
    ]);
    render(<IaraChatBubble message={msg} />);
    const chip = screen.getByRole("button", {
      name: /toggle detalhes da tool escalar_para_humano/i,
    });
    expect(chip.textContent).toContain("escalar_para_humano");
    expect(chip.textContent).toContain("priority=P0");
  });

  it("expande/colapsa detalhes do tool_call ao clicar no chip", async () => {
    const user = userEvent.setup();
    const msg = assistantMsg("ok", [
      {
        tool: "consultar_estado_lead",
        input: { lead_id: "abc" },
      },
    ]);
    render(<IaraChatBubble message={msg} />);
    const chip = screen.getByRole("button", {
      name: /toggle detalhes da tool consultar_estado_lead/i,
    });
    expect(screen.queryByText(/"lead_id"/)).toBeNull();
    await user.click(chip);
    expect(screen.getByText(/"lead_id"/)).toBeTruthy();
  });

  it("renderiza banner de handoff quando inlineHandoff fornecido", () => {
    render(
      <IaraChatBubble
        message={assistantMsg("escalei pro Vinicius")}
        inlineHandoff={{ priority: "P0", motivo: "cliente quer fechar agora" }}
      />,
    );
    const banner = screen.getByRole("status");
    expect(banner.textContent).toContain("P0");
    expect(banner.textContent).toContain("cliente quer fechar agora");
    // Cor não é o único indicador — checa que o ícone está presente.
    expect(banner.textContent).toMatch(/🔴/);
  });
});
