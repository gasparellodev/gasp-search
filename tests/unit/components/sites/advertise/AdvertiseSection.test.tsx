import { render, screen } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { describe, expect, it } from "vitest";

import { AdvertiseSection } from "@/components/sites/advertise/AdvertiseSection";

expect.extend(toHaveNoViolations);

const SITE_ID = "66666666-6666-4666-8666-666666666666";
const SLUG = "j7k2p9-touring-cars";

const baseProps = {
  siteId: SITE_ID,
  slug: SLUG,
  primary_color: "#0C0C0C",
  text_on_primary: "#FFFFFF" as const,
  business_name: "Touring Cars",
};

describe("<AdvertiseSection />", () => {
  it("renderiza <h1> 'Anuncie seu carro aqui'", () => {
    render(<AdvertiseSection {...baseProps} />);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /Anuncie seu carro aqui/i,
      }),
    ).toBeInTheDocument();
  });

  it("inclui o nome do negócio na descrição", () => {
    render(<AdvertiseSection {...baseProps} />);
    expect(
      screen.getByText(/Conte para a equipe da Touring Cars/i),
    ).toBeInTheDocument();
  });

  it("renderiza o <AnnounceForm /> aninhado", () => {
    render(<AdvertiseSection {...baseProps} />);
    expect(screen.getByTestId("announce-form")).toBeInTheDocument();
  });

  it("sanitiza cores adversariais antes de propagar pro AnnounceForm", () => {
    render(
      <AdvertiseSection
        {...baseProps}
        primary_color={"red; background: url(x);"}
      />,
    );
    const submit = screen.getByRole("button", { name: /Enviar anúncio/i });
    // sanitizeHex retorna #0C0C0C quando inválido.
    expect(submit).toHaveStyle({ backgroundColor: "#0C0C0C" });
  });

  // AC7 round 3 — runtime axe-core (M2.3 #162 pattern). Cobre o form
  // inteiro (labels, role=alert, aria-describedby) renderizado dentro do
  // AdvertiseSection.
  it("não tem violações axe-core (a11y runtime)", async () => {
    const { container } = render(<AdvertiseSection {...baseProps} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  }, 15_000);
});
