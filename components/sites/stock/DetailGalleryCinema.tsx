"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { preload } from "react-dom";
import Image from "next/image";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";
import type { SiteCar } from "@/types/lead-site";

interface DetailGalleryCinemaProps {
  car: SiteCar;
}

const PLACEHOLDER_IMAGE = "/placeholder.svg";

export function DetailGalleryCinema({ car }: DetailGalleryCinemaProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const triggerRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const images = useMemo(
    () => (car.photos && car.photos.length > 0 ? car.photos : car.gallery_urls),
    [car.gallery_urls, car.photos],
  );
  const total = images.length;
  const safeIdx = Math.min(activeIdx, Math.max(0, total - 1));
  const carLabel = `${car.brand} ${car.model} ${car.year}`;

  // Wave B1 (R-01): preload do 2º + 3º imagens dentro de useEffect pra
  // não disparar a cada render. Mantém ganho de LCP/UX sem flood de
  // resource hints. Primeira imagem segue com `priority` no <Image>.
  useEffect(() => {
    for (const url of images.slice(1, 3)) {
      preload(url, { as: "image" });
    }
  }, [images]);

  const goTo = useCallback(
    (nextIdx: number) => {
      const idx = Math.max(0, Math.min(total - 1, nextIdx));
      setActiveIdx(idx);
      trackRef.current?.children[idx]?.scrollIntoView({
        block: "nearest",
        inline: "center",
      });
    },
    [total],
  );

  const updateFromScroll = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const children = Array.from(track.children);
    if (children.length === 0) return;
    const center = track.scrollLeft + track.clientWidth / 2;
    let nearestIdx = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;

    children.forEach((child, idx) => {
      const element = child as HTMLElement;
      const childCenter = element.offsetLeft + element.offsetWidth / 2;
      const distance = Math.abs(childCenter - center);
      if (distance < nearestDistance) {
        nearestIdx = idx;
        nearestDistance = distance;
      }
    });

    setActiveIdx(nearestIdx);
  }, []);

  const openAt = useCallback((idx: number) => {
    setActiveIdx(idx);
    setLightboxOpen(true);
  }, []);

  if (total === 0) {
    return (
      <div
        data-testid="detail-gallery-cinema"
        className="h-[70dvh] min-h-[420px] rounded-[var(--auto-radius-md,8px)] bg-foreground/5"
      />
    );
  }

  return (
    // Wave B1 (R-02): 1 único <Dialog.Root> controlado externamente —
    // antes era 1 Root por foto (N portais + N focus traps + N
    // aria-live duplicados). Cada thumb agora chama openAt(idx).
    <DialogPrimitive.Root open={lightboxOpen} onOpenChange={setLightboxOpen}>
      <section
        data-testid="detail-gallery-cinema"
        aria-label={`Galeria de ${carLabel}`}
        className="relative"
      >
        <div
          ref={trackRef}
          data-testid="detail-gallery-track"
          onScroll={updateFromScroll}
          className="flex h-[70dvh] min-h-[420px] snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth rounded-[var(--auto-radius-md,8px)]"
        >
          {images.map((url, idx) => (
            <button
              key={url}
              ref={(el) => {
                triggerRefs.current[idx] = el;
              }}
              type="button"
              onClick={() => openAt(idx)}
              aria-label={`Ampliar foto ${idx + 1}`}
              className="relative h-full min-w-full snap-center overflow-hidden bg-foreground/5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40"
            >
              <Image
                src={url}
                alt={`${carLabel} - foto ${idx + 1}`}
                fill
                sizes="(max-width: 768px) 100vw, 70vw"
                className="object-cover"
                priority={idx === 0}
                loading={idx === 0 ? undefined : "lazy"}
                unoptimized
              />
            </button>
          ))}
        </div>

        <div className="pointer-events-none absolute bottom-4 left-4 right-4 flex items-center justify-between gap-3">
          <span className="rounded-full bg-black/60 px-3 py-1 text-sm font-medium text-white backdrop-blur">
            <span aria-live="polite" aria-atomic="true">
              {safeIdx + 1}/{total}
            </span>
          </span>
          {total > 1 ? (
            <div className="hidden gap-2 md:flex">
              <button
                type="button"
                onClick={() => goTo(safeIdx - 1)}
                disabled={safeIdx === 0}
                aria-label="Foto anterior"
                className="pointer-events-auto inline-flex size-10 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur transition hover:bg-black/75 disabled:opacity-40"
              >
                <ChevronLeft className="size-5" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => goTo(safeIdx + 1)}
                disabled={safeIdx === total - 1}
                aria-label="Próxima foto"
                className="pointer-events-auto inline-flex size-10 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur transition hover:bg-black/75 disabled:opacity-40"
              >
                <ChevronRight className="size-5" aria-hidden />
              </button>
            </div>
          ) : null}
        </div>
      </section>

      <GalleryLightbox
        carLabel={carLabel}
        images={images}
        activeIdx={safeIdx}
        onGoTo={setActiveIdx}
        onCloseAutoFocus={(event) => {
          // Wave B1: Dialog controlado sem <Trigger> — Radix não sabe
          // pra onde devolver foco. Restaura no thumb da foto ativa.
          event.preventDefault();
          triggerRefs.current[safeIdx]?.focus();
        }}
      />
    </DialogPrimitive.Root>
  );
}

interface GalleryLightboxProps {
  carLabel: string;
  images: ReadonlyArray<string>;
  activeIdx: number;
  onGoTo: (idx: number) => void;
  onCloseAutoFocus: (event: Event) => void;
}

function GalleryLightbox({
  carLabel,
  images,
  activeIdx,
  onGoTo,
  onCloseAutoFocus,
}: GalleryLightboxProps) {
  const total = images.length;
  // Wave B1: defensive — substitui images[activeIdx] ?? images[0]! por
  // fallback explícito (noUncheckedIndexedAccess: o `!` mascarava o
  // caso de array vazio que JÁ é tratado upstream).
  const image = images[activeIdx] ?? images[0] ?? PLACEHOLDER_IMAGE;

  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-[var(--z-lightbox,90)] bg-black/85" />
      <DialogPrimitive.Content
        aria-label={`Galeria ampliada de ${carLabel}`}
        aria-describedby={undefined}
        onCloseAutoFocus={onCloseAutoFocus}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            onGoTo(Math.max(0, activeIdx - 1));
          }
          if (event.key === "ArrowRight") {
            event.preventDefault();
            onGoTo(Math.min(total - 1, activeIdx + 1));
          }
          if (event.key === "Home") {
            event.preventDefault();
            onGoTo(0);
          }
          if (event.key === "End") {
            event.preventDefault();
            onGoTo(total - 1);
          }
        }}
        className="fixed inset-0 z-[calc(var(--z-lightbox,90)+1)] flex items-center justify-center bg-black p-4 text-white outline-none"
      >
        <DialogPrimitive.Title className="sr-only">
          Galeria ampliada de {carLabel}
        </DialogPrimitive.Title>
        <div className="absolute left-4 top-4 rounded-full bg-white/10 px-3 py-1 text-sm font-medium backdrop-blur">
          <span aria-live="polite" aria-atomic="true">
            {activeIdx + 1}/{total}
          </span>
        </div>
        <DialogPrimitive.Close asChild>
          <button
            type="button"
            aria-label="Fechar galeria"
            className="absolute right-4 top-4 inline-flex size-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            <X className="size-5" aria-hidden />
          </button>
        </DialogPrimitive.Close>

        {total > 1 ? (
          <>
            <button
              type="button"
              onClick={() => onGoTo(Math.max(0, activeIdx - 1))}
              disabled={activeIdx === 0}
              aria-label="Foto anterior"
              className="absolute left-4 top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 disabled:opacity-35"
            >
              <ChevronLeft className="size-6" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => onGoTo(Math.min(total - 1, activeIdx + 1))}
              disabled={activeIdx === total - 1}
              aria-label="Próxima foto"
              className="absolute right-4 top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 disabled:opacity-35"
            >
              <ChevronRight className="size-6" aria-hidden />
            </button>
          </>
        ) : null}

        <div className="relative h-[calc(100dvh-6rem)] w-full max-w-6xl">
          <Image
            src={image}
            alt={`${carLabel} - foto ${activeIdx + 1}`}
            fill
            sizes="100vw"
            className={cn("object-contain")}
            unoptimized
          />
        </div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
