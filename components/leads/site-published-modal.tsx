"use client";

/**
 * `<SitePublishedModal />` — overlay de sucesso pós-`generateLeadSite`
 * (sprint B3 onsite flow). Mostra:
 *   - QR code grande (240×240) com a URL pública pra cliente escanear.
 *   - URL completa + botão "Copiar".
 *   - CTA "Enviar pelo WhatsApp" (delega ao parent).
 *   - CTA "Abrir site" (link em nova aba pra demo no notebook).
 *
 * **V1 escopo deliberadamente reduzido**: sem link curto (precisa
 * domínio + service), sem download do QR (operador pode fazer
 * screenshot do iPad), sem mascote/celebração — manter denso e útil.
 *
 * Geração do QR client-side via `qrcode` lib (toDataURL). URL nunca
 * sai do dispositivo nem é enviada pra serviço externo.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { Dialog as DialogPrimitive } from "radix-ui";
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  Send,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SitePublishedModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** URL pública absoluta (ex: `https://app.gasplab.com/sites/abc-toyota`). */
  url: string;
  /** Slug é exibido como subtítulo pra contexto rápido. */
  slug: string;
  /** Disparado pelo botão "Copiar link". Parent gerencia toast/clipboard
   *  pra centralizar mensagens de erro de permissão de clipboard. */
  onCopy: () => void;
  /** Disparado pelo botão "Enviar via WhatsApp" — parent chama a action.
   *  Quando ausente, o botão fica oculto (sites que ainda não têm phone
   *  no lead, por exemplo). */
  onSendWhatsApp?: () => void;
  /** `true` enquanto a action de WhatsApp está em flight. */
  isSendingWhatsApp?: boolean;
}

/**
 * Render do QR como data URL via `qrcode` lib (client-side). Importado
 * dinamicamente pra evitar inflar o bundle inicial — só quem renderiza
 * este modal paga o ~30KB gzipped.
 */
function useQrDataUrl(url: string): string | null {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const mod = await import("qrcode");
        const result = await mod.default.toDataURL(url, {
          width: 240,
          margin: 1,
          errorCorrectionLevel: "M",
          color: { dark: "#0c0c0c", light: "#ffffff" },
        });
        if (!cancelled) setDataUrl(result);
      } catch {
        // Falha silenciosa — fallback UI (operador copia o link).
        if (!cancelled) setDataUrl(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url]);
  return dataUrl;
}

export function SitePublishedModal({
  open,
  onOpenChange,
  url,
  slug,
  onCopy,
  onSendWhatsApp,
  isSendingWhatsApp = false,
}: SitePublishedModalProps) {
  const qrDataUrl = useQrDataUrl(url);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-black/40",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
          )}
        />
        <DialogPrimitive.Content
          data-testid="lead-site-published-modal"
          className={cn(
            "fixed top-1/2 left-1/2 z-50 w-[min(28rem,calc(100vw-2rem))]",
            "-translate-x-1/2 -translate-y-1/2",
            "bg-card text-card-foreground",
            "border border-border rounded-xl shadow-lg",
            "max-h-[calc(100vh-2rem)] overflow-y-auto",
            "p-6",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          )}
        >
          <DialogPrimitive.Title className="flex items-center gap-2 text-lg font-semibold leading-tight">
            <CheckCircle2
              className="size-5 text-emerald-500"
              aria-hidden="true"
            />
            Site publicado
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="text-muted-foreground mt-1 text-sm">
            Mostre o QR pro cliente escanear no celular ou copie o link
            pra mandar por WhatsApp.
          </DialogPrimitive.Description>

          <DialogPrimitive.Close
            className="absolute top-3 right-3 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            aria-label="Fechar"
          >
            <X className="size-4" aria-hidden="true" />
          </DialogPrimitive.Close>

          <div className="mt-5 flex flex-col items-center gap-4">
            <div
              className="bg-white border border-border rounded-md p-3 shadow-sm"
              data-testid="lead-site-qr-wrapper"
              aria-label="QR code do site publicado"
            >
              {qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qrDataUrl}
                  alt={`QR code com o link ${url}`}
                  width={240}
                  height={240}
                  data-testid="lead-site-qr-image"
                  className="block"
                />
              ) : (
                <div
                  className="flex h-[240px] w-[240px] items-center justify-center text-muted-foreground"
                  data-testid="lead-site-qr-loading"
                >
                  <Loader2 className="size-6 animate-spin" aria-hidden="true" />
                </div>
              )}
            </div>

            <div className="w-full">
              <div className="text-muted-foreground mb-1 text-xs uppercase tracking-wide">
                URL do site
              </div>
              <div
                className="rounded-md border bg-muted/40 px-3 py-2 font-mono text-xs break-all"
                data-testid="lead-site-published-url"
              >
                {url}
              </div>
              <div className="text-muted-foreground mt-1 text-xs">
                Slug: <span className="font-mono">{slug}</span>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onCopy}
              data-testid="lead-site-published-copy"
            >
              <Copy className="size-4" aria-hidden="true" />
              Copiar link
            </Button>
            <Button asChild type="button" variant="outline" size="sm">
              <Link
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="lead-site-published-open"
              >
                <ExternalLink className="size-4" aria-hidden="true" />
                Abrir site
              </Link>
            </Button>
            {onSendWhatsApp ? (
              <Button
                type="button"
                size="sm"
                onClick={onSendWhatsApp}
                disabled={isSendingWhatsApp}
                aria-busy={isSendingWhatsApp}
                data-testid="lead-site-published-whatsapp"
              >
                {isSendingWhatsApp ? (
                  <>
                    <Loader2
                      className="size-4 animate-spin"
                      aria-hidden="true"
                    />
                    Enviando…
                  </>
                ) : (
                  <>
                    <Send className="size-4" aria-hidden="true" />
                    Enviar via WhatsApp
                  </>
                )}
              </Button>
            ) : null}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
