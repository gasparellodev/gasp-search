import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AnnounceHero } from "@/components/sites/advertise/AnnounceHero";

describe("<AnnounceHero />", () => {
  it("renderiza hero editorial da página Anunciar", () => {
    render(<AnnounceHero businessName="Touring Cars" />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /Anuncie seu carro aqui/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/equipe da Touring Cars avaliar/i)).toBeInTheDocument();
  });

  it("renderiza banner contextual do carro alvo quando informado", () => {
    render(
      <AnnounceHero
        businessName="Touring Cars"
        targetCar={{ brand: "BMW", model: "M2", year: 2023 }}
      />,
    );

    expect(screen.getByTestId("announce-target-car")).toHaveTextContent(
      "BMW M2 2023",
    );
  });
});
