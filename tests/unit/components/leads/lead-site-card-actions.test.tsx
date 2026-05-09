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
  refresh: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  clipboardWriteText: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/app/actions/lead-site", () => ({
  generateLeadSite: hoisted.generateLeadSite,
  archiveLeadSite: hoisted.archiveLeadSite,
  restoreLeadSite: hoisted.restoreLeadSite,
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
  it("estado `published`: editar (#168) + regerar/arquivar (#169) ativos; whatsapp (#171) disabled", () => {
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

    const wpp = screen.getByTestId("lead-site-whatsapp-button");
    expect(wpp).toBeDisabled();
    expect(wpp).toHaveAttribute("aria-disabled", "true");
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
