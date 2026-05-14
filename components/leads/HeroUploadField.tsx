"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { uploadLeadSiteHero } from "@/app/actions/lead-site";
import { cn } from "@/lib/utils";

const ACCEPTED_MIMES = ["image/png", "image/jpeg", "image/webp"] as const;
const MAX_SIZE_BYTES = 4 * 1024 * 1024;
const MAX_SIZE_LABEL = "4 MB";

interface HeroUploadFieldProps {
  leadSiteId: string;
  /** URL atual do hero (consumida pelo preview inicial). */
  currentHeroUrl?: string | null;
  /**
   * Callback chamado quando o upload é bem-sucedido. O caller deve
   * atualizar o estado do form (ex.: `setValue('brand_assets.hero_image_url', url)`).
   */
  onUploaded?: (url: string) => void;
}

function validateClientSide(file: File): string | null {
  if (
    !ACCEPTED_MIMES.includes(file.type as (typeof ACCEPTED_MIMES)[number])
  ) {
    return "Formato inválido. Use PNG, JPEG ou WEBP.";
  }
  if (file.size > MAX_SIZE_BYTES) {
    return `Arquivo maior que ${MAX_SIZE_LABEL}. Tente uma imagem menor.`;
  }
  return null;
}

/**
 * `<HeroUploadField>` — espelha `<LogoUploadField>` (WP6) mas pro hero
 * principal do site (`brand_assets.hero_image_url`). Storage path:
 * `<slug>/hero-<hash>.<ext>`. MIME: PNG/JPEG/WEBP. Size ≤ 4 MB.
 *
 * Preview maior (16:9 em vez de quadrado 80×80) por refletir o aspect
 * ratio típico do hero no site público.
 */
export function HeroUploadField({
  leadSiteId,
  currentHeroUrl = null,
  onUploaded,
}: HeroUploadFieldProps) {
  const [preview, setPreview] = useState<string | null>(currentHeroUrl);
  const [dragOver, setDragOver] = useState(false);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
    const error = validateClientSide(file);
    if (error) {
      toast.error(error);
      return;
    }

    const formData = new FormData();
    formData.set("file", file);

    startTransition(async () => {
      const result = await uploadLeadSiteHero(leadSiteId, formData);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Hero atualizado com sucesso.");
      setPreview(result.hero_image_url);
      onUploaded?.(result.hero_image_url);
    });
  }

  function onDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragOver(false);
    const file = event.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) handleFile(file);
    event.target.value = "";
  }

  return (
    <div className="flex flex-col gap-2" data-testid="hero-upload-field">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!dragOver) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={cn(
          "flex flex-col gap-4 rounded-lg border-2 border-dashed p-4 transition-colors sm:flex-row sm:items-center",
          dragOver ? "border-primary bg-primary/5" : "border-input",
        )}
      >
        <div
          className="aspect-video w-full shrink-0 overflow-hidden rounded-md border bg-muted sm:w-48"
          data-testid="hero-upload-preview"
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- preview client-side; URL pode ser CDN externa
            <img
              src={preview}
              alt="Preview do hero do site"
              className="size-full object-cover"
            />
          ) : (
            <div className="flex size-full items-center justify-center text-xs text-muted-foreground">
              Sem imagem hero
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => inputRef.current?.click()}
            className="inline-flex w-fit items-center justify-center rounded-md border bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            data-testid="hero-upload-button"
          >
            {pending ? "Enviando..." : "Trocar hero"}
          </button>
          <p className="text-xs text-muted-foreground">
            PNG, JPEG ou WEBP — até {MAX_SIZE_LABEL}. Aspect ratio
            recomendado 16:9. Arraste aqui ou clique no botão.
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          hidden
          accept={ACCEPTED_MIMES.join(",")}
          aria-label="Selecionar hero"
          onChange={onChange}
          data-testid="hero-upload-input"
        />
      </div>
    </div>
  );
}
