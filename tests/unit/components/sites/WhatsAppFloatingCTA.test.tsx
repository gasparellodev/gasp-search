import { render, screen, waitFor } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WhatsAppFloatingCTA } from "@/components/sites/WhatsAppFloatingCTA";

import { SITE_FIXTURE } from "./site-fixtures";

expect.extend(toHaveNoViolations);

const pathnameMock = vi.hoisted(() => ({
  value: "/sites/j7k2p9-touring-cars",
}));

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameMock.value,
}));

const variables = {
  business_name: SITE_FIXTURE.business_name,
  whatsapp: SITE_FIXTURE.whatsapp,
};
const SLUG = "j7k2p9-touring-cars";

describe("<WhatsAppFloatingCTA />", () => {
  afterEach(() => {
    document.body.removeAttribute("data-modal-open");
    pathnameMock.value = `/sites/${SLUG}`;
  });

  it("renderiza botão flutuante fixo com link WhatsApp general", () => {
    render(<WhatsAppFloatingCTA variables={variables} slug={SLUG} />);

    const link = screen.getByRole("link", { name: "Contato WhatsApp" });
    expect(link).toHaveAttribute("href", expect.stringContaining("wa.me/"));
    expect(link).toHaveAttribute("href", expect.stringContaining("utm_campaign=general"));
    expect(link).toHaveAttribute("href", expect.stringContaining("utm_content=floating-cta"));
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link).toHaveAttribute("title", "Contato WhatsApp");
    expect(link.className).toContain("fixed");
    expect(link.className).toContain("z-[var(--z-floating-cta,50)]");
  });

  it("usa dimensões responsivas 56px mobile / 60px desktop e safe area", () => {
    render(<WhatsAppFloatingCTA variables={variables} slug={SLUG} />);

    const link = screen.getByRole("link", { name: "Contato WhatsApp" });
    expect(link.className).toContain("size-14");
    expect(link.className).toContain("md:size-[60px]");
    expect(link.className).toContain(
      "bottom-[calc(1rem+env(safe-area-inset-bottom))]",
    );
  });

  it("sobe acima da barra de parcela no detalhe mobile", () => {
    pathnameMock.value = `/sites/${SLUG}/estoque/toyota-corolla-2022`;

    render(<WhatsAppFloatingCTA variables={variables} slug={SLUG} />);

    const link = screen.getByRole("link", { name: "Contato WhatsApp" });
    expect(link.className).toContain(
      "bottom-[calc(5.75rem+env(safe-area-inset-bottom))]",
    );
    expect(link.className).toContain(
      "md:bottom-[calc(1rem+env(safe-area-inset-bottom))]",
    );
  });

  it("não renderiza quando body[data-modal-open] já está presente", () => {
    document.body.setAttribute("data-modal-open", "true");

    render(<WhatsAppFloatingCTA variables={variables} slug={SLUG} />);

    expect(
      screen.queryByRole("link", { name: "Contato WhatsApp" }),
    ).not.toBeInTheDocument();
  });

  it("desmonta quando body[data-modal-open] é adicionado depois do render", async () => {
    render(<WhatsAppFloatingCTA variables={variables} slug={SLUG} />);
    expect(screen.getByRole("link", { name: "Contato WhatsApp" })).toBeInTheDocument();

    document.body.setAttribute("data-modal-open", "true");

    await waitFor(() => {
      expect(
        screen.queryByRole("link", { name: "Contato WhatsApp" }),
      ).not.toBeInTheDocument();
    });
  });

  it("não tem violações axe-core", async () => {
    const { container } = render(
      <WhatsAppFloatingCTA variables={variables} slug={SLUG} />,
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  }, 15_000);
});
