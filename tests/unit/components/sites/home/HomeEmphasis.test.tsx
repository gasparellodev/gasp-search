import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { HomeEmphasis } from "@/components/sites/home/HomeEmphasis";

import { SITE_FIXTURE } from "../site-fixtures";

describe("<HomeEmphasis />", () => {
  it("renderiza um <h2> com `emphasis.title`", () => {
    render(<HomeEmphasis emphasis={SITE_FIXTURE.emphasis} />);
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: SITE_FIXTURE.emphasis.title,
      }),
    ).toBeInTheDocument();
  });

  it("renderiza `car_name` e `description`", () => {
    render(<HomeEmphasis emphasis={SITE_FIXTURE.emphasis} />);
    expect(
      screen.getByText(SITE_FIXTURE.emphasis.car_name),
    ).toBeInTheDocument();
    expect(
      screen.getByText(SITE_FIXTURE.emphasis.description),
    ).toBeInTheDocument();
  });

  it("preserva line-breaks via CSS `white-space: pre-line` (sem dangerouslySetInnerHTML)", () => {
    const emphasis = {
      ...SITE_FIXTURE.emphasis,
      description:
        "Linha um sobre o veículo.\nLinha dois sobre o destaque desta semana.",
    };
    const { container } = render(<HomeEmphasis emphasis={emphasis} />);
    // localiza o <p> que contém o texto de descrição (texto pode incluir \n)
    const paragraph = container.querySelector("p.whitespace-pre-line");
    expect(paragraph).not.toBeNull();
    expect(paragraph?.textContent).toContain("Linha um");
    expect(paragraph?.textContent).toContain("Linha dois");
  });

  it("renderiza imagem com alt `Destaque — <car_name>`", () => {
    render(<HomeEmphasis emphasis={SITE_FIXTURE.emphasis} />);
    expect(
      screen.getByAltText(`Destaque — ${SITE_FIXTURE.emphasis.car_name}`),
    ).toBeInTheDocument();
  });
});
