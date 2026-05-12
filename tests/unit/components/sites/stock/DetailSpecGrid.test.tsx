import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DetailSpecGrid } from "@/components/sites/stock/DetailSpecGrid";

import { SITE_FIXTURE } from "../site-fixtures";

describe("<DetailSpecGrid />", () => {
  it("renderiza campos top-level e datasheet permitido em grid híbrido", () => {
    const car = {
      ...SITE_FIXTURE.cars[0]!,
      doors: 4 as const,
      category: "Sedan" as const,
      datasheet: [
        ["Motor", "2.0 16v"],
        ["Cilindradas", "1.987 cc"],
        ["Final da placa", "8"],
        ["Banco", "Couro"],
      ] as Array<[string, string]>,
    };

    render(<DetailSpecGrid car={car} />);

    const grid = screen.getByTestId("detail-spec-grid");
    expect(within(grid).getByText("Marca")).toBeInTheDocument();
    expect(within(grid).getByText("Toyota")).toBeInTheDocument();
    expect(within(grid).getByText("Modelo")).toBeInTheDocument();
    expect(within(grid).getByText("Corolla")).toBeInTheDocument();
    expect(within(grid).getByText("Ano")).toBeInTheDocument();
    expect(within(grid).getByText("2022")).toBeInTheDocument();
    expect(within(grid).getByText("Quilometragem")).toBeInTheDocument();
    expect(within(grid).getByText("35.000 km")).toBeInTheDocument();
    expect(within(grid).getByText("Portas")).toBeInTheDocument();
    expect(within(grid).getByText("4 portas")).toBeInTheDocument();
    expect(within(grid).getByText("Categoria")).toBeInTheDocument();
    expect(within(grid).getByText("Sedan")).toBeInTheDocument();
    expect(within(grid).getByText("Motor")).toBeInTheDocument();
    expect(within(grid).getByText("2.0 16v")).toBeInTheDocument();
    expect(within(grid).getByText("Cilindradas")).toBeInTheDocument();
    expect(within(grid).getByText("1.987 cc")).toBeInTheDocument();
    expect(within(grid).getByText("Final da placa")).toBeInTheDocument();
    expect(within(grid).getByText("8")).toBeInTheDocument();
    expect(within(grid).queryByText("Banco")).not.toBeInTheDocument();
    expect(screen.getAllByTestId("detail-spec-item")).toHaveLength(12);
  });

  it("omite campos opcionais ausentes sem placeholder", () => {
    const car = {
      ...SITE_FIXTURE.cars[0]!,
      category: undefined,
      doors: undefined,
      datasheet: [["Banco", "Couro"]] as Array<[string, string]>,
    };

    render(<DetailSpecGrid car={car} />);

    expect(screen.queryByText("Portas")).not.toBeInTheDocument();
    expect(screen.queryByText("Categoria")).not.toBeInTheDocument();
    expect(screen.queryByText("Banco")).not.toBeInTheDocument();
    expect(screen.queryByText("—")).not.toBeInTheDocument();
    expect(screen.getAllByTestId("detail-spec-item")).toHaveLength(7);
  });
});
