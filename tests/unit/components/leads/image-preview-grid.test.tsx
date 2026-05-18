/**
 * Tests do `<ImagePreviewGrid />` (sprint C2 onsite flow) — grid de
 * thumbnails das URLs de fotos de carros no `<LeadSiteEditModal>`.
 *
 * Cobre:
 *  - `urls=[]` → empty state desenhado (não tela em branco).
 *  - Render N thumbs com src correto e ordem preservada.
 *  - `onRemove(index)` disparado ao clicar no botão X.
 *  - Botão X só aparece quando `onRemove` foi passado (modo readonly).
 *  - Fallback `ImageOff` quando img dispara `onError` (URL quebrada).
 *  - `aria-label` do botão de remover inclui o número da foto.
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { ImagePreviewGrid } from "@/components/leads/image-preview-grid";

describe("ImagePreviewGrid", () => {
  it("renderiza empty state quando urls=[]", () => {
    render(<ImagePreviewGrid urls={[]} />);
    expect(
      screen.getByTestId("image-preview-grid-empty"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("image-preview-grid"),
    ).not.toBeInTheDocument();
  });

  it("renderiza N thumbs com src correto e ordem preservada", () => {
    render(
      <ImagePreviewGrid
        urls={[
          "https://ex.com/a.jpg",
          "https://ex.com/b.jpg",
          "https://ex.com/c.jpg",
        ]}
      />,
    );
    const grid = screen.getByTestId("image-preview-grid");
    expect(grid).toBeInTheDocument();
    expect(grid.children).toHaveLength(3);
    expect(screen.getByTestId("image-preview-grid-img-0")).toHaveAttribute(
      "src",
      "https://ex.com/a.jpg",
    );
    expect(screen.getByTestId("image-preview-grid-img-2")).toHaveAttribute(
      "src",
      "https://ex.com/c.jpg",
    );
  });

  it("dispara onRemove com índice ao clicar no botão X", () => {
    const onRemove = vi.fn();
    render(
      <ImagePreviewGrid
        urls={["https://ex.com/a.jpg", "https://ex.com/b.jpg"]}
        onRemove={onRemove}
      />,
    );
    fireEvent.click(screen.getByTestId("image-preview-grid-remove-1"));
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onRemove).toHaveBeenCalledWith(1);
  });

  it("oculta botão X quando onRemove não foi passado", () => {
    render(<ImagePreviewGrid urls={["https://ex.com/a.jpg"]} />);
    expect(
      screen.queryByTestId("image-preview-grid-remove-0"),
    ).not.toBeInTheDocument();
  });

  it("mostra fallback quando img dispara onError", () => {
    render(<ImagePreviewGrid urls={["https://broken/a.jpg"]} />);
    const img = screen.getByTestId("image-preview-grid-img-0");
    fireEvent.error(img);
    expect(
      screen.getByTestId("image-preview-grid-fallback-0"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("image-preview-grid-img-0"),
    ).not.toBeInTheDocument();
  });

  it("aria-label do botão de remover inclui o número da foto", () => {
    render(
      <ImagePreviewGrid
        urls={["https://ex.com/a.jpg"]}
        onRemove={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Remover foto 1" }),
    ).toBeInTheDocument();
  });
});
