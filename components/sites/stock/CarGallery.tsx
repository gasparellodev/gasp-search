"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

interface CarGalleryProps {
  /** URLs ordenadas (1ª = principal). 1..8 imagens. */
  images: ReadonlyArray<string>;
  /** Alt textual para todas as imagens (variante por índice já vem aqui). */
  alt: string;
}

/**
 * Galeria do `<CarDetailSection>` (Phase 7 — issue #164). Client Component.
 *
 * Layout:
 *   - Imagem principal (controle por estado `activeIdx`).
 *   - Tira de thumbnails (até 8) com `aria-current="true"` na ativa.
 *   - Click na imagem principal → `<dialog>` lightbox abre via
 *     `dialogRef.current?.showModal()`. ESC fecha (built-in do `<dialog>`),
 *     focus retorna ao trigger ao fechar (built-in via `:focus`).
 *
 * **Por que `<dialog>` nativo?** Per spec §13: zero deps externas, focus
 * trap built-in nos browsers modernos, ESC handling automático, 0 KB
 * adicional no bundle. Tradeoff: precisamos de polyfill em browsers
 * antigos (Safari < 15.4) — V1 ignora.
 */
export function CarGallery({ images, alt }: CarGalleryProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [open, setOpen] = useState(false);

  const total = images.length;
  const safeIdx = Math.min(activeIdx, Math.max(0, total - 1));
  const main = images[safeIdx] ?? images[0];

  function openLightbox() {
    dialogRef.current?.showModal();
    setOpen(true);
  }

  function closeLightbox() {
    dialogRef.current?.close();
    setOpen(false);
  }

  // Restaurar foco ao trigger quando o dialog fecha por ESC ou clique no
  // backdrop (eventos disparados pelo <dialog> nativo).
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleClose = () => {
      setOpen(false);
      triggerRef.current?.focus();
    };
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, []);

  if (total === 0 || !main) {
    // Defesa: schema garante 3..8 imagens, mas testes com fixture
    // adversarial podem chegar com [].
    return (
      <div
        data-testid="car-gallery"
        className="aspect-[4/3] w-full rounded-3xl bg-foreground/5"
      />
    );
  }

  return (
    <div data-testid="car-gallery" className="flex flex-col gap-3">
      <button
        ref={triggerRef}
        type="button"
        onClick={openLightbox}
        data-testid="car-gallery-trigger"
        className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40"
        aria-label="Ampliar imagem"
      >
        <Image
          src={main}
          alt={`${alt} — imagem ${safeIdx + 1} de ${total}`}
          fill
          sizes="(max-width: 768px) 100vw, 50vw"
          className="object-cover"
          priority
          unoptimized
        />
      </button>

      {total > 1 && (
        <ul
          data-testid="car-gallery-thumbs"
          className="grid grid-cols-4 gap-2 md:grid-cols-6"
        >
          {images.map((url, idx) => {
            const isActive = idx === safeIdx;
            return (
              <li key={url}>
                <button
                  type="button"
                  onClick={() => setActiveIdx(idx)}
                  aria-current={isActive ? "true" : undefined}
                  aria-label={`Mostrar imagem ${idx + 1} de ${total}`}
                  className={cn(
                    "relative block aspect-[4/3] w-full overflow-hidden rounded-xl border-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40",
                    isActive
                      ? "border-foreground"
                      : "border-transparent hover:border-foreground/40",
                  )}
                >
                  <Image
                    src={url}
                    alt=""
                    fill
                    sizes="120px"
                    className="object-cover"
                    unoptimized
                  />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <dialog
        ref={dialogRef}
        data-testid="car-gallery-dialog"
        aria-label="Imagem ampliada"
        className="m-0 h-full max-h-screen w-full max-w-screen-lg bg-black/95 p-0 text-white backdrop:bg-black/80"
      >
        {open && (
          <div className="relative flex h-full w-full items-center justify-center">
            <button
              type="button"
              onClick={closeLightbox}
              data-testid="car-gallery-dialog-close"
              aria-label="Fechar"
              className="absolute right-4 top-4 inline-flex size-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <X aria-hidden className="size-5" />
            </button>
            <div className="relative aspect-[4/3] w-full max-w-5xl">
              <Image
                src={main}
                alt={`${alt} — ampliada (${safeIdx + 1} de ${total})`}
                fill
                sizes="90vw"
                className="object-contain"
                unoptimized
              />
            </div>
          </div>
        )}
      </dialog>
    </div>
  );
}
