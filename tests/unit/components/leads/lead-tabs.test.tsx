import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { LeadTabs } from "@/components/leads/lead-tabs";
import type { LeadListItem } from "@/lib/leads/list-leads";

const hoisted = vi.hoisted(() => ({
  refreshSpy: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));
const { refreshSpy, toastSuccess, toastError } = hoisted;

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: hoisted.refreshSpy,
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

vi.mock("sonner", () => ({
  toast: { success: hoisted.toastSuccess, error: hoisted.toastError },
}));

vi.mock("@/components/ai/message-generator", () => ({
  MessageGenerator: ({ leadId }: { leadId: string }) => (
    <div data-testid="tabs-message-generator">Mensagem IA real {leadId}</div>
  ),
}));

vi.mock("@/components/messages/conversation-thread", () => ({
  ConversationThread: ({ leadId }: { leadId: string }) => (
    <div data-testid="tabs-conversation-thread">Thread {leadId}</div>
  ),
}));

vi.mock("@/components/messages/message-composer", () => ({
  MessageComposer: ({ leadId }: { leadId: string }) => (
    <div data-testid="tabs-message-composer">Composer {leadId}</div>
  ),
}));

vi.mock("@/components/messages/instance-banner", () => ({
  InstanceBanner: () => <div data-testid="tabs-instance-banner" />,
}));

const whatsappFlag = { current: "0" as "0" | "1" };
vi.mock("@/lib/env-public", () => ({
  publicEnv: new Proxy(
    {
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
    } as Record<string, string>,
    {
      get(target, prop) {
        if (prop === "NEXT_PUBLIC_WHATSAPP_ENABLED") return whatsappFlag.current;
        return target[prop as string];
      },
    },
  ),
}));

const baseLead: LeadListItem = {
  id: "lead-1",
  user_id: "user-1",
  source: "google_maps",
  source_search_job_id: null,
  name: "Barbearia X",
  category: "Barbearia",
  city: "Curitiba",
  state: "PR",
  country: "BR",
  phone: "+5541999999999",
  email: null,
  website: "barbeariax.com",
  instagram_handle: null,
  whatsapp: null,
  has_website: true,
  rating: 4.5,
  reviews_count: 128,
  followers_count: null,
  stage: "new",
  score: 50,
  notes: null,
  raw: null,
  enriched_at: null,
  created_at: "2026-05-07T00:00:00Z",
  updated_at: "2026-05-07T00:00:00Z",
  tags: [{ id: "tag-1", name: "Frio", color: "#0ea5e9" }],
};

const allTags = [
  { id: "tag-1", name: "Frio", color: "#0ea5e9" },
  { id: "tag-2", name: "Quente", color: "#ef4444" },
];

beforeEach(() => {
  refreshSpy.mockReset();
  toastSuccess.mockReset();
  toastError.mockReset();
  whatsappFlag.current = "0";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("LeadTabs (componente unificado de tabs do lead)", () => {
  describe("render — modo inline", () => {
    it("mostra as tabs canônicas Visão geral / Notas / Mensagens IA", () => {
      render(<LeadTabs lead={baseLead} mode="inline" tags={allTags} />);
      expect(
        screen.getByRole("tab", { name: /visão geral/i }),
      ).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /notas/i })).toBeInTheDocument();
      expect(
        screen.getByRole("tab", { name: /mensagens ia/i }),
      ).toBeInTheDocument();
    });

    it("aplica o data-mode inline no container raiz para spacing tighter", () => {
      const { container } = render(
        <LeadTabs lead={baseLead} mode="inline" tags={allTags} />,
      );
      expect(
        container.querySelector('[data-lead-tabs="true"]'),
      ).toHaveAttribute("data-mode", "inline");
    });

    it("mostra Conversa quando a feature flag de WhatsApp está ligada", () => {
      whatsappFlag.current = "1";
      render(<LeadTabs lead={baseLead} mode="inline" tags={allTags} />);
      expect(
        screen.getByRole("tab", { name: /conversa/i }),
      ).toBeInTheDocument();
    });

    it("não mostra hero header com h1 no modo inline (apenas standalone)", () => {
      render(<LeadTabs lead={baseLead} mode="inline" tags={allTags} />);
      expect(
        screen.queryByRole("heading", { level: 1, name: /barbearia x/i }),
      ).toBeNull();
    });
  });

  describe("render — modo standalone", () => {
    it("mostra as mesmas tabs canônicas", () => {
      render(<LeadTabs lead={baseLead} mode="standalone" tags={allTags} />);
      expect(
        screen.getByRole("tab", { name: /visão geral/i }),
      ).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /notas/i })).toBeInTheDocument();
      expect(
        screen.getByRole("tab", { name: /mensagens ia/i }),
      ).toBeInTheDocument();
    });

    it("aplica o data-mode standalone no container raiz", () => {
      const { container } = render(
        <LeadTabs lead={baseLead} mode="standalone" tags={allTags} />,
      );
      expect(
        container.querySelector('[data-lead-tabs="true"]'),
      ).toHaveAttribute("data-mode", "standalone");
    });

    it("renderiza hero header com nome do lead e badge de estágio", () => {
      const { container } = render(
        <LeadTabs lead={baseLead} mode="standalone" tags={allTags} />,
      );
      expect(
        screen.getByRole("heading", { level: 1, name: /barbearia x/i }),
      ).toBeInTheDocument();
      const header = container.querySelector("header");
      expect(header).not.toBeNull();
      expect(header!.textContent).toContain("Novo");
    });

    it("mostra ícone 'abrir conversa' no hero quando WhatsApp habilitado E lead tem phone (#137)", () => {
      whatsappFlag.current = "1";
      try {
        render(<LeadTabs lead={baseLead} mode="standalone" tags={allTags} />);
        const link = screen.getByRole("link", {
          name: /abrir conversa de barbearia x/i,
        });
        expect(link).toHaveAttribute("href", "/messages/lead-1");
      } finally {
        whatsappFlag.current = "0";
      }
    });

    it("não mostra ícone 'abrir conversa' quando WhatsApp desabilitado", () => {
      whatsappFlag.current = "0";
      render(<LeadTabs lead={baseLead} mode="standalone" tags={allTags} />);
      expect(
        screen.queryByRole("link", { name: /abrir conversa/i }),
      ).toBeNull();
    });

    it("não mostra ícone 'abrir conversa' quando lead.phone é null mesmo com flag '1'", () => {
      whatsappFlag.current = "1";
      try {
        const leadSemPhone = { ...baseLead, phone: null };
        render(
          <LeadTabs lead={leadSemPhone} mode="standalone" tags={allTags} />,
        );
        expect(
          screen.queryByRole("link", { name: /abrir conversa/i }),
        ).toBeNull();
      } finally {
        whatsappFlag.current = "0";
      }
    });

    it("renderiza slot siteCard apenas no modo standalone na tab Site", async () => {
      render(
        <LeadTabs
          lead={baseLead}
          mode="standalone"
          tags={allTags}
          siteCard={<div data-testid="site-card-slot">SITE STANDALONE</div>}
        />,
      );
      await userEvent.click(screen.getByRole("tab", { name: /site/i }));
      expect(screen.getByTestId("site-card-slot")).toHaveTextContent(
        "SITE STANDALONE",
      );
    });

    it("renderiza messageHistory junto do gerador na tab Mensagens IA", async () => {
      render(
        <LeadTabs
          lead={baseLead}
          mode="standalone"
          tags={allTags}
          messageHistory={
            <div data-testid="history-slot">HISTORICO</div>
          }
        />,
      );
      await userEvent.click(
        screen.getByRole("tab", { name: /mensagens ia/i }),
      );
      expect(screen.getByTestId("tabs-message-generator")).toBeInTheDocument();
      expect(screen.getByTestId("history-slot")).toHaveTextContent(
        "HISTORICO",
      );
    });
  });

  describe("edição inline (PATCH) — comportamento canônico em ambos os modos", () => {
    it("modo inline: editar stage chama onUpdate com patch e dá refresh em sucesso", async () => {
      const onUpdate = vi.fn().mockResolvedValue(undefined);
      render(
        <LeadTabs
          lead={baseLead}
          mode="inline"
          tags={allTags}
          onUpdate={onUpdate}
        />,
      );

      await userEvent.selectOptions(
        screen.getByLabelText(/estágio/i),
        "contacted",
      );

      await waitFor(() => {
        expect(onUpdate).toHaveBeenCalledTimes(1);
      });
      const [patch, optimistic] = onUpdate.mock.calls[0]!;
      expect(patch).toEqual({ stage: "contacted" });
      expect(optimistic).toMatchObject({ stage: "contacted" });
    });

    it("modo standalone: editar score envia PATCH com o novo valor via onUpdate", async () => {
      const onUpdate = vi.fn().mockResolvedValue(undefined);
      render(
        <LeadTabs
          lead={baseLead}
          mode="standalone"
          tags={allTags}
          onUpdate={onUpdate}
        />,
      );
      const input = screen.getByLabelText(/score/i);
      await userEvent.clear(input);
      await userEvent.type(input, "82");
      input.blur();

      await waitFor(() => {
        expect(onUpdate).toHaveBeenCalledTimes(1);
      });
      expect(onUpdate.mock.calls[0]![0]).toEqual({ score: 82 });
    });

    it("editar notes chama PATCH com o conteúdo trim em ambos os modos", async () => {
      const onUpdateInline = vi.fn().mockResolvedValue(undefined);
      const onUpdateStandalone = vi.fn().mockResolvedValue(undefined);

      const { unmount } = render(
        <LeadTabs
          lead={baseLead}
          mode="inline"
          tags={allTags}
          onUpdate={onUpdateInline}
        />,
      );
      await userEvent.click(screen.getByRole("tab", { name: /notas/i }));
      const textareaInline = screen.getByLabelText(/notas internas/i);
      await userEvent.type(textareaInline, "lead muito frio");
      await userEvent.click(
        screen.getByRole("button", { name: /salvar notas/i }),
      );
      await waitFor(() => {
        expect(onUpdateInline).toHaveBeenCalledTimes(1);
      });
      expect(onUpdateInline.mock.calls[0]![0]).toEqual({
        notes: "lead muito frio",
      });
      unmount();

      render(
        <LeadTabs
          lead={baseLead}
          mode="standalone"
          tags={allTags}
          onUpdate={onUpdateStandalone}
        />,
      );
      await userEvent.click(screen.getByRole("tab", { name: /notas/i }));
      const textareaStandalone = screen.getByLabelText(/notas internas/i);
      await userEvent.type(textareaStandalone, "outro");
      await userEvent.click(
        screen.getByRole("button", { name: /salvar notas/i }),
      );
      await waitFor(() => {
        expect(onUpdateStandalone).toHaveBeenCalledTimes(1);
      });
      expect(onUpdateStandalone.mock.calls[0]![0]).toEqual({ notes: "outro" });
    });

    it("usa fetch /api/leads/[id] default quando onUpdate não é provido", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ...baseLead, stage: "contacted" }),
      });
      vi.stubGlobal("fetch", fetchMock);

      render(<LeadTabs lead={baseLead} mode="inline" tags={allTags} />);
      await userEvent.selectOptions(
        screen.getByLabelText(/estágio/i),
        "contacted",
      );

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledTimes(1);
      });
      const [url, init] = fetchMock.mock.calls[0]!;
      expect(url).toBe("/api/leads/lead-1");
      expect((init as RequestInit).method).toBe("PATCH");
      expect(JSON.parse((init as RequestInit).body as string)).toEqual({
        stage: "contacted",
      });
      await waitFor(() => {
        expect(refreshSpy).toHaveBeenCalled();
      });
      expect(toastSuccess).toHaveBeenCalled();
    });
  });

  describe("validação Zod do PATCH", () => {
    it("rejeita name vazio sem chamar onUpdate e dispara toast.error", async () => {
      const onUpdate = vi.fn().mockResolvedValue(undefined);
      render(
        <LeadTabs
          lead={baseLead}
          mode="standalone"
          tags={allTags}
          onUpdate={onUpdate}
        />,
      );

      const nameInput = screen.getByLabelText(/^nome$/i);
      await userEvent.clear(nameInput);
      nameInput.blur();

      await waitFor(() => {
        expect(toastError).toHaveBeenCalled();
      });
      expect(onUpdate).not.toHaveBeenCalled();
    });

    it("aceita name válido (>=2 chars) e dispara PATCH", async () => {
      const onUpdate = vi.fn().mockResolvedValue(undefined);
      render(
        <LeadTabs
          lead={baseLead}
          mode="standalone"
          tags={allTags}
          onUpdate={onUpdate}
        />,
      );

      const nameInput = screen.getByLabelText(/^nome$/i);
      await userEvent.clear(nameInput);
      await userEvent.type(nameInput, "Barbearia Y");
      nameInput.blur();

      await waitFor(() => {
        expect(onUpdate).toHaveBeenCalledTimes(1);
      });
      expect(onUpdate.mock.calls[0]![0]).toEqual({ name: "Barbearia Y" });
    });

    it("score fora do range (>100) dispara toast.error e não chama onUpdate", async () => {
      const onUpdate = vi.fn().mockResolvedValue(undefined);
      render(
        <LeadTabs
          lead={baseLead}
          mode="standalone"
          tags={allTags}
          onUpdate={onUpdate}
        />,
      );

      const input = screen.getByLabelText(/score/i);
      await userEvent.clear(input);
      await userEvent.type(input, "150");
      input.blur();

      await waitFor(() => {
        expect(toastError).toHaveBeenCalled();
      });
      expect(onUpdate).not.toHaveBeenCalled();
    });
  });

  describe("edição de telefone", () => {
    it("commita phone via onUpdate com null quando esvazia", async () => {
      const onUpdate = vi.fn().mockResolvedValue(undefined);
      render(
        <LeadTabs
          lead={baseLead}
          mode="inline"
          tags={allTags}
          onUpdate={onUpdate}
        />,
      );

      const phone = screen.getByLabelText(/telefone/i);
      await userEvent.clear(phone);
      phone.blur();

      await waitFor(() => {
        expect(onUpdate).toHaveBeenCalledTimes(1);
      });
      expect(onUpdate.mock.calls[0]![0]).toEqual({ phone: null });
    });

    it("commita phone com novo valor trim em standalone", async () => {
      const onUpdate = vi.fn().mockResolvedValue(undefined);
      render(
        <LeadTabs
          lead={baseLead}
          mode="standalone"
          tags={allTags}
          onUpdate={onUpdate}
        />,
      );

      const phone = screen.getByLabelText(/telefone/i);
      await userEvent.clear(phone);
      await userEvent.type(phone, "+5511988887777");
      phone.blur();

      await waitFor(() => {
        expect(onUpdate).toHaveBeenCalledTimes(1);
      });
      expect(onUpdate.mock.calls[0]![0]).toEqual({
        phone: "+5511988887777",
      });
    });
  });

  describe("rollback do snapshot otimista", () => {
    it("reverte snapshot quando onUpdate falha", async () => {
      const onUpdate = vi.fn().mockRejectedValue(new Error("boom"));
      render(
        <LeadTabs
          lead={baseLead}
          mode="standalone"
          tags={allTags}
          onUpdate={onUpdate}
        />,
      );

      const select = screen.getByLabelText(/estágio/i);
      await userEvent.selectOptions(select, "contacted");

      await waitFor(() => {
        expect(toastError).toHaveBeenCalled();
      });
      // Rollback: select volta ao stage original.
      expect(select).toHaveValue("new");
    });
  });

  describe("slot siteCard", () => {
    it("não renderiza tab Site quando siteCard não é provido", () => {
      render(<LeadTabs lead={baseLead} mode="inline" tags={allTags} />);
      expect(screen.queryByTestId("tab-site")).toBeNull();
    });
  });

  describe("tab Conversa em modo standalone com flag ligada", () => {
    it("também aparece em modo standalone quando WhatsApp habilitado", () => {
      whatsappFlag.current = "1";
      render(<LeadTabs lead={baseLead} mode="standalone" tags={allTags} />);
      expect(
        screen.getByRole("tab", { name: /conversa/i }),
      ).toBeInTheDocument();
    });
  });

  describe("seleção e criação inline de tags", () => {
    it("clicar em opção de tag existente alterna o estado selecionado", async () => {
      const user = userEvent.setup();
      render(<LeadTabs lead={baseLead} mode="inline" tags={allTags} />);
      const trigger = screen.getByRole("button", { name: /selecionada/i });
      await user.click(trigger);

      // Antes do clique, "Frio" está marcada com o ícone Check visível.
      const checkedOption = await screen.findByRole("option", {
        name: /frio/i,
      });
      await user.click(checkedOption);

      // Após clicar, o trigger atualiza o label de seleção para 0.
      // O popover ainda fica aberto até onOpenChange(false).
      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /selecionar tags/i }),
        ).toBeInTheDocument();
      });
    });

    it("fechar popover com tagIds inalterados (early-return same) não dispara PATCH", async () => {
      const onUpdate = vi.fn().mockResolvedValue(undefined);
      const user = userEvent.setup();
      render(
        <LeadTabs
          lead={baseLead}
          mode="inline"
          tags={allTags}
          onUpdate={onUpdate}
        />,
      );

      const trigger = screen.getByRole("button", { name: /selecionada/i });
      await user.click(trigger);
      // Fecha sem mudar nada: o handler de close compara `previous` vs
      // `pendingTagIds` e retorna early (same → sem PATCH).
      await user.keyboard("{Escape}");

      // Aguarda o handler async terminar (no PATCH).
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(onUpdate).not.toHaveBeenCalled();
    });

    it("cria tag inline com sucesso via POST /api/tags e popula seleção", async () => {
      const user = userEvent.setup();
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: "tag-3",
            name: "Cliente",
            color: "#0ea5e9",
          }),
        });
      vi.stubGlobal("fetch", fetchMock);

      render(<LeadTabs lead={baseLead} mode="inline" tags={allTags} />);
      await user.click(screen.getByRole("button", { name: /selecionada/i }));
      const search = await screen.findByPlaceholderText(
        /filtrar ou criar tag/i,
      );
      await user.type(search, "Cliente");
      const createOption = await screen.findByRole("option", {
        name: /criar tag.*cliente/i,
      });
      await user.click(createOption);

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledTimes(1);
      });
      expect(fetchMock.mock.calls[0]![0]).toBe("/api/tags");
      expect(toastSuccess).toHaveBeenCalled();
    });

    it("falha ao criar tag inline dispara toast.error", async () => {
      const user = userEvent.setup();
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Já existe" }),
      });
      vi.stubGlobal("fetch", fetchMock);

      render(<LeadTabs lead={baseLead} mode="inline" tags={allTags} />);
      await user.click(screen.getByRole("button", { name: /selecionada/i }));
      const search = await screen.findByPlaceholderText(
        /filtrar ou criar tag/i,
      );
      await user.type(search, "Cliente");
      const createOption = await screen.findByRole("option", {
        name: /criar tag.*cliente/i,
      });
      await user.click(createOption);

      await waitFor(() => {
        expect(toastError).toHaveBeenCalled();
      });
    });
  });
});
