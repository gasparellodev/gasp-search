/**
 * Tests do `<SiteGenerationProgress />` (sprint A2) — overlay cosmético
 * que tranquiliza o operador durante os ~30-60s do `generateLeadSite`.
 *
 * Cobre:
 *  - `active=false` → não renderiza nada.
 *  - `active=true` → mostra estágio inicial + barra de progresso.
 *  - `initialStage` override (testes determinísticos sem aguardar timers).
 *  - `role="status"` + `aria-live="polite"` (anúncio acessível).
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import {
  SiteGenerationProgress,
  __INTERNAL_STAGES,
} from "@/components/leads/site-generation-progress";

describe("SiteGenerationProgress", () => {
  it("active=false não renderiza nada", () => {
    const { container } = render(
      <SiteGenerationProgress active={false} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("active=true renderiza estágio 0 (extração de marca) por padrão", () => {
    render(<SiteGenerationProgress active />);
    const stage = screen.getByTestId("site-generation-stage-label");
    expect(stage).toHaveTextContent(__INTERNAL_STAGES[0]!.label);
  });

  it("respeita initialStage override (estágio 2)", () => {
    render(<SiteGenerationProgress active initialStage={2} />);
    expect(
      screen.getByTestId("site-generation-stage-label"),
    ).toHaveTextContent(__INTERNAL_STAGES[2]!.label);
  });

  it("overlay tem role=status + aria-live=polite", () => {
    render(<SiteGenerationProgress active />);
    const overlay = screen.getByTestId("site-generation-progress");
    expect(overlay).toHaveAttribute("role", "status");
    expect(overlay).toHaveAttribute("aria-live", "polite");
  });

  it("exibe orientação 'não feche a aba'", () => {
    render(<SiteGenerationProgress active />);
    expect(screen.getByTestId("site-generation-progress")).toHaveTextContent(
      /não feche a aba/i,
    );
  });
});
