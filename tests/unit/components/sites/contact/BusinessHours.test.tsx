import { render, screen } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { describe, expect, it } from "vitest";

import { BusinessHours } from "@/components/sites/contact/BusinessHours";

expect.extend(toHaveNoViolations);

describe("<BusinessHours />", () => {
  it("divide horários por pipe em blocos visuais", () => {
    render(<BusinessHours hours="Seg–Sex 09h–18h | Sábado 09h–13h" />);

    expect(screen.getByText("Seg–Sex 09h–18h")).toBeInTheDocument();
    expect(screen.getByText("Sábado 09h–13h")).toBeInTheDocument();
  });

  it("divide horários por quebra de linha", () => {
    render(<BusinessHours hours={"Seg–Sex 09h–18h\nSábado 09h–13h"} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("usa fallback quando hours é null", () => {
    render(<BusinessHours hours={null} />);
    expect(screen.getByText("Segunda a Sexta: 09h-18h")).toBeInTheDocument();
    expect(screen.getByText("Sábado: 09h-13h")).toBeInTheDocument();
  });

  it("não tem violações axe-core", async () => {
    const { container } = render(<BusinessHours hours={null} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  }, 15_000);
});
