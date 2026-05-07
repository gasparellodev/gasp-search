import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MessageGenerator } from "@/components/ai/message-generator";

const toastMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: toastMock,
}));

const LEAD_ID = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  toastMock.success.mockReset();
  toastMock.error.mockReset();
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            content: "Olá, vi que a Barbearia Bigode pode vender mais.",
            messageId: "message-1",
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      ),
    ),
  );
});

describe("MessageGenerator", () => {
  it("submete o form, chama a API e exibe resultado editável", async () => {
    const user = userEvent.setup();
    render(<MessageGenerator leadId={LEAD_ID} />);

    await user.selectOptions(screen.getByLabelText("Canal"), "email");
    await user.selectOptions(screen.getByLabelText("Tom"), "direto");
    await user.clear(screen.getByLabelText("Objetivo"));
    await user.type(
      screen.getByLabelText("Objetivo"),
      "agendar uma conversa",
    );
    await user.click(screen.getByRole("button", { name: /gerar/i }));

    await screen.findByDisplayValue(
      "Olá, vi que a Barbearia Bigode pode vender mais.",
    );
    expect(global.fetch).toHaveBeenCalledWith("/api/ai/generate-message", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        leadId: LEAD_ID,
        channel: "email",
        tone: "direto",
        goal: "agendar uma conversa",
      }),
    });
    expect(screen.getByLabelText("Mensagem gerada")).toBeEnabled();
  });

  it("copia o resultado editado para a área de transferência", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    render(<MessageGenerator leadId={LEAD_ID} />);

    await user.click(screen.getByRole("button", { name: /gerar/i }));
    const result = await screen.findByLabelText("Mensagem gerada");
    await user.clear(result);
    await user.type(result, "Mensagem revisada");
    await user.click(screen.getByRole("button", { name: /copiar/i }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("Mensagem revisada");
    });
    expect(toastMock.success).toHaveBeenCalledWith("Mensagem copiada");
  });

  it("mostra erro amigável quando a API falha", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ error: "Lead não encontrado" }), {
            status: 404,
            headers: { "content-type": "application/json" },
          }),
        ),
      ),
    );

    const user = userEvent.setup();
    render(<MessageGenerator leadId={LEAD_ID} />);
    await user.click(screen.getByRole("button", { name: /gerar/i }));

    await waitFor(() => {
      expect(toastMock.error).toHaveBeenCalledWith("Geração falhou", {
        description: "Lead não encontrado",
      });
    });
  });
});
