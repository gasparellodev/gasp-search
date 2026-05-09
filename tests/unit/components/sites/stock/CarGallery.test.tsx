import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { CarGallery } from "@/components/sites/stock/CarGallery";

const IMAGES = [
  "https://cdn.example.com/cars/1.jpg",
  "https://cdn.example.com/cars/2.jpg",
  "https://cdn.example.com/cars/3.jpg",
];

beforeEach(() => {
  // jsdom não implementa <dialog>.showModal() nem .close() por padrão.
  // Stub mínimo para os testes funcionais.
  HTMLDialogElement.prototype.showModal = vi.fn(function (
    this: HTMLDialogElement,
  ) {
    this.setAttribute("open", "");
  });
  HTMLDialogElement.prototype.close = vi.fn(function (
    this: HTMLDialogElement,
  ) {
    this.removeAttribute("open");
    // Disparar evento close (built-in real do dialog).
    this.dispatchEvent(new Event("close"));
  });
});

describe("<CarGallery />", () => {
  it("renderiza a imagem principal (1ª por default)", () => {
    render(<CarGallery images={IMAGES} alt="Toyota Corolla 2022" />);
    const main = screen.getByAltText(/Toyota Corolla 2022 — imagem 1 de 3/);
    expect(main).toBeInTheDocument();
  });

  it("renderiza os thumbnails (1 por imagem)", () => {
    render(<CarGallery images={IMAGES} alt="Toyota Corolla 2022" />);
    const thumbs = screen.getByTestId("car-gallery-thumbs");
    expect(thumbs.querySelectorAll("li")).toHaveLength(IMAGES.length);
  });

  it("thumb ativo recebe aria-current='true'", async () => {
    const user = userEvent.setup();
    render(<CarGallery images={IMAGES} alt="Toyota Corolla 2022" />);
    const thumbs = screen.getByTestId("car-gallery-thumbs");
    const buttons = thumbs.querySelectorAll("button");
    expect(buttons[0]).toHaveAttribute("aria-current", "true");

    await user.click(buttons[1]!);
    expect(buttons[1]).toHaveAttribute("aria-current", "true");
    expect(buttons[0]).not.toHaveAttribute("aria-current");
  });

  it("clicar imagem principal abre o <dialog> lightbox", async () => {
    const user = userEvent.setup();
    render(<CarGallery images={IMAGES} alt="Toyota Corolla 2022" />);
    const trigger = screen.getByTestId("car-gallery-trigger");
    await user.click(trigger);

    const dialog = screen.getByTestId("car-gallery-dialog") as HTMLDialogElement;
    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled();
    expect(dialog.hasAttribute("open")).toBe(true);
  });

  it("botão Fechar dispara close()", async () => {
    const user = userEvent.setup();
    render(<CarGallery images={IMAGES} alt="Toyota Corolla 2022" />);
    await user.click(screen.getByTestId("car-gallery-trigger"));

    const closeBtn = screen.getByTestId("car-gallery-dialog-close");
    await user.click(closeBtn);

    expect(HTMLDialogElement.prototype.close).toHaveBeenCalled();
  });

  it("aceita gracefully imagens vazias (defensivo)", () => {
    render(<CarGallery images={[]} alt="x" />);
    expect(screen.getByTestId("car-gallery")).toBeInTheDocument();
  });

  it("não renderiza thumbnails quando há apenas 1 imagem", () => {
    render(
      <CarGallery
        images={["https://cdn.example.com/cars/single.jpg"]}
        alt="Single"
      />,
    );
    expect(screen.queryByTestId("car-gallery-thumbs")).toBeNull();
  });
});
