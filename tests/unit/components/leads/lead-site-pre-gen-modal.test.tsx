/**
 * Tests do `<LeadSitePreGenModal />` (sprint A1) — modal que valida
 * dados do lead antes de disparar `generateLeadSite`.
 *
 * Cobre:
 *  - Render dos 6 fields com badges ✓/⚠/obrigatório.
 *  - Bloqueio do CTA quando faltam `name` ou `phone`.
 *  - Aviso (não-bloqueante) quando faltam campos opcionais.
 *  - Click no CTA chama `onConfirm`.
 *  - Click no Cancelar fecha sem chamar `onConfirm`.
 *  - Acessibilidade básica via jest-axe.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe, toHaveNoViolations } from "jest-axe";

import {
  LeadSitePreGenModal,
  type PreGenLeadSummary,
} from "@/components/leads/lead-site-pre-gen-modal";

expect.extend(toHaveNoViolations);

function makeLead(
  overrides: Partial<PreGenLeadSummary> = {},
): PreGenLeadSummary {
  return {
    name: "Auto Demo Onsite",
    phone: "+55 11 99999-9999",
    email: "contato@autodemo.com",
    website: "https://autodemo.com",
    instagram_handle: "autodemo",
    city: "São Paulo",
    state: "SP",
    ...overrides,
  };
}

describe("LeadSitePreGenModal", () => {
  let onOpenChange: (open: boolean) => void;
  let onConfirm: (input: { customSlug: string }) => void;
  const APP_BASE_URL = "https://app.gasplab.com";

  beforeEach(() => {
    onOpenChange = vi.fn();
    onConfirm = vi.fn();
  });

  it("renderiza 6 campos com badges ✓ quando tudo está preenchido", () => {
    render(
      <LeadSitePreGenModal
        open
        onOpenChange={onOpenChange}
        lead={makeLead()}
        onConfirm={onConfirm}
        isGenerating={false}
        appBaseUrl={APP_BASE_URL}
      />,
    );
    expect(screen.getByTestId("lead-site-pre-gen-modal")).toBeVisible();
    expect(screen.getAllByTestId("pre-gen-field-ok")).toHaveLength(6);
    expect(
      screen.queryByTestId("pre-gen-blocker-message"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("pre-gen-warning-message"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByTestId("lead-site-pre-gen-confirm"),
    ).not.toBeDisabled();
  });

  it("bloqueia CTA quando phone vazio (campo crítico)", () => {
    render(
      <LeadSitePreGenModal
        open
        onOpenChange={onOpenChange}
        lead={makeLead({ phone: null })}
        onConfirm={onConfirm}
        isGenerating={false}
        appBaseUrl={APP_BASE_URL}
      />,
    );
    expect(
      screen.getByTestId("pre-gen-blocker-message"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("lead-site-pre-gen-confirm")).toBeDisabled();
    expect(
      screen.getByTestId("pre-gen-field-missing-critical"),
    ).toBeInTheDocument();
  });

  it("bloqueia CTA quando name é só whitespace (validador trim)", () => {
    render(
      <LeadSitePreGenModal
        open
        onOpenChange={onOpenChange}
        lead={makeLead({ name: "   " })}
        onConfirm={onConfirm}
        isGenerating={false}
        appBaseUrl={APP_BASE_URL}
      />,
    );
    expect(
      screen.getByTestId("pre-gen-blocker-message"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("lead-site-pre-gen-confirm")).toBeDisabled();
  });

  it("avisa (não-bloqueante) quando faltam campos opcionais", () => {
    render(
      <LeadSitePreGenModal
        open
        onOpenChange={onOpenChange}
        lead={makeLead({ email: null, instagram_handle: null })}
        onConfirm={onConfirm}
        isGenerating={false}
        appBaseUrl={APP_BASE_URL}
      />,
    );
    const warning = screen.getByTestId("pre-gen-warning-message");
    expect(warning).toHaveTextContent(/2 campos opcionais/);
    expect(screen.getByTestId("lead-site-pre-gen-confirm")).not.toBeDisabled();
    expect(
      screen.queryByTestId("pre-gen-blocker-message"),
    ).not.toBeInTheDocument();
  });

  it("aviso usa singular quando só 1 campo opcional falta", () => {
    render(
      <LeadSitePreGenModal
        open
        onOpenChange={onOpenChange}
        lead={makeLead({ email: null })}
        onConfirm={onConfirm}
        isGenerating={false}
        appBaseUrl={APP_BASE_URL}
      />,
    );
    expect(screen.getByTestId("pre-gen-warning-message")).toHaveTextContent(
      /1 campo opcional/,
    );
  });

  it("clicar 'Gerar site' chama onConfirm com customSlug (sugestão derivada do nome)", async () => {
    const user = userEvent.setup();
    render(
      <LeadSitePreGenModal
        open
        onOpenChange={onOpenChange}
        lead={makeLead()}
        onConfirm={onConfirm}
        isGenerating={false}
        appBaseUrl={APP_BASE_URL}
      />,
    );
    await user.click(screen.getByTestId("lead-site-pre-gen-confirm"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith({
      customSlug: "auto-demo-onsite",
    });
  });

  it("preview da URL mostra o slug sugerido inicial", () => {
    render(
      <LeadSitePreGenModal
        open
        onOpenChange={onOpenChange}
        lead={makeLead()}
        onConfirm={onConfirm}
        isGenerating={false}
        appBaseUrl={APP_BASE_URL}
      />,
    );
    expect(screen.getByTestId("pre-gen-slug-preview")).toHaveTextContent(
      `${APP_BASE_URL}/sites/auto-demo-onsite`,
    );
  });

  it("editar slug pra valor inválido bloqueia CTA + mostra mensagem inline", async () => {
    const user = userEvent.setup();
    render(
      <LeadSitePreGenModal
        open
        onOpenChange={onOpenChange}
        lead={makeLead()}
        onConfirm={onConfirm}
        isGenerating={false}
        appBaseUrl={APP_BASE_URL}
      />,
    );
    const input = screen.getByTestId("pre-gen-slug-input");
    await user.clear(input);
    await user.type(input, "abc--def");
    expect(screen.getByTestId("pre-gen-slug-error")).toHaveTextContent(
      /hífen consecutivo/i,
    );
    expect(screen.getByTestId("lead-site-pre-gen-confirm")).toBeDisabled();
  });

  it("serverSlugError 'slug em uso' aparece inline e bloqueia CTA até operador editar", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <LeadSitePreGenModal
        open
        onOpenChange={onOpenChange}
        lead={makeLead()}
        onConfirm={onConfirm}
        isGenerating={false}
        appBaseUrl={APP_BASE_URL}
        serverSlugError={null}
      />,
    );
    // Simula submit do operador (captura o submittedSlug interno).
    await user.click(screen.getByTestId("lead-site-pre-gen-confirm"));
    // Parent reflete erro do server.
    rerender(
      <LeadSitePreGenModal
        open
        onOpenChange={onOpenChange}
        lead={makeLead()}
        onConfirm={onConfirm}
        isGenerating={false}
        appBaseUrl={APP_BASE_URL}
        serverSlugError="Esse slug já está em uso. Escolha outro."
      />,
    );
    expect(screen.getByTestId("pre-gen-slug-error")).toHaveTextContent(
      /já está em uso/i,
    );
    expect(screen.getByTestId("lead-site-pre-gen-confirm")).toBeDisabled();
    // Operador edita o slug — erro do server some.
    const input = screen.getByTestId("pre-gen-slug-input");
    await user.clear(input);
    await user.type(input, "auto-recife");
    expect(screen.queryByTestId("pre-gen-slug-error")).not.toBeInTheDocument();
    expect(
      screen.getByTestId("lead-site-pre-gen-confirm"),
    ).not.toBeDisabled();
  });

  it("isGenerating=true desabilita Cancelar + CTA", () => {
    render(
      <LeadSitePreGenModal
        open
        onOpenChange={onOpenChange}
        lead={makeLead()}
        onConfirm={onConfirm}
        isGenerating
        appBaseUrl={APP_BASE_URL}
      />,
    );
    expect(screen.getByTestId("lead-site-pre-gen-cancel")).toBeDisabled();
    expect(screen.getByTestId("lead-site-pre-gen-confirm")).toBeDisabled();
    expect(
      screen.getByTestId("lead-site-pre-gen-confirm"),
    ).toHaveAttribute("aria-busy", "true");
  });

  it("Instagram é exibido com prefix @ quando preenchido", () => {
    render(
      <LeadSitePreGenModal
        open
        onOpenChange={onOpenChange}
        lead={makeLead({ instagram_handle: "minhaloja" })}
        onConfirm={onConfirm}
        isGenerating={false}
        appBaseUrl={APP_BASE_URL}
      />,
    );
    expect(screen.getByTestId("lead-site-pre-gen-modal")).toHaveTextContent(
      "@minhaloja",
    );
  });

  it("Localização concatena city/state quando ao menos um existe", () => {
    render(
      <LeadSitePreGenModal
        open
        onOpenChange={onOpenChange}
        lead={makeLead({ city: "Curitiba", state: null })}
        onConfirm={onConfirm}
        isGenerating={false}
        appBaseUrl={APP_BASE_URL}
      />,
    );
    expect(screen.getByTestId("lead-site-pre-gen-modal")).toHaveTextContent(
      /Curitiba/,
    );
  });

  it("sem violações axe-core", async () => {
    const { container } = render(
      <LeadSitePreGenModal
        open
        onOpenChange={onOpenChange}
        lead={makeLead()}
        onConfirm={onConfirm}
        isGenerating={false}
        appBaseUrl={APP_BASE_URL}
      />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
