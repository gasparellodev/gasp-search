import { render, screen } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { describe, expect, it } from "vitest";

import { AboutSection } from "@/components/sites/about/AboutSection";

import { SITE_FIXTURE } from "../site-fixtures";

expect.extend(toHaveNoViolations);

const baseVariables = {
  about_text: SITE_FIXTURE.about_text,

  mission: SITE_FIXTURE.mission,
  vision: SITE_FIXTURE.vision,
  values: SITE_FIXTURE.values,
  business_name: SITE_FIXTURE.business_name,
  brand_assets: SITE_FIXTURE.brand_assets,
};

describe("<AboutSection />", () => {
  it("renderiza <h1> com o nome do negócio", () => {
    render(<AboutSection variables={baseVariables} />);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /Sobre a Touring Cars/i,
      }),
    ).toBeInTheDocument();
  });

  it("quebra `about_text` por '\\n\\n' em múltiplos <p> (sem dangerouslySetInnerHTML)", () => {
    const aboutText = "Parágrafo 1.\n\nParágrafo 2.\n\nParágrafo 3.";
    const variables = { ...baseVariables, about_text: aboutText };
    const { container } = render(<AboutSection variables={variables} />);

    // 3 parágrafos do about_text. O componente também tem outros <p>
    // (mission/vision card descriptions), então filtramos pelo conteúdo.
    expect(screen.getByText("Parágrafo 1.")).toBeInTheDocument();
    expect(screen.getByText("Parágrafo 2.")).toBeInTheDocument();
    expect(screen.getByText("Parágrafo 3.")).toBeInTheDocument();

    // Defesa em profundidade: o split deve gerar exatamente 3 nós.
    // Procuramos pelo container do bloco de texto (space-y-4).
    const wrappers = container.querySelectorAll(".space-y-4 > p");
    expect(wrappers).toHaveLength(3);
  });

  it("ignora segmentos vazios resultantes de '\\n\\n' duplicado", () => {
    const variables = {
      ...baseVariables,
      about_text: "Parágrafo A.\n\n\n\nParágrafo B.",
    };
    const { container } = render(<AboutSection variables={variables} />);
    const wrappers = container.querySelectorAll(".space-y-4 > p");
    // "A.\n\n\n\nB." → split('\n\n') = ['A.', '', 'B.'] → filter(Boolean) = ['A.', 'B.']
    expect(wrappers).toHaveLength(2);
  });

  it("não usa dangerouslySetInnerHTML em nenhum nó", () => {
    const adversarial = {
      ...baseVariables,
      about_text: "<script>alert('xss')</script>\n\nMais texto.",
    };
    const { container } = render(<AboutSection variables={adversarial} />);

    // Se houvesse dangerouslySetInnerHTML, o <script> apareceria no DOM.
    expect(container.querySelector("script")).toBeNull();
    // O texto literal aparece como children React (escapado).
    expect(
      screen.getByText("<script>alert('xss')</script>"),
    ).toBeInTheDocument();
  });

  it("renderiza cards Missão/Visão/Valores com seus conteúdos", () => {
    render(<AboutSection variables={baseVariables} />);
    expect(
      screen.getByRole("heading", { level: 2, name: /Missão/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(SITE_FIXTURE.mission)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: /Visão/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(SITE_FIXTURE.vision)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: /Valores/i }),
    ).toBeInTheDocument();
  });

  it("renderiza cada `value` como item de lista", () => {
    render(<AboutSection variables={baseVariables} />);
    for (const value of baseVariables.values) {
      expect(screen.getByText(value)).toBeInTheDocument();
    }
    // Encontra a lista <ul> dentro do card "Valores".
    const valuesCard = screen.getByTestId("about-values");
    const items = valuesCard.querySelectorAll("li");
    expect(items.length).toBe(baseVariables.values.length);
  });

  it("renderiza imagem hero com alt descritivo (a11y)", () => {
    render(<AboutSection variables={baseVariables} />);
    const img = screen.getByAltText(`Sobre — ${SITE_FIXTURE.business_name}`);
    expect(img).toBeInTheDocument();
  });

  // AC7 round 3 — runtime axe-core (M2.3 #162 pattern). Roda contra o DOM
  // serializado pelo RTL e bloqueia violations serious/critical.
  it("não tem violações axe-core (a11y runtime)", async () => {
    const { container } = render(<AboutSection variables={baseVariables} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  }, 15_000);
});
