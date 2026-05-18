/**
 * Tests do `<SitePublishedModal />` (sprint B3) — modal pós-publicação
 * com QR code + clipboard + WhatsApp.
 *
 * Cobertura:
 *  - Render do título, URL e slug.
 *  - QR code aparece como <img data-testid="lead-site-qr-image">.
 *  - Botão "Copiar link" chama `onCopy`.
 *  - Botão "Enviar via WhatsApp" só aparece quando `onSendWhatsApp` definido.
 *  - `isSendingWhatsApp` desabilita o CTA WhatsApp e seta aria-busy.
 *  - sem violações axe-core.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe, toHaveNoViolations } from "jest-axe";

import { SitePublishedModal } from "@/components/leads/site-published-modal";

expect.extend(toHaveNoViolations);

const URL = "https://app.gasplab.com/sites/abc-toyota";
const SLUG = "abc-toyota";

describe("SitePublishedModal", () => {
  it("renderiza título, URL e slug", async () => {
    render(
      <SitePublishedModal
        open
        onOpenChange={vi.fn()}
        url={URL}
        slug={SLUG}
        onCopy={vi.fn()}
      />,
    );
    expect(screen.getByTestId("lead-site-published-modal")).toBeVisible();
    expect(screen.getByTestId("lead-site-published-url")).toHaveTextContent(
      URL,
    );
    expect(screen.getByTestId("lead-site-published-modal")).toHaveTextContent(
      SLUG,
    );
  });

  it("QR code aparece após import dinâmico do lib qrcode", async () => {
    render(
      <SitePublishedModal
        open
        onOpenChange={vi.fn()}
        url={URL}
        slug={SLUG}
        onCopy={vi.fn()}
      />,
    );
    // Loading inicial.
    expect(screen.getByTestId("lead-site-qr-loading")).toBeInTheDocument();
    // Promise async — aguarda.
    await waitFor(() => {
      expect(screen.getByTestId("lead-site-qr-image")).toBeInTheDocument();
    });
    const img = screen.getByTestId("lead-site-qr-image") as HTMLImageElement;
    expect(img.src).toMatch(/^data:image\//);
    expect(img.alt).toContain(URL);
  });

  it("clicar 'Copiar link' chama onCopy", async () => {
    const onCopy = vi.fn();
    const user = userEvent.setup();
    render(
      <SitePublishedModal
        open
        onOpenChange={vi.fn()}
        url={URL}
        slug={SLUG}
        onCopy={onCopy}
      />,
    );
    await user.click(screen.getByTestId("lead-site-published-copy"));
    expect(onCopy).toHaveBeenCalledTimes(1);
  });

  it("CTA WhatsApp NÃO aparece quando onSendWhatsApp é undefined", () => {
    render(
      <SitePublishedModal
        open
        onOpenChange={vi.fn()}
        url={URL}
        slug={SLUG}
        onCopy={vi.fn()}
      />,
    );
    expect(
      screen.queryByTestId("lead-site-published-whatsapp"),
    ).not.toBeInTheDocument();
  });

  it("CTA WhatsApp aparece e dispara onSendWhatsApp quando handler definido", async () => {
    const onSendWhatsApp = vi.fn();
    const user = userEvent.setup();
    render(
      <SitePublishedModal
        open
        onOpenChange={vi.fn()}
        url={URL}
        slug={SLUG}
        onCopy={vi.fn()}
        onSendWhatsApp={onSendWhatsApp}
      />,
    );
    const cta = screen.getByTestId("lead-site-published-whatsapp");
    expect(cta).toBeInTheDocument();
    await user.click(cta);
    expect(onSendWhatsApp).toHaveBeenCalledTimes(1);
  });

  it("isSendingWhatsApp=true desabilita CTA + seta aria-busy", () => {
    render(
      <SitePublishedModal
        open
        onOpenChange={vi.fn()}
        url={URL}
        slug={SLUG}
        onCopy={vi.fn()}
        onSendWhatsApp={vi.fn()}
        isSendingWhatsApp
      />,
    );
    const cta = screen.getByTestId("lead-site-published-whatsapp");
    expect(cta).toBeDisabled();
    expect(cta).toHaveAttribute("aria-busy", "true");
  });

  it("link 'Abrir site' aponta pra URL com target=_blank + rel seguro", () => {
    render(
      <SitePublishedModal
        open
        onOpenChange={vi.fn()}
        url={URL}
        slug={SLUG}
        onCopy={vi.fn()}
      />,
    );
    const link = screen.getByTestId("lead-site-published-open");
    expect(link).toHaveAttribute("href", URL);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("sem violações axe-core", async () => {
    const { container } = render(
      <SitePublishedModal
        open
        onOpenChange={vi.fn()}
        url={URL}
        slug={SLUG}
        onCopy={vi.fn()}
        onSendWhatsApp={vi.fn()}
      />,
    );
    await waitFor(() => {
      expect(screen.getByTestId("lead-site-qr-image")).toBeInTheDocument();
    });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
