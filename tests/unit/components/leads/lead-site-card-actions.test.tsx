/**
 * Testes do `<LeadSiteCardActions />` — cluster client com `useTransition`.
 *
 * Cobertura por issue:
 *  - #167 — AC2 generate flow, AC3 URL copy, estados base.
 *  - #168 — AC editar enabled (linkado em outro arquivo de teste).
 *  - #169 — AC4 regenerar/arquivar/restaurar flows + AlertDialog axe.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe, toHaveNoViolations } from "jest-axe";

import { LeadSiteCardActions } from "@/components/leads/lead-site-card-actions";
import type { LeadSiteCardData } from "@/components/leads/lead-site-card-types";

expect.extend(toHaveNoViolations);

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const hoisted = vi.hoisted(() => ({
  generateLeadSite: vi.fn(),
  archiveLeadSite: vi.fn(),
  restoreLeadSite: vi.fn(),
  sendLeadSiteWhatsApp: vi.fn(),
  regenerateVisualIdentity: vi.fn(),
  discardLeadSiteDraft: vi.fn(),
  refresh: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  clipboardWriteText: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/app/actions/lead-site", () => ({
  generateLeadSite: hoisted.generateLeadSite,
  archiveLeadSite: hoisted.archiveLeadSite,
  restoreLeadSite: hoisted.restoreLeadSite,
  sendLeadSiteWhatsApp: hoisted.sendLeadSiteWhatsApp,
  regenerateVisualIdentity: hoisted.regenerateVisualIdentity,
  discardLeadSiteDraft: hoisted.discardLeadSiteDraft,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: hoisted.refresh,
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: hoisted.toastSuccess,
    error: hoisted.toastError,
  },
}));

const LEAD_ID = "11111111-1111-4111-8111-111111111111";
const APP_URL = "https://app.gasplab.com";

function makeLeadSite(
  overrides: Partial<LeadSiteCardData> = {},
): LeadSiteCardData {
  return {
    id: "44444444-4444-4444-8444-444444444444",
    slug: "j7k2p9-touring-cars",
    status: "published",
    generated_at: "2026-05-09T12:00:00.000Z",
    published_at: "2026-05-09T12:00:00.000Z",
    sent_at: null,
    view_count: 0,
    variables: null,
    generation_error: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.clipboardWriteText.mockReset().mockResolvedValue(undefined);
});

// ---------------------------------------------------------------------------
// AC2 — Generate flow
// ---------------------------------------------------------------------------

describe("LeadSiteCardActions — AC2 generate flow", () => {
  it("estado `none` renderiza apenas o botão 'Gerar site agora'", () => {
    render(
      <LeadSiteCardActions
        leadSite={null}
        leadId={LEAD_ID}
        appUrl={APP_URL}
      />,
    );
    expect(
      screen.getByRole("button", { name: /Gerar site agora/i }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("lead-site-actions-cluster")).toBeNull();
  });

  it("click em 'Gerar' chama generateLeadSite com leadId + toast.success + router.refresh", async () => {
    hoisted.generateLeadSite.mockResolvedValue({
      ok: true,
      slug: "newslug-touring",
    });
    const user = userEvent.setup();
    render(
      <LeadSiteCardActions
        leadSite={null}
        leadId={LEAD_ID}
        appUrl={APP_URL}
      />,
    );
    await user.click(
      screen.getByRole("button", { name: /Gerar site agora/i }),
    );
    await waitFor(() => {
      expect(hoisted.generateLeadSite).toHaveBeenCalledWith(LEAD_ID);
    });
    expect(hoisted.toastSuccess).toHaveBeenCalledWith(
      "Site gerado!",
      expect.objectContaining({
        description: expect.stringMatching(/pré-visualização/i),
      }),
    );
    expect(hoisted.refresh).toHaveBeenCalled();
  });

  it("erro 'rate_limit' dispara toast.error com mensagem PT-BR", async () => {
    hoisted.generateLeadSite.mockResolvedValue({
      ok: false,
      error: "rate_limit",
      message: "Too many",
    });
    const user = userEvent.setup();
    render(
      <LeadSiteCardActions
        leadSite={null}
        leadId={LEAD_ID}
        appUrl={APP_URL}
      />,
    );
    await user.click(
      screen.getByRole("button", { name: /Gerar site agora/i }),
    );
    await waitFor(() => {
      expect(hoisted.toastError).toHaveBeenCalled();
    });
    const call = hoisted.toastError.mock.calls[0]!;
    expect(call[0]).toMatch(/Não foi possível gerar/i);
    expect(call[1].description).toMatch(/1 minuto/i);
    expect(hoisted.refresh).not.toHaveBeenCalled();
  });

  it("erro 'ai_error' dispara toast.error com mensagem específica de IA", async () => {
    hoisted.generateLeadSite.mockResolvedValue({
      ok: false,
      error: "ai_error",
      message: "AI down",
    });
    const user = userEvent.setup();
    render(
      <LeadSiteCardActions
        leadSite={null}
        leadId={LEAD_ID}
        appUrl={APP_URL}
      />,
    );
    await user.click(
      screen.getByRole("button", { name: /Gerar site agora/i }),
    );
    await waitFor(() => {
      expect(hoisted.toastError).toHaveBeenCalled();
    });
    expect(hoisted.toastError.mock.calls[0]![1].description).toMatch(/IA/i);
  });

  // Cobertura completa do switch errorMessage — cada code → mensagem PT-BR.
  it.each([
    ["auth", /sessão expirada/i],
    ["not_found", /lead não encontrado/i],
    ["validation", /validação/i],
    ["db_error", /salvar o site/i],
  ])("erro '%s' mapeia pra mensagem PT-BR específica", async (code, regex) => {
    hoisted.generateLeadSite.mockResolvedValue({
      ok: false,
      error: code as
        | "auth"
        | "not_found"
        | "validation"
        | "db_error",
      message: "x",
    });
    const user = userEvent.setup();
    render(
      <LeadSiteCardActions
        leadSite={null}
        leadId={LEAD_ID}
        appUrl={APP_URL}
      />,
    );
    await user.click(
      screen.getByRole("button", { name: /Gerar site agora/i }),
    );
    await waitFor(() => {
      expect(hoisted.toastError).toHaveBeenCalled();
    });
    expect(hoisted.toastError.mock.calls[0]![1].description).toMatch(regex);
  });

  it("erro com código desconhecido cai no default usando error.message", async () => {
    hoisted.generateLeadSite.mockResolvedValue({
      ok: false,
      // Código inesperado — defesa em profundidade.
      error: "something_new" as unknown as "auth",
      message: "fallback custom",
    });
    const user = userEvent.setup();
    render(
      <LeadSiteCardActions
        leadSite={null}
        leadId={LEAD_ID}
        appUrl={APP_URL}
      />,
    );
    await user.click(
      screen.getByRole("button", { name: /Gerar site agora/i }),
    );
    await waitFor(() => {
      expect(hoisted.toastError).toHaveBeenCalled();
    });
    expect(hoisted.toastError.mock.calls[0]![1].description).toBe(
      "fallback custom",
    );
  });

  it("loading state mostra spinner + 'Gerando…' + aria-busy", async () => {
    let resolve!: (value: { ok: true; slug: string }) => void;
    hoisted.generateLeadSite.mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    const user = userEvent.setup();
    render(
      <LeadSiteCardActions
        leadSite={null}
        leadId={LEAD_ID}
        appUrl={APP_URL}
      />,
    );
    await user.click(
      screen.getByRole("button", { name: /Gerar site agora/i }),
    );
    // Durante o transition, button vira "Gerando..." + disabled + aria-busy
    await waitFor(() => {
      const btn = screen.getByTestId("lead-site-generate-button");
      expect(btn).toBeDisabled();
      expect(btn).toHaveAttribute("aria-busy", "true");
      expect(btn).toHaveTextContent(/Gerando/i);
    });
    resolve({ ok: true, slug: "new" });
  });

  it("exception inesperada (rejected promise) dispara toast.error genérico", async () => {
    hoisted.generateLeadSite.mockRejectedValue(new Error("boom"));
    const user = userEvent.setup();
    render(
      <LeadSiteCardActions
        leadSite={null}
        leadId={LEAD_ID}
        appUrl={APP_URL}
      />,
    );
    await user.click(
      screen.getByRole("button", { name: /Gerar site agora/i }),
    );
    await waitFor(() => {
      expect(hoisted.toastError).toHaveBeenCalled();
    });
    expect(hoisted.toastError.mock.calls[0]![1].description).toMatch(
      /inesperado/i,
    );
  });

  it("`status='draft'` também renderiza o botão de geração (estado `none`)", () => {
    render(
      <LeadSiteCardActions
        leadSite={makeLeadSite({ status: "draft" })}
        leadId={LEAD_ID}
        appUrl={APP_URL}
      />,
    );
    expect(
      screen.getByRole("button", { name: /Gerar site agora/i }),
    ).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC3 — URL copy
// ---------------------------------------------------------------------------

describe("LeadSiteCardActions — AC3 URL copy", () => {
  it("estado `published` mostra 'Pré-visualizar' como link target=_blank", () => {
    render(
      <LeadSiteCardActions
        leadSite={makeLeadSite({ status: "published" })}
        leadId={LEAD_ID}
        appUrl={APP_URL}
      />,
    );
    const link = screen.getByRole("link", { name: /Pré-visualizar/i });
    expect(link).toHaveAttribute(
      "href",
      "https://app.gasplab.com/sites/j7k2p9-touring-cars",
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("click em 'Copiar' usa navigator.clipboard.writeText + toast.success", async () => {
    const user = userEvent.setup();
    // userEvent.setup() instala seu próprio clipboard mock — sobrescrevemos
    // depois pra capturar o write feito pelo handler do botão.
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: hoisted.clipboardWriteText },
    });
    render(
      <LeadSiteCardActions
        leadSite={makeLeadSite({ status: "published" })}
        leadId={LEAD_ID}
        appUrl={APP_URL}
      />,
    );
    await user.click(screen.getByTestId("lead-site-copy-button"));
    await waitFor(() => {
      expect(hoisted.clipboardWriteText).toHaveBeenCalledWith(
        "https://app.gasplab.com/sites/j7k2p9-touring-cars",
      );
    });
    expect(hoisted.toastSuccess).toHaveBeenCalledWith("URL copiada!");
  });

  it("clipboard falhando dispara toast.error", async () => {
    hoisted.clipboardWriteText.mockRejectedValueOnce(
      new Error("clipboard blocked"),
    );
    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: hoisted.clipboardWriteText },
    });
    render(
      <LeadSiteCardActions
        leadSite={makeLeadSite({ status: "published" })}
        leadId={LEAD_ID}
        appUrl={APP_URL}
      />,
    );
    await user.click(screen.getByTestId("lead-site-copy-button"));
    await waitFor(() => {
      expect(hoisted.toastError).toHaveBeenCalled();
    });
  });
});

// ---------------------------------------------------------------------------
// AC #169 — Regerar / Arquivar / Restaurar flows
// ---------------------------------------------------------------------------

describe("LeadSiteCardActions — #169 buttons enablement", () => {
  it("estado `published`: editar (#168) + regerar/arquivar (#169) + whatsapp (#171) todos ativos", () => {
    render(
      <LeadSiteCardActions
        leadSite={makeLeadSite({ status: "published" })}
        leadId={LEAD_ID}
        appUrl={APP_URL}
      />,
    );
    expect(screen.getByTestId("lead-site-edit-button")).not.toBeDisabled();
    expect(screen.getByTestId("lead-site-regen-button")).not.toBeDisabled();
    expect(screen.getByTestId("lead-site-archive-button")).not.toBeDisabled();
    // #171: WhatsApp button agora ATIVO em published/sent
    expect(screen.getByTestId("lead-site-whatsapp-button")).not.toBeDisabled();
  });

  it("estado `sent` (re-send permitido): whatsapp button ainda ativo", () => {
    render(
      <LeadSiteCardActions
        leadSite={makeLeadSite({ status: "sent" })}
        leadId={LEAD_ID}
        appUrl={APP_URL}
      />,
    );
    expect(screen.getByTestId("lead-site-whatsapp-button")).not.toBeDisabled();
  });

  it("estado `archived` mostra botão 'Restaurar' ativo", () => {
    render(
      <LeadSiteCardActions
        leadSite={makeLeadSite({ status: "archived" })}
        leadId={LEAD_ID}
        appUrl={APP_URL}
      />,
    );
    const btn = screen.getByTestId("lead-site-restore-button");
    expect(btn).not.toBeDisabled();
    expect(screen.queryByTestId("lead-site-actions-cluster")).toBeNull();
  });
});

describe("LeadSiteCardActions — #169 regenerate flow", () => {
  it("click em 'Regerar' chama generateLeadSite + toast.success + router.refresh", async () => {
    hoisted.generateLeadSite.mockResolvedValue({
      ok: true,
      slug: "new-slug",
    });
    const user = userEvent.setup();
    render(
      <LeadSiteCardActions
        leadSite={makeLeadSite({ status: "published" })}
        leadId={LEAD_ID}
        appUrl={APP_URL}
      />,
    );
    await user.click(screen.getByTestId("lead-site-regen-button"));
    await waitFor(() => {
      expect(hoisted.generateLeadSite).toHaveBeenCalledWith(LEAD_ID);
    });
    expect(hoisted.toastSuccess).toHaveBeenCalledWith(
      "Site gerado!",
      expect.objectContaining({
        description: expect.stringMatching(/pré-visualização/i),
      }),
    );
    expect(hoisted.refresh).toHaveBeenCalled();
  });

  it("erro em 'Regerar' dispara toast.error", async () => {
    hoisted.generateLeadSite.mockResolvedValue({
      ok: false,
      error: "rate_limit",
      message: "Too many",
    });
    const user = userEvent.setup();
    render(
      <LeadSiteCardActions
        leadSite={makeLeadSite({ status: "published" })}
        leadId={LEAD_ID}
        appUrl={APP_URL}
      />,
    );
    await user.click(screen.getByTestId("lead-site-regen-button"));
    await waitFor(() => {
      expect(hoisted.toastError).toHaveBeenCalled();
    });
    expect(hoisted.refresh).not.toHaveBeenCalled();
  });

  it("loading state em 'Regerar' mostra 'Regerando…' + aria-busy", async () => {
    let resolve!: (value: { ok: true; slug: string }) => void;
    hoisted.generateLeadSite.mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    const user = userEvent.setup();
    render(
      <LeadSiteCardActions
        leadSite={makeLeadSite({ status: "published" })}
        leadId={LEAD_ID}
        appUrl={APP_URL}
      />,
    );
    await user.click(screen.getByTestId("lead-site-regen-button"));
    await waitFor(() => {
      const btn = screen.getByTestId("lead-site-regen-button");
      expect(btn).toBeDisabled();
      expect(btn).toHaveAttribute("aria-busy", "true");
      expect(btn).toHaveTextContent(/Regerando/i);
    });
    resolve({ ok: true, slug: "x" });
  });
});

describe("LeadSiteCardActions — #169 archive flow", () => {
  it("abre confirm dialog ao clicar 'Arquivar' (sem chamar Server Action ainda)", async () => {
    const user = userEvent.setup();
    render(
      <LeadSiteCardActions
        leadSite={makeLeadSite({ status: "published" })}
        leadId={LEAD_ID}
        appUrl={APP_URL}
      />,
    );
    await user.click(screen.getByTestId("lead-site-archive-button"));
    await waitFor(() => {
      expect(
        screen.getByTestId("lead-site-archive-dialog"),
      ).toBeInTheDocument();
    });
    // Server Action ainda não foi chamada — só após confirmar.
    expect(hoisted.archiveLeadSite).not.toHaveBeenCalled();
  });

  it("cancelar fecha o dialog sem chamar archiveLeadSite", async () => {
    const user = userEvent.setup();
    render(
      <LeadSiteCardActions
        leadSite={makeLeadSite({ status: "published" })}
        leadId={LEAD_ID}
        appUrl={APP_URL}
      />,
    );
    await user.click(screen.getByTestId("lead-site-archive-button"));
    await waitFor(() => {
      expect(
        screen.getByTestId("lead-site-archive-dialog"),
      ).toBeInTheDocument();
    });
    await user.click(screen.getByTestId("lead-site-archive-cancel"));
    await waitFor(() => {
      expect(
        screen.queryByTestId("lead-site-archive-dialog"),
      ).not.toBeInTheDocument();
    });
    expect(hoisted.archiveLeadSite).not.toHaveBeenCalled();
  });

  it("confirmar chama archiveLeadSite(leadSiteId) + toast.success + refresh", async () => {
    hoisted.archiveLeadSite.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    const leadSite = makeLeadSite({ status: "published" });
    render(
      <LeadSiteCardActions
        leadSite={leadSite}
        leadId={LEAD_ID}
        appUrl={APP_URL}
      />,
    );
    await user.click(screen.getByTestId("lead-site-archive-button"));
    await waitFor(() => {
      expect(
        screen.getByTestId("lead-site-archive-dialog"),
      ).toBeInTheDocument();
    });
    await user.click(screen.getByTestId("lead-site-archive-confirm"));
    await waitFor(() => {
      expect(hoisted.archiveLeadSite).toHaveBeenCalledWith(leadSite.id);
    });
    expect(hoisted.toastSuccess).toHaveBeenCalledWith(
      "Site arquivado",
      expect.objectContaining({ description: expect.any(String) }),
    );
    expect(hoisted.refresh).toHaveBeenCalled();
  });

  it("erro 'invalid_status' em archive dispara toast.error", async () => {
    hoisted.archiveLeadSite.mockResolvedValue({
      ok: false,
      error: "invalid_status",
      message: "x",
    });
    const user = userEvent.setup();
    render(
      <LeadSiteCardActions
        leadSite={makeLeadSite({ status: "published" })}
        leadId={LEAD_ID}
        appUrl={APP_URL}
      />,
    );
    await user.click(screen.getByTestId("lead-site-archive-button"));
    await user.click(screen.getByTestId("lead-site-archive-confirm"));
    await waitFor(() => {
      expect(hoisted.toastError).toHaveBeenCalled();
    });
    expect(hoisted.toastError.mock.calls[0]![1].description).toMatch(
      /estado que permita/i,
    );
  });

  it("exception inesperada em archive dispara toast.error genérico", async () => {
    hoisted.archiveLeadSite.mockRejectedValue(new Error("boom"));
    const user = userEvent.setup();
    render(
      <LeadSiteCardActions
        leadSite={makeLeadSite({ status: "published" })}
        leadId={LEAD_ID}
        appUrl={APP_URL}
      />,
    );
    await user.click(screen.getByTestId("lead-site-archive-button"));
    await user.click(screen.getByTestId("lead-site-archive-confirm"));
    await waitFor(() => {
      expect(hoisted.toastError).toHaveBeenCalled();
    });
    expect(hoisted.toastError.mock.calls[0]![1].description).toMatch(
      /inesperado/i,
    );
  });

  it("dialog tem role='alertdialog' e zero violations no axe-core", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <LeadSiteCardActions
        leadSite={makeLeadSite({ status: "published" })}
        leadId={LEAD_ID}
        appUrl={APP_URL}
      />,
    );
    await user.click(screen.getByTestId("lead-site-archive-button"));
    await waitFor(() => {
      expect(
        screen.getByTestId("lead-site-archive-dialog"),
      ).toBeInTheDocument();
    });
    // Radix AlertDialog usa role="alertdialog" no Content
    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toBeInTheDocument();

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  }, 15_000);
});

describe("LeadSiteCardActions — #169 restore flow", () => {
  it("click em 'Restaurar' chama restoreLeadSite + toast.success + refresh", async () => {
    hoisted.restoreLeadSite.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    const leadSite = makeLeadSite({ status: "archived" });
    render(
      <LeadSiteCardActions
        leadSite={leadSite}
        leadId={LEAD_ID}
        appUrl={APP_URL}
      />,
    );
    await user.click(screen.getByTestId("lead-site-restore-button"));
    await waitFor(() => {
      expect(hoisted.restoreLeadSite).toHaveBeenCalledWith(leadSite.id);
    });
    expect(hoisted.toastSuccess).toHaveBeenCalledWith(
      "Site restaurado!",
      expect.objectContaining({ description: expect.any(String) }),
    );
    expect(hoisted.refresh).toHaveBeenCalled();
  });

  it("erro em 'Restaurar' dispara toast.error e não dá refresh", async () => {
    hoisted.restoreLeadSite.mockResolvedValue({
      ok: false,
      error: "db_error",
      message: "x",
    });
    const user = userEvent.setup();
    render(
      <LeadSiteCardActions
        leadSite={makeLeadSite({ status: "archived" })}
        leadId={LEAD_ID}
        appUrl={APP_URL}
      />,
    );
    await user.click(screen.getByTestId("lead-site-restore-button"));
    await waitFor(() => {
      expect(hoisted.toastError).toHaveBeenCalled();
    });
    expect(hoisted.toastError.mock.calls[0]![1].description).toMatch(
      /salvar a alteração/i,
    );
    expect(hoisted.refresh).not.toHaveBeenCalled();
  });

  it("loading state em 'Restaurar' mostra 'Restaurando…' + aria-busy", async () => {
    let resolve!: (value: { ok: true }) => void;
    hoisted.restoreLeadSite.mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    const user = userEvent.setup();
    render(
      <LeadSiteCardActions
        leadSite={makeLeadSite({ status: "archived" })}
        leadId={LEAD_ID}
        appUrl={APP_URL}
      />,
    );
    await user.click(screen.getByTestId("lead-site-restore-button"));
    await waitFor(() => {
      const btn = screen.getByTestId("lead-site-restore-button");
      expect(btn).toBeDisabled();
      expect(btn).toHaveAttribute("aria-busy", "true");
      expect(btn).toHaveTextContent(/Restaurando/i);
    });
    resolve({ ok: true });
  });

  it("exception inesperada em restore dispara toast.error genérico", async () => {
    hoisted.restoreLeadSite.mockRejectedValue(new Error("boom"));
    const user = userEvent.setup();
    render(
      <LeadSiteCardActions
        leadSite={makeLeadSite({ status: "archived" })}
        leadId={LEAD_ID}
        appUrl={APP_URL}
      />,
    );
    await user.click(screen.getByTestId("lead-site-restore-button"));
    await waitFor(() => {
      expect(hoisted.toastError).toHaveBeenCalled();
    });
    expect(hoisted.toastError.mock.calls[0]![1].description).toMatch(
      /inesperado/i,
    );
  });
});

// ---------------------------------------------------------------------------
// #171 — Send WhatsApp flow
// ---------------------------------------------------------------------------

describe("LeadSiteCardActions — #171 send WhatsApp flow", () => {
  it("click em 'Enviar via WhatsApp' chama sendLeadSiteWhatsApp + toast.success + router.refresh", async () => {
    hoisted.sendLeadSiteWhatsApp.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    const leadSite = makeLeadSite({ status: "published" });
    render(
      <LeadSiteCardActions
        leadSite={leadSite}
        leadId={LEAD_ID}
        appUrl={APP_URL}
      />,
    );
    await user.click(screen.getByTestId("lead-site-whatsapp-button"));
    await waitFor(() => {
      expect(hoisted.sendLeadSiteWhatsApp).toHaveBeenCalledWith(leadSite.id);
    });
    expect(hoisted.toastSuccess).toHaveBeenCalledWith(
      "Site enviado!",
      expect.objectContaining({
        description: expect.stringMatching(/whatsapp/i),
      }),
    );
    expect(hoisted.refresh).toHaveBeenCalled();
  });

  it("erro 'whatsapp_error' em send dispara toast.error com mensagem mapeada", async () => {
    hoisted.sendLeadSiteWhatsApp.mockResolvedValue({
      ok: false,
      error: "whatsapp_error",
      message: "Instância do WhatsApp desconectada. Reconecte em Configurações.",
    });
    const user = userEvent.setup();
    render(
      <LeadSiteCardActions
        leadSite={makeLeadSite({ status: "published" })}
        leadId={LEAD_ID}
        appUrl={APP_URL}
      />,
    );
    await user.click(screen.getByTestId("lead-site-whatsapp-button"));
    await waitFor(() => {
      expect(hoisted.toastError).toHaveBeenCalled();
    });
    expect(hoisted.toastError.mock.calls[0]![1].description).toMatch(
      /desconectada/i,
    );
    expect(hoisted.refresh).not.toHaveBeenCalled();
  });

  it("loading state em send mostra 'Enviando…' + aria-busy + disabled", async () => {
    let resolve!: (value: { ok: true }) => void;
    hoisted.sendLeadSiteWhatsApp.mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    const user = userEvent.setup();
    render(
      <LeadSiteCardActions
        leadSite={makeLeadSite({ status: "published" })}
        leadId={LEAD_ID}
        appUrl={APP_URL}
      />,
    );
    await user.click(screen.getByTestId("lead-site-whatsapp-button"));
    await waitFor(() => {
      const btn = screen.getByTestId("lead-site-whatsapp-button");
      expect(btn).toBeDisabled();
      expect(btn).toHaveAttribute("aria-busy", "true");
      expect(btn).toHaveTextContent(/Enviando/i);
    });
    resolve({ ok: true });
  });

  it("erro 'invalid_status' em send mapeia mensagem do estado", async () => {
    hoisted.sendLeadSiteWhatsApp.mockResolvedValue({
      ok: false,
      error: "invalid_status",
      message: "ignored",
    });
    const user = userEvent.setup();
    render(
      <LeadSiteCardActions
        leadSite={makeLeadSite({ status: "published" })}
        leadId={LEAD_ID}
        appUrl={APP_URL}
      />,
    );
    await user.click(screen.getByTestId("lead-site-whatsapp-button"));
    await waitFor(() => {
      expect(hoisted.toastError).toHaveBeenCalled();
    });
    expect(hoisted.toastError.mock.calls[0]![1].description).toMatch(
      /estado/i,
    );
  });

  it("exception inesperada em send dispara toast.error genérico", async () => {
    hoisted.sendLeadSiteWhatsApp.mockRejectedValue(new Error("boom"));
    const user = userEvent.setup();
    render(
      <LeadSiteCardActions
        leadSite={makeLeadSite({ status: "published" })}
        leadId={LEAD_ID}
        appUrl={APP_URL}
      />,
    );
    await user.click(screen.getByTestId("lead-site-whatsapp-button"));
    await waitFor(() => {
      expect(hoisted.toastError).toHaveBeenCalled();
    });
    expect(hoisted.toastError.mock.calls[0]![1].description).toMatch(
      /inesperado/i,
    );
  });
});

// ---------------------------------------------------------------------------
// #217 — Regenerate visual identity flow (AlertDialog + Server Action)
// ---------------------------------------------------------------------------

const VALID_MANIFEST = {
  hero_url: "https://cdn.example.com/touring/hero-ai.png",
  categories_urls: [
    "https://cdn.example.com/touring/sedan.png",
    "https://cdn.example.com/touring/suv.png",
  ],
  about_url: "https://cdn.example.com/touring/about-ai.png",
  contact_url: "https://cdn.example.com/touring/contact-ai.png",
  generated_at: "2026-05-11T07:00:00.000Z",
  model: "gpt-image-2-2026-04-21" as const,
  cost_estimate_brl: 2.45,
};

describe("LeadSiteCardActions — #217 regenerate visual identity", () => {
  it("status='published' renderiza o botão 'Regenerar identidade visual'", () => {
    render(
      <LeadSiteCardActions
        leadSite={makeLeadSite({ status: "published" })}
        leadId={LEAD_ID}
        appUrl={APP_URL}
      />,
    );
    expect(
      screen.getByTestId("lead-site-regen-identity-button"),
    ).toBeInTheDocument();
  });

  it("status='sent' também renderiza o botão (re-regenerate permitido)", () => {
    render(
      <LeadSiteCardActions
        leadSite={makeLeadSite({ status: "sent" })}
        leadId={LEAD_ID}
        appUrl={APP_URL}
      />,
    );
    expect(
      screen.getByTestId("lead-site-regen-identity-button"),
    ).toBeInTheDocument();
  });

  it("status='draft' NÃO renderiza o botão (cluster published-only)", () => {
    render(
      <LeadSiteCardActions
        leadSite={null}
        leadId={LEAD_ID}
        appUrl={APP_URL}
      />,
    );
    expect(
      screen.queryByTestId("lead-site-regen-identity-button"),
    ).toBeNull();
  });

  it("status='archived' NÃO renderiza o botão", () => {
    render(
      <LeadSiteCardActions
        leadSite={makeLeadSite({ status: "archived" })}
        leadId={LEAD_ID}
        appUrl={APP_URL}
      />,
    );
    expect(
      screen.queryByTestId("lead-site-regen-identity-button"),
    ).toBeNull();
  });

  it("click abre AlertDialog com texto correto (R$ 2,45 + 90s)", async () => {
    const user = userEvent.setup();
    render(
      <LeadSiteCardActions
        leadSite={makeLeadSite({ status: "published" })}
        leadId={LEAD_ID}
        appUrl={APP_URL}
      />,
    );
    await user.click(screen.getByTestId("lead-site-regen-identity-button"));
    expect(
      await screen.findByTestId("lead-site-regen-identity-dialog"),
    ).toBeInTheDocument();
    // Texto da descrição cita custo + qtd de imagens.
    expect(
      screen.getByText(/9 imagens/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/R\$\s*2,45/),
    ).toBeInTheDocument();
    // Texto de duração cita "90 segundos".
    expect(
      screen.getByTestId("lead-site-regen-identity-duration"),
    ).toHaveTextContent(/90 segundos/i);
  });

  it("Cancelar fecha o dialog SEM chamar a action", async () => {
    const user = userEvent.setup();
    render(
      <LeadSiteCardActions
        leadSite={makeLeadSite({ status: "published" })}
        leadId={LEAD_ID}
        appUrl={APP_URL}
      />,
    );
    await user.click(screen.getByTestId("lead-site-regen-identity-button"));
    await user.click(screen.getByTestId("lead-site-regen-identity-cancel"));
    expect(hoisted.regenerateVisualIdentity).not.toHaveBeenCalled();
  });

  it("Confirmar chama regenerateVisualIdentity com {force:true} + toast.success + router.refresh", async () => {
    hoisted.regenerateVisualIdentity.mockResolvedValue({
      ok: true,
      manifest: VALID_MANIFEST,
      regenerated: true,
    });
    const user = userEvent.setup();
    const leadSite = makeLeadSite({ status: "published" });
    render(
      <LeadSiteCardActions
        leadSite={leadSite}
        leadId={LEAD_ID}
        appUrl={APP_URL}
      />,
    );
    await user.click(screen.getByTestId("lead-site-regen-identity-button"));
    await user.click(screen.getByTestId("lead-site-regen-identity-confirm"));

    await waitFor(() => {
      expect(hoisted.regenerateVisualIdentity).toHaveBeenCalledWith(
        leadSite.id,
        { force: true },
      );
    });
    expect(hoisted.toastSuccess).toHaveBeenCalledWith(
      "Identidade visual regenerada",
      expect.objectContaining({
        description: expect.stringMatching(/R\$\s*2,45/),
      }),
    );
    expect(hoisted.refresh).toHaveBeenCalled();
  });

  it("toast.success usa cost_estimate_brl real do manifest (formatado BRL)", async () => {
    hoisted.regenerateVisualIdentity.mockResolvedValue({
      ok: true,
      manifest: { ...VALID_MANIFEST, cost_estimate_brl: 3.78 },
      regenerated: true,
    });
    const user = userEvent.setup();
    render(
      <LeadSiteCardActions
        leadSite={makeLeadSite({ status: "published" })}
        leadId={LEAD_ID}
        appUrl={APP_URL}
      />,
    );
    await user.click(screen.getByTestId("lead-site-regen-identity-button"));
    await user.click(screen.getByTestId("lead-site-regen-identity-confirm"));

    await waitFor(() => {
      expect(hoisted.toastSuccess).toHaveBeenCalled();
    });
    expect(hoisted.toastSuccess.mock.calls[0]![1].description).toMatch(
      /R\$\s*3,78/,
    );
  });

  it.each([
    ["auth", /sessão expirada/i],
    ["not_found", /não encontrado/i],
    ["cost_guardrail", /limite de US\$ 2/i],
    ["validation", /validação interna/i],
    ["generation_error", /rate limit|moderação/i],
    ["storage_error", /storage/i],
    ["db_error", /persistir/i],
  ] as const)("error code '%s' → toast.error PT-BR", async (errorCode, pattern) => {
    hoisted.regenerateVisualIdentity.mockResolvedValue({
      ok: false,
      error: errorCode,
      message: "ignored — UI mapeia",
    });
    const user = userEvent.setup();
    render(
      <LeadSiteCardActions
        leadSite={makeLeadSite({ status: "published" })}
        leadId={LEAD_ID}
        appUrl={APP_URL}
      />,
    );
    await user.click(screen.getByTestId("lead-site-regen-identity-button"));
    await user.click(screen.getByTestId("lead-site-regen-identity-confirm"));
    await waitFor(() => {
      expect(hoisted.toastError).toHaveBeenCalled();
    });
    expect(hoisted.toastError.mock.calls[0]![0]).toMatch(
      /Não foi possível regenerar/i,
    );
    expect(hoisted.toastError.mock.calls[0]![1].description).toMatch(pattern);
  });

  it("exception inesperada em regenerate dispara toast.error genérico", async () => {
    hoisted.regenerateVisualIdentity.mockRejectedValue(new Error("boom"));
    const user = userEvent.setup();
    render(
      <LeadSiteCardActions
        leadSite={makeLeadSite({ status: "published" })}
        leadId={LEAD_ID}
        appUrl={APP_URL}
      />,
    );
    await user.click(screen.getByTestId("lead-site-regen-identity-button"));
    await user.click(screen.getByTestId("lead-site-regen-identity-confirm"));
    await waitFor(() => {
      expect(hoisted.toastError).toHaveBeenCalled();
    });
    expect(hoisted.toastError.mock.calls[0]![1].description).toMatch(
      /inesperado/i,
    );
  });

  it("AlertDialog do regenerate é acessível (sem violações axe-core)", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <LeadSiteCardActions
        leadSite={makeLeadSite({ status: "published" })}
        leadId={LEAD_ID}
        appUrl={APP_URL}
      />,
    );
    await user.click(screen.getByTestId("lead-site-regen-identity-button"));
    // Esperar o dialog renderizar.
    await screen.findByTestId("lead-site-regen-identity-dialog");
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  }, 15_000);
});

// ---------------------------------------------------------------------------
// Sprint A1/A2 — pre-gen validation modal + progress indicator
// ---------------------------------------------------------------------------

const LEAD_SUMMARY = {
  name: "Auto Demo Onsite",
  phone: "+55 11 99999-9999",
  email: "demo@auto.com",
  website: "https://auto.com",
  instagram_handle: "auto",
  city: "Recife",
  state: "PE",
};

describe("LeadSiteCardActions — sprint A1 pre-gen modal", () => {
  it("sem leadSummary, clicar 'Gerar' dispara action diretamente (compat drawer)", async () => {
    hoisted.generateLeadSite.mockResolvedValue({
      ok: true,
      slug: "abc-123",
    });
    const user = userEvent.setup();
    render(
      <LeadSiteCardActions
        leadSite={null}
        leadId={LEAD_ID}
        appUrl={APP_URL}
      />,
    );
    await user.click(screen.getByTestId("lead-site-generate-button"));
    await waitFor(() => {
      expect(hoisted.generateLeadSite).toHaveBeenCalledWith(LEAD_ID);
    });
    expect(
      screen.queryByTestId("lead-site-pre-gen-modal"),
    ).not.toBeInTheDocument();
  });

  it("com leadSummary, clicar 'Gerar' abre o modal (action NÃO é chamada)", async () => {
    const user = userEvent.setup();
    render(
      <LeadSiteCardActions
        leadSite={null}
        leadId={LEAD_ID}
        appUrl={APP_URL}
        leadSummary={LEAD_SUMMARY}
      />,
    );
    await user.click(screen.getByTestId("lead-site-generate-button"));
    await screen.findByTestId("lead-site-pre-gen-modal");
    expect(hoisted.generateLeadSite).not.toHaveBeenCalled();
  });

  it("confirmar modal dispara generateLeadSite com leadId", async () => {
    hoisted.generateLeadSite.mockResolvedValue({
      ok: true,
      slug: "abc-123",
    });
    const user = userEvent.setup();
    render(
      <LeadSiteCardActions
        leadSite={null}
        leadId={LEAD_ID}
        appUrl={APP_URL}
        leadSummary={LEAD_SUMMARY}
      />,
    );
    await user.click(screen.getByTestId("lead-site-generate-button"));
    await screen.findByTestId("lead-site-pre-gen-modal");
    await user.click(screen.getByTestId("lead-site-pre-gen-confirm"));
    await waitFor(() => {
      expect(hoisted.generateLeadSite).toHaveBeenCalledWith(LEAD_ID);
    });
  });

  it("phone faltando bloqueia o submit no modal", async () => {
    const user = userEvent.setup();
    render(
      <LeadSiteCardActions
        leadSite={null}
        leadId={LEAD_ID}
        appUrl={APP_URL}
        leadSummary={{ ...LEAD_SUMMARY, phone: null }}
      />,
    );
    await user.click(screen.getByTestId("lead-site-generate-button"));
    await screen.findByTestId("lead-site-pre-gen-modal");
    expect(screen.getByTestId("lead-site-pre-gen-confirm")).toBeDisabled();
    expect(
      screen.getByTestId("pre-gen-blocker-message"),
    ).toBeInTheDocument();
  });

  it("retry do estado draft+error pula o modal (volta direto pra action)", async () => {
    hoisted.generateLeadSite.mockResolvedValue({
      ok: true,
      slug: "abc-123",
    });
    const user = userEvent.setup();
    render(
      <LeadSiteCardActions
        leadSite={makeLeadSite({
          status: "draft",
          generation_error: '{"code":"ai_error","message":"timeout"}',
        })}
        leadId={LEAD_ID}
        appUrl={APP_URL}
        leadSummary={LEAD_SUMMARY}
      />,
    );
    await user.click(screen.getByTestId("lead-site-retry-button"));
    await waitFor(() => {
      expect(hoisted.generateLeadSite).toHaveBeenCalledWith(LEAD_ID);
    });
    // Modal NÃO foi aberto.
    expect(
      screen.queryByTestId("lead-site-pre-gen-modal"),
    ).not.toBeInTheDocument();
  });
});

describe("LeadSiteCardActions — sprint A2 progress indicator", () => {
  it("clicar 'Gerar' (sem leadSummary) abre o progress overlay durante in flight", async () => {
    // Promise que não resolve (suspende a action pra deixar isGenerating=true)
    hoisted.generateLeadSite.mockImplementation(
      () => new Promise(() => {}),
    );
    const user = userEvent.setup();
    render(
      <LeadSiteCardActions
        leadSite={null}
        leadId={LEAD_ID}
        appUrl={APP_URL}
      />,
    );
    await user.click(screen.getByTestId("lead-site-generate-button"));
    await waitFor(() => {
      expect(
        screen.getByTestId("site-generation-progress"),
      ).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Sprint A4 — discard draft + retry cluster
// ---------------------------------------------------------------------------

describe("LeadSiteCardActions — sprint A4 draft+error recovery", () => {
  it("status='draft' com generation_error mostra cluster 'Tentar de novo' + 'Descartar rascunho'", () => {
    render(
      <LeadSiteCardActions
        leadSite={makeLeadSite({
          status: "draft",
          generation_error: '{"code":"ai_error","message":"timeout"}',
        })}
        leadId={LEAD_ID}
        appUrl={APP_URL}
      />,
    );
    expect(screen.getByTestId("lead-site-draft-error-cluster")).toBeVisible();
    expect(screen.getByTestId("lead-site-retry-button")).toHaveTextContent(
      /tentar de novo/i,
    );
    expect(screen.getByTestId("lead-site-discard-button")).toHaveTextContent(
      /descartar rascunho/i,
    );
    // O botão default "Gerar site agora" não aparece neste estado.
    expect(
      screen.queryByTestId("lead-site-generate-button"),
    ).not.toBeInTheDocument();
  });

  it("status='draft' SEM generation_error mantém apenas 'Gerar site agora'", () => {
    render(
      <LeadSiteCardActions
        leadSite={makeLeadSite({ status: "draft", generation_error: null })}
        leadId={LEAD_ID}
        appUrl={APP_URL}
      />,
    );
    expect(screen.getByTestId("lead-site-generate-button")).toHaveTextContent(
      /gerar site agora/i,
    );
    expect(
      screen.queryByTestId("lead-site-discard-button"),
    ).not.toBeInTheDocument();
  });

  it("clicar 'Descartar rascunho' chama discardLeadSiteDraft + refresh em sucesso", async () => {
    hoisted.discardLeadSiteDraft.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(
      <LeadSiteCardActions
        leadSite={makeLeadSite({
          status: "draft",
          generation_error: '{"code":"validation","message":"bad"}',
        })}
        leadId={LEAD_ID}
        appUrl={APP_URL}
      />,
    );
    await user.click(screen.getByTestId("lead-site-discard-button"));
    await waitFor(() => {
      expect(hoisted.discardLeadSiteDraft).toHaveBeenCalledWith(
        "44444444-4444-4444-8444-444444444444",
      );
    });
    expect(hoisted.toastSuccess).toHaveBeenCalled();
    expect(hoisted.refresh).toHaveBeenCalled();
  });

  it("clicar 'Descartar rascunho' em erro exibe toast PT-BR mapeado", async () => {
    hoisted.discardLeadSiteDraft.mockResolvedValue({
      ok: false,
      error: "invalid_status",
      message: "Apenas rascunhos com falha podem ser descartados.",
    });
    const user = userEvent.setup();
    render(
      <LeadSiteCardActions
        leadSite={makeLeadSite({
          status: "draft",
          generation_error: '{"code":"validation","message":"bad"}',
        })}
        leadId={LEAD_ID}
        appUrl={APP_URL}
      />,
    );
    await user.click(screen.getByTestId("lead-site-discard-button"));
    await waitFor(() => {
      expect(hoisted.toastError).toHaveBeenCalled();
    });
    const [, opts] = hoisted.toastError.mock.calls[0] as [
      string,
      { description: string },
    ];
    expect(opts.description).toMatch(/já tenha sido publicado/i);
    expect(hoisted.refresh).not.toHaveBeenCalled();
  });
});
