/**
 * Testes do `<LeadSiteCardActions />` (issue #167) — cluster client com
 * useTransition. Cobre AC2 (generate flow), AC3 (URL copy), AC4 (V1
 * disabled buttons) e estados de loading/erro.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { LeadSiteCardActions } from "@/components/leads/lead-site-card-actions";
import type { LeadSiteCardData } from "@/components/leads/lead-site-card-types";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const hoisted = vi.hoisted(() => ({
  generateLeadSite: vi.fn(),
  refresh: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  clipboardWriteText: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/app/actions/lead-site", () => ({
  generateLeadSite: hoisted.generateLeadSite,
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
// AC4 — V1 disabled buttons (#168, #169, #171)
// ---------------------------------------------------------------------------

describe("LeadSiteCardActions — AC4 disabled buttons V1", () => {
  it("estado `published` renderiza editar/regerar/arquivar/whatsapp todos disabled com aria-disabled", () => {
    render(
      <LeadSiteCardActions
        leadSite={makeLeadSite({ status: "published" })}
        leadId={LEAD_ID}
        appUrl={APP_URL}
      />,
    );
    const ids = [
      "lead-site-edit-button",
      "lead-site-regen-button",
      "lead-site-archive-button",
      "lead-site-whatsapp-button",
    ];
    for (const id of ids) {
      const btn = screen.getByTestId(id);
      expect(btn).toBeDisabled();
      expect(btn).toHaveAttribute("aria-disabled", "true");
    }
  });

  it("estado `archived` renderiza apenas botão 'Restaurar' disabled", () => {
    render(
      <LeadSiteCardActions
        leadSite={makeLeadSite({ status: "archived" })}
        leadId={LEAD_ID}
        appUrl={APP_URL}
      />,
    );
    const btn = screen.getByTestId("lead-site-restore-button");
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("aria-disabled", "true");
    // Não há cluster published
    expect(screen.queryByTestId("lead-site-actions-cluster")).toBeNull();
  });
});
