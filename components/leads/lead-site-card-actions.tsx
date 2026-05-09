"use client";

/**
 * Cluster de botões interativos do `<LeadSiteCard />` (issue #167).
 *
 * Server boundary: o `<LeadSiteCard />` (Server Component) busca o
 * `lead_sites` row via Supabase com RLS e passa os dados serializáveis
 * pra cá. **Toda lógica de cliente** (clipboard, useTransition, toast,
 * AlertDialog) vive aqui.
 *
 * **Histórico de issues:**
 *  - #167 — Esqueleto do card + estado `none`/`published`/`archived`/`draft`,
 *           botão Copiar e Pré-visualizar.
 *  - #168 — Botão "Editar" liga ao `<LeadSiteEditModal>`.
 *  - #169 — Botões "Regerar" / "Arquivar" / "Restaurar" agora ATIVOS.
 *           Confirmação destrutiva via `<AlertDialog>` antes de arquivar.
 *  - #171 — "Enviar via WhatsApp" agora ATIVO em status `'published'` /
 *           `'sent'` (re-send permitido). Dispara `sendLeadSiteWhatsApp`
 *           com `useTransition` + toast.
 */

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertDialog as AlertDialogPrimitive } from "radix-ui";
import {
  ArchiveRestore,
  ArchiveX,
  Copy,
  ExternalLink,
  Loader2,
  Pencil,
  RotateCcw,
  Send,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import {
  archiveLeadSite,
  generateLeadSite,
  restoreLeadSite,
  sendLeadSiteWhatsApp,
} from "@/app/actions/lead-site";
import type {
  GenerateLeadSiteResult,
  LeadSiteStatusActionResult,
  SendLeadSiteWhatsAppResult,
} from "@/app/actions/lead-site";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { LeadSiteEditModal } from "./LeadSiteEditModal";
import type { LeadSiteCardData, LeadSiteStatus } from "./lead-site-card-types";

interface LeadSiteCardActionsProps {
  /** Linha de `lead_sites` ou `null` quando o lead ainda não tem site. */
  leadSite: LeadSiteCardData | null;
  /** Lead alvo. Necessário pra `generateLeadSite(leadId)`. */
  leadId: string;
  /** Base URL pública pra compor `/sites/<slug>` — vem do Server Component
   *  que lê de `lib/env-public`. Cliente NÃO lê env diretamente pra
   *  preservar a fronteira (env-public ainda é seguro, mas centralizar
   *  aqui evita duplicação). */
  appUrl: string;
}

/**
 * Mapeia o `error` discriminated da Server Action `generateLeadSite` pra
 * mensagem amigável em PT-BR (CLAUDE.md §convenções: "PT-BR em mensagens
 * ao usuário").
 */
function generateErrorMessage(
  error: GenerateLeadSiteResult & { ok: false },
): string {
  switch (error.error) {
    case "auth":
      return "Sessão expirada. Faça login novamente.";
    case "not_found":
      return "Lead não encontrado.";
    case "rate_limit":
      return "Muitas tentativas em sequência. Tente novamente em 1 minuto.";
    case "ai_error":
      return "Falha ao gerar a copy via IA. Tentaremos novamente em instantes.";
    case "validation":
      return "Os dados do lead não passaram na validação. Confira tags/categoria.";
    case "db_error":
      return "Erro ao salvar o site. Tente novamente em instantes.";
    default:
      return error.message ?? "Erro desconhecido ao gerar o site.";
  }
}

/**
 * Mapeia o `error` das Server Actions `archiveLeadSite` / `restoreLeadSite`
 * pra mensagem PT-BR.
 */
function statusActionErrorMessage(
  error: LeadSiteStatusActionResult & { ok: false },
): string {
  switch (error.error) {
    case "auth":
      return "Sessão expirada. Faça login novamente.";
    case "not_found":
      return "Site não encontrado.";
    case "invalid_status":
      return "O site não está em um estado que permita esta ação.";
    case "db_error":
      return "Erro ao salvar a alteração. Tente novamente.";
    default:
      return error.message ?? "Erro desconhecido.";
  }
}

/**
 * Mapeia o `error` da Server Action `sendLeadSiteWhatsApp` (#171) pra
 * mensagem PT-BR — `whatsapp_error` reaproveita a mensagem da Server Action,
 * que já vem mapeada do `reason` do helper `sendWhatsAppMessage`.
 */
function sendActionErrorMessage(
  error: SendLeadSiteWhatsAppResult & { ok: false },
): string {
  switch (error.error) {
    case "auth":
      return "Sessão expirada. Faça login novamente.";
    case "not_found":
      return "Site não encontrado.";
    case "invalid_status":
      return "O site não está em um estado que permita o envio.";
    case "whatsapp_error":
      return error.message ?? "Falha ao enviar via WhatsApp.";
    case "db_error":
      return "Mensagem enviada, mas falha ao registrar. Tente reenviar.";
    default:
      return "Erro desconhecido.";
  }
}

export function LeadSiteCardActions({
  leadSite,
  leadId,
  appUrl,
}: LeadSiteCardActionsProps) {
  const router = useRouter();
  const [isGenerating, startGenerateTransition] = useTransition();
  const [isArchiving, startArchiveTransition] = useTransition();
  const [isRestoring, startRestoreTransition] = useTransition();
  const [isSending, startSendTransition] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const status: LeadSiteStatus | "none" = leadSite?.status ?? "none";

  // ---------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------
  function handleGenerate() {
    startGenerateTransition(async () => {
      try {
        const result = await generateLeadSite(leadId);
        if (result.ok) {
          toast.success("Site gerado!", {
            description: "A pré-visualização já está disponível.",
          });
          router.refresh();
        } else {
          toast.error("Não foi possível gerar o site", {
            description: generateErrorMessage(result),
          });
        }
      } catch {
        toast.error("Não foi possível gerar o site", {
          description: "Erro inesperado. Tente novamente.",
        });
      }
    });
  }

  function handleArchive() {
    if (!leadSite) return;
    startArchiveTransition(async () => {
      try {
        const result = await archiveLeadSite(leadSite.id);
        if (result.ok) {
          toast.success("Site arquivado", {
            description: "Você pode restaurá-lo quando quiser.",
          });
          setArchiveDialogOpen(false);
          router.refresh();
        } else {
          toast.error("Não foi possível arquivar o site", {
            description: statusActionErrorMessage(result),
          });
        }
      } catch {
        toast.error("Não foi possível arquivar o site", {
          description: "Erro inesperado. Tente novamente.",
        });
      }
    });
  }

  function handleRestore() {
    if (!leadSite) return;
    startRestoreTransition(async () => {
      try {
        const result = await restoreLeadSite(leadSite.id);
        if (result.ok) {
          toast.success("Site restaurado!", {
            description: "O site voltou ao estado publicado.",
          });
          router.refresh();
        } else {
          toast.error("Não foi possível restaurar o site", {
            description: statusActionErrorMessage(result),
          });
        }
      } catch {
        toast.error("Não foi possível restaurar o site", {
          description: "Erro inesperado. Tente novamente.",
        });
      }
    });
  }

  function handleSend() {
    if (!leadSite) return;
    startSendTransition(async () => {
      try {
        const result = await sendLeadSiteWhatsApp(leadSite.id);
        if (result.ok) {
          toast.success("Site enviado!", {
            description: "A mensagem foi disparada via WhatsApp.",
          });
          router.refresh();
        } else {
          toast.error("Não foi possível enviar o site", {
            description: sendActionErrorMessage(result),
          });
        }
      } catch {
        toast.error("Não foi possível enviar o site", {
          description: "Erro inesperado. Tente novamente.",
        });
      }
    });
  }

  async function handleCopyUrl(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("URL copiada!");
    } catch {
      toast.error("Não foi possível copiar a URL", {
        description: "Copie manualmente da barra de endereços.",
      });
    }
  }

  // ---------------------------------------------------------------
  // Render por estado
  // ---------------------------------------------------------------

  // Estado `none` — sem site OU draft (status='draft' indica geração que
  // falhou e está em retry/reset).
  if (status === "none" || status === "draft") {
    return (
      <Button
        type="button"
        onClick={handleGenerate}
        disabled={isGenerating}
        aria-busy={isGenerating}
        data-testid="lead-site-generate-button"
      >
        {isGenerating ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Gerando…
          </>
        ) : (
          <>
            <Sparkles className="size-4" aria-hidden="true" />
            Gerar site agora
          </>
        )}
      </Button>
    );
  }

  // Estado `archived` — botão Restaurar ativo (#169)
  if (status === "archived") {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleRestore}
        disabled={isRestoring}
        aria-busy={isRestoring}
        data-testid="lead-site-restore-button"
      >
        {isRestoring ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Restaurando…
          </>
        ) : (
          <>
            <ArchiveRestore className="size-4" aria-hidden="true" />
            Restaurar
          </>
        )}
      </Button>
    );
  }

  // Estados `published` / `sent`
  const slug = leadSite?.slug ?? "";
  const url = `${appUrl}/sites/${slug}`;

  return (
    <TooltipProvider>
      <div
        className="flex flex-wrap items-center gap-2"
        data-testid="lead-site-actions-cluster"
      >
        <Button asChild type="button" size="sm">
          <Link href={url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="size-4" aria-hidden="true" />
            Pré-visualizar
          </Link>
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => handleCopyUrl(url)}
          aria-label="Copiar URL do site"
          data-testid="lead-site-copy-button"
        >
          <Copy className="size-4" aria-hidden="true" />
          Copiar
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setEditOpen(true)}
          data-testid="lead-site-edit-button"
        >
          <Pencil className="size-4" aria-hidden="true" />
          Editar
        </Button>

        {leadSite ? (
          <LeadSiteEditModal
            leadSite={leadSite}
            open={editOpen}
            onOpenChange={(next) => {
              setEditOpen(next);
              if (!next) {
                // Após fechar (incluindo após salvar), refresh do card
                // pra puxar variáveis novas do Server Component pai.
                router.refresh();
              }
            }}
          />
        ) : null}

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleGenerate}
          disabled={isGenerating}
          aria-busy={isGenerating}
          data-testid="lead-site-regen-button"
        >
          {isGenerating ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Regerando…
            </>
          ) : (
            <>
              <RotateCcw className="size-4" aria-hidden="true" />
              Regerar
            </>
          )}
        </Button>

        <ArchiveConfirmDialog
          open={archiveDialogOpen}
          onOpenChange={setArchiveDialogOpen}
          isArchiving={isArchiving}
          onConfirm={handleArchive}
        >
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="lead-site-archive-button"
          >
            <ArchiveX className="size-4" aria-hidden="true" />
            Arquivar
          </Button>
        </ArchiveConfirmDialog>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleSend}
          disabled={isSending}
          aria-busy={isSending}
          data-testid="lead-site-whatsapp-button"
        >
          {isSending ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Enviando…
            </>
          ) : (
            <>
              <Send className="size-4" aria-hidden="true" />
              Enviar via WhatsApp
            </>
          )}
        </Button>
      </div>
    </TooltipProvider>
  );
}

// ---------------------------------------------------------------------------
// Confirm dialog destrutivo (Arquivar)
// ---------------------------------------------------------------------------

interface ArchiveConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isArchiving: boolean;
  onConfirm: () => void;
  children: React.ReactNode;
}

/**
 * `<AlertDialog>` (Radix) com `role="alertdialog"` implícito, focus trap,
 * ESC pra cancelar e backdrop pra fechar. Acessibilidade vetada por
 * jest-axe nos testes.
 *
 * Estilo é minimal e segue o padrão Apple SK do app (alabaster card,
 * border sutil, foco azul). Não usamos `<Dialog>` porque AlertDialog
 * tem semântica de confirmação destrutiva específica (browser leitor de
 * tela anuncia diferente).
 */
function ArchiveConfirmDialog({
  open,
  onOpenChange,
  isArchiving,
  onConfirm,
  children,
}: ArchiveConfirmDialogProps) {
  return (
    <AlertDialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialogPrimitive.Trigger asChild>
        {children}
      </AlertDialogPrimitive.Trigger>
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-black/40",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
          )}
        />
        <AlertDialogPrimitive.Content
          data-testid="lead-site-archive-dialog"
          className={cn(
            "fixed top-1/2 left-1/2 z-50 w-[min(28rem,calc(100vw-2rem))]",
            "-translate-x-1/2 -translate-y-1/2",
            "bg-card text-card-foreground",
            "border border-border rounded-xl shadow-lg",
            "p-6",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          )}
        >
          <AlertDialogPrimitive.Title className="text-lg font-semibold leading-none">
            Arquivar este site?
          </AlertDialogPrimitive.Title>
          <AlertDialogPrimitive.Description className="text-muted-foreground mt-2 text-sm">
            O site ficará indisponível na ficha do lead, mas você pode
            restaurá-lo a qualquer momento.
          </AlertDialogPrimitive.Description>
          <div className="mt-6 flex justify-end gap-2">
            <AlertDialogPrimitive.Cancel asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isArchiving}
                data-testid="lead-site-archive-cancel"
              >
                Cancelar
              </Button>
            </AlertDialogPrimitive.Cancel>
            <Button
              type="button"
              size="sm"
              onClick={(e) => {
                // Não fechamos via Action — o handler controla via
                // setArchiveDialogOpen(false) após sucesso. Isso permite
                // mostrar o spinner durante a transition.
                e.preventDefault();
                onConfirm();
              }}
              disabled={isArchiving}
              aria-busy={isArchiving}
              data-testid="lead-site-archive-confirm"
            >
              {isArchiving ? (
                <>
                  <Loader2
                    className="size-4 animate-spin"
                    aria-hidden="true"
                  />
                  Arquivando…
                </>
              ) : (
                "Arquivar"
              )}
            </Button>
          </div>
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  );
}
