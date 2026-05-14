"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { uploadLeadSiteLogo } from "@/app/actions/lead-site";
import { cn } from "@/lib/utils";

const ACCEPTED_MIMES = [
  "image/png",
  "image/svg+xml",
  "image/jpeg",
  "image/webp",
] as const;
const MAX_SIZE_BYTES = 2 * 1024 * 1024;
const MAX_SIZE_LABEL = "2 MB";

interface LogoUploadFieldProps {
  leadSiteId: string;
  /** URL atual da logo (consumida pelo preview inicial). */
  currentLogoUrl?: string | null;
  /**
   * Callback chamado quando o upload é bem-sucedido. O caller deve atualizar
   * o estado do form (ex.: `setValue('brand_assets.logo_url', url)`) e/ou
   * fazer router.refresh().
   */
  onUploaded?: (url: string) => void;
}

function validateClientSide(file: File): string | null {
  if (
    !ACCEPTED_MIMES.includes(file.type as (typeof ACCEPTED_MIMES)[number])
  ) {
    return "Formato inválido. Use PNG, SVG, JPEG ou WEBP.";
  }
  if (file.size > MAX_SIZE_BYTES) {
    return `Arquivo maior que ${MAX_SIZE_LABEL}. Tente uma imagem menor.`;
  }
  return null;
}

/**
 * `<LogoUploadField>` — substituiu o input URL legado pelo upload direto
 * pro Supabase Storage via Server Action `uploadLeadSiteLogo` (WP5 #313).
 *
 * UX:
 *   - Dropzone drag-and-drop + botão "Trocar logo" (file picker).
 *   - Preview 80x80 da logo atual / acabada de enviar (DataURL otimista).
 *   - Validação client-side de MIME + size ANTES de subir (toast de erro
 *     evita roundtrip inútil). Server Action revalida defesa em profundidade.
 *   - Estado `pending` desabilita o botão durante upload.
 *
 * Acessibilidade:
 *   - `<input type="file" hidden>` recebe `aria-label="Selecionar logo"`.
 *   - Preview `<img>` recebe alt text descritivo.
 *   - Toast feedback usa `sonner` (queue assertive default).
 */
export function LogoUploadField({
  leadSiteId,
  currentLogoUrl = null,
  onUploaded,
}: LogoUploadFieldProps) {
  const [preview, setPreview] = useState<string | null>(currentLogoUrl);
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
      const result = await uploadLeadSiteLogo(leadSiteId, formData);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Logo atualizada com sucesso.");
      setPreview(result.logo_url);
      onUploaded?.(result.logo_url);
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
    // Reset value pra permitir re-seleção do mesmo arquivo
    event.target.value = "";
  }

  return (
    <div className="flex flex-col gap-2" data-testid="logo-upload-field">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!dragOver) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={cn(
          "flex items-center gap-4 rounded-lg border-2 border-dashed p-4 transition-colors",
          dragOver ? "border-primary bg-primary/5" : "border-input",
        )}
      >
        <div
          className="size-20 shrink-0 overflow-hidden rounded-md border bg-muted"
          data-testid="logo-upload-preview"
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- preview client-side de DataURL/CDN externa; next/image não suporta DataURL otimista
            <img
              src={preview}
              alt="Preview da logo do site"
              className="size-full object-contain"
            />
          ) : (
            <div className="flex size-full items-center justify-center text-xs text-muted-foreground">
              Sem logo
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => inputRef.current?.click()}
            className="inline-flex w-fit items-center justify-center rounded-md border bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            data-testid="logo-upload-button"
          >
            {pending ? "Enviando..." : "Trocar logo"}
          </button>
          <p className="text-xs text-muted-foreground">
            PNG, SVG, JPEG ou WEBP — até {MAX_SIZE_LABEL}. Arraste aqui ou
            clique no botão.
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          hidden
          accept={ACCEPTED_MIMES.join(",")}
          aria-label="Selecionar logo"
          onChange={onChange}
          data-testid="logo-upload-input"
        />
      </div>
    </div>
  );
}
