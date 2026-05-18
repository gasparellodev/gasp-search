"use client";

/**
 * `<ImagePreviewGrid />` — Sprint C2 onsite flow.
 *
 * Grid de thumbnails das URLs de fotos de carros usado dentro do
 * `<LeadSiteEditModal>`. Operador cola URL na textarea (ou no campo
 * de adição rápida) e VÊ o resultado imediatamente, em vez de só
 * uma lista de URLs cruas.
 *
 * **Por que `<img>` e não `next/image`:**
 *  - Admin interno; performance/SEO de admin não importa.
 *  - URLs colados são de domínios arbitrários (catálogo externo do
 *    cliente, Drive, S3, etc.). `next/image` exigiria
 *    `images.remotePatterns` exaustivo no `next.config`.
 *  - Mais fácil de testar em jsdom (sem mock de `next/image`).
 *
 * **Estado interno:** lista de índices que falharam o `onError` da
 * `<img>`. Quando uma URL quebrada é trocada por outra válida, o
 * fallback persiste no índice (limitação aceita — operador remove +
 * adiciona, ou reabre o modal).
 */
import { ImageOff, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  readonly urls: readonly string[];
  /**
   * Quando fornecido, cada thumb mostra um botão "X" no canto que
   * dispara `onRemove(index)`. Quando omitido, o grid é read-only
   * (útil para preview em estados não editáveis).
   */
  readonly onRemove?: (index: number) => void;
  readonly className?: string;
  /**
   * `data-testid` override pro root (`<ul>` ou `<p>` empty). Útil
   * quando o componente é usado dentro de um loop e cada instância
   * precisa de um testid único. Quando omitido, mantém os testids
   * default `image-preview-grid` / `image-preview-grid-empty`.
   */
  readonly "data-testid"?: string;
}

export function ImagePreviewGrid({
  urls,
  onRemove,
  className,
  "data-testid": dataTestId,
}: Props) {
  const [failed, setFailed] = useState<readonly number[]>([]);

  if (urls.length === 0) {
    return (
      <p
        data-testid={dataTestId ?? "image-preview-grid-empty"}
        className={cn(
          "rounded-md border border-dashed bg-muted/30 px-3 py-4 text-center text-xs text-muted-foreground",
          className,
        )}
      >
        Nenhuma foto adicionada. Cole URLs na textarea acima ou use o
        campo de adição rápida.
      </p>
    );
  }

  return (
    <ul
      data-testid={dataTestId ?? "image-preview-grid"}
      className={cn(
        "mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5",
        className,
      )}
    >
      {urls.map((url, index) => {
        const isBroken = failed.includes(index);
        return (
          <li
            key={`${index}-${url}`}
            className="relative aspect-square overflow-hidden rounded-md border bg-muted"
          >
            {isBroken ? (
              <div
                className="flex h-full flex-col items-center justify-center gap-1 px-2 text-center text-muted-foreground"
                data-testid={`image-preview-grid-fallback-${index}`}
              >
                <ImageOff className="h-5 w-5" aria-hidden />
                <span className="text-[10px] leading-tight">
                  Falha ao carregar
                </span>
                <span className="sr-only">
                  Falha ao carregar foto {index + 1}
                </span>
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- admin interno, ver doc no topo do arquivo
              <img
                src={url}
                alt={`Foto ${index + 1}`}
                className="h-full w-full object-cover"
                loading="lazy"
                onError={() =>
                  setFailed((prev) =>
                    prev.includes(index) ? prev : [...prev, index],
                  )
                }
                data-testid={`image-preview-grid-img-${index}`}
              />
            )}
            {onRemove ? (
              <Button
                type="button"
                size="icon"
                variant="destructive"
                onClick={() => onRemove(index)}
                aria-label={`Remover foto ${index + 1}`}
                className="absolute right-1 top-1 h-6 w-6"
                data-testid={`image-preview-grid-remove-${index}`}
              >
                <X className="h-3 w-3" aria-hidden />
              </Button>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
