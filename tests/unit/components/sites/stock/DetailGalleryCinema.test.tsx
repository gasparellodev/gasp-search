import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe, toHaveNoViolations } from "jest-axe";
import { describe, expect, it } from "vitest";

import { DetailGalleryCinema } from "@/components/sites/stock/DetailGalleryCinema";

import { SITE_FIXTURE } from "../site-fixtures";

expect.extend(toHaveNoViolations);

const car = SITE_FIXTURE.cars[0]!;

describe("<DetailGalleryCinema />", () => {
  it("renderiza galeria cinema com scroll-snap, contador aria-live e alt text bloqueado", () => {
    render(<DetailGalleryCinema car={car} />);

    const gallery = screen.getByTestId("detail-gallery-cinema");
    const track = screen.getByTestId("detail-gallery-track");
    expect(gallery).toBeInTheDocument();
    expect(track).toHaveClass("snap-x");
    expect(track).toHaveClass("snap-mandatory");
    expect(screen.getByText("1/3")).toHaveAttribute("aria-live", "polite");
    expect(
      screen.getByAltText("Toyota Corolla 2022 - foto 1"),
    ).toBeInTheDocument();
    expect(
      screen.getByAltText("Toyota Corolla 2022 - foto 2"),
    ).toBeInTheDocument();
  });

  it("abre lightbox Radix, navega por teclado e retorna foco ao trigger", async () => {
    const user = userEvent.setup();
    render(<DetailGalleryCinema car={car} />);

    const trigger = screen.getByRole("button", { name: "Ampliar foto 1" });
    await user.click(trigger);

    const dialog = screen.getByRole("dialog", {
      name: "Galeria ampliada de Toyota Corolla 2022",
    });
    expect(within(dialog).getByText("1/3")).toBeInTheDocument();

    await user.keyboard("{ArrowRight}");
    expect(within(dialog).getByText("2/3")).toBeInTheDocument();

    await user.keyboard("{End}");
    expect(within(dialog).getByText("3/3")).toBeInTheDocument();

    await user.keyboard("{ArrowLeft}");
    expect(within(dialog).getByText("2/3")).toBeInTheDocument();

    await user.keyboard("{Home}");
    expect(within(dialog).getByText("1/3")).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Fechar galeria" }));
    expect(trigger).toHaveFocus();
  });

  it("não tem violações axe-core fechada nem aberta", async () => {
    const user = userEvent.setup();
    const { container } = render(<DetailGalleryCinema car={car} />);

    expect(await axe(container)).toHaveNoViolations();

    await user.click(screen.getByRole("button", { name: "Ampliar foto 1" }));
    expect(await axe(container)).toHaveNoViolations();
  });
});
