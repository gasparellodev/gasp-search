import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AnnounceProcessExplanation } from "@/components/sites/advertise/AnnounceProcessExplanation";

describe("<AnnounceProcessExplanation />", () => {
  it("explica o processo de avaliação em três cards", () => {
    render(<AnnounceProcessExplanation />);

    expect(
      screen.getByRole("heading", { name: /Como funciona a avaliação/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Envie os dados/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Adicione fotos/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Receba retorno/i })).toBeInTheDocument();
  });
});
