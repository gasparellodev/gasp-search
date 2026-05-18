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
 *  - #217 — "Regenerar identidade visual" botão + `<AlertDialog>`
 *           destrutivo (~R$ 2,45, ~9 imagens, até 90s) chamando
 *           `regenerateVisualIdentity({force:true})` (#216). Visível só
 *           em status `'published'`/`'sent'`. Toast por error code
 *           (7 codes: auth/not_found/cost_guardrail/validation/
 *           generation_error/storage_error/db_error) com mensagens PT-BR.
 *           `router.refresh()` após sucesso (manifest novo entra no
 *           próximo render do Server Component pai).
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
  ImageIcon,
  Loader2,
  Pencil,
  RotateCcw,
  Send,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import {
  archiveLeadSite,
  discardLeadSiteDraft,
  generateLeadSite,
  regenerateVisualIdentity,
  restoreLeadSite,
  sendLeadSiteWhatsApp,
} from "@/app/actions/lead-site";
import type {
  DiscardLeadSiteDraftResult,
  GenerateLeadSiteResult,
  LeadSiteStatusActionResult,
  RegenerateVisualIdentityResult,
  SendLeadSiteWhatsAppResult,
} from "@/app/actions/lead-site";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { formatBRL } from "@/lib/finance";
import { cn } from "@/lib/utils";

import { LeadSiteEditModal } from "./LeadSiteEditModal";
import {
  LeadSitePreGenModal,
  type PreGenLeadSummary,
} from "./lead-site-pre-gen-modal";
import { SiteGenerationProgress } from "./site-generation-progress";
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
  /**
   * Sprint A1 — subset dos campos do lead que abastecem o modal de
   * validação pré-geração. **Opcional**: quando ausente (ex: surface
   * `<LeadSiteCardClient />` no drawer que ainda não foi atualizado),
   * o fluxo cai pro comportamento anterior (geração direta sem modal).
   * Quando presente, clicar "Gerar site agora" abre o modal e só dispara
   * a action após confirmação.
   */
  leadSummary?: PreGenLeadSummary | null;
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

/**
 * Mapeia o `error` da Server Action `regenerateVisualIdentity` (#216) pra
 * mensagem PT-BR — 7 códigos cobertos (issue #217).
 *
 * Decisões de mensagem (PO refinement #217):
 *  - `auth`: "Sessão expirada. Faça login novamente." (padrão da casa).
 *  - `not_found`: "Site não encontrado." (RLS bloqueou ou ID inexistente).
 *  - `cost_guardrail`: cita "$2 USD" — caller que clicou esperava ~R$ 2,45;
 *    se passou de $2 USD algo está errado (provavelmente muitos cars).
 *  - `validation`: contexto (Zod issue) é PII-safe mas opaco pro user;
 *    mensagem amigável + sugere retry.
 *  - `generation_error`: rate-limit OpenAI / moderation persistente; orienta
 *    aguardar 1 min (mesma cadência de #216 retry semantics).
 *  - `storage_error`: Supabase Storage falhou; retry simples.
 *  - `db_error`: UPDATE falhou pós-geração; manifest novo perdido mas as
 *    imagens ficaram no Storage — orienta retry (idempotência com `force:true`
 *    vai sobrescrever de novo).
 */
/**
 * Mapeia o `error` da Server Action `discardLeadSiteDraft` (sprint A3) pra
 * mensagem PT-BR. `invalid_status` é defesa em profundidade — UI só
 * mostra o botão "Descartar rascunho" quando há `generation_error`, mas
 * race conditions (outro tab publicou) podem disparar.
 */
function discardErrorMessage(
  error: DiscardLeadSiteDraftResult & { ok: false },
): string {
  switch (error.error) {
    case "auth":
      return "Sessão expirada. Faça login novamente.";
    case "not_found":
      return "Rascunho não encontrado.";
    case "invalid_status":
      return "Este site não pode mais ser descartado (talvez já tenha sido publicado em outra aba).";
    case "db_error":
      return "Falha ao descartar. Tente novamente.";
    default:
      return error.message ?? "Erro desconhecido ao descartar o rascunho.";
  }
}

function regenerateErrorMessage(
  error: RegenerateVisualIdentityResult & { ok: false },
): string {
  switch (error.error) {
    case "auth":
      return "Sessão expirada. Faça login novamente.";
    case "not_found":
      return "Site não encontrado.";
    case "cost_guardrail":
      return "Custo estimado excede o limite de US$ 2 por geração. Contate o suporte.";
    case "validation":
      return "Erro de validação interna no manifest gerado. Tente novamente.";
    case "generation_error":
      return "Falha ao gerar imagens (rate limit OpenAI ou moderação). Tente novamente em 1 minuto.";
    case "storage_error":
      return "Falha ao salvar as imagens no Storage. Tente novamente.";
    case "db_error":
      return "Imagens geradas mas falha ao persistir. Tente novamente.";
    default:
      return "Erro desconhecido ao regenerar a identidade visual.";
  }
}

export function LeadSiteCardActions({
  leadSite,
  leadId,
  appUrl,
  leadSummary,
}: LeadSiteCardActionsProps) {
  const router = useRouter();
  const [isGenerating, startGenerateTransition] = useTransition();
  const [isArchiving, startArchiveTransition] = useTransition();
  const [isRestoring, startRestoreTransition] = useTransition();
  const [isSending, startSendTransition] = useTransition();
  const [isRegeneratingIdentity, startRegenerateIdentityTransition] =
    useTransition();
  const [isDiscarding, startDiscardTransition] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [regenerateIdentityDialogOpen, setRegenerateIdentityDialogOpen] =
    useState(false);
  const [preGenOpen, setPreGenOpen] = useState(false);
  const status: LeadSiteStatus | "none" = leadSite?.status ?? "none";
  // Sprint A4: detecta draft com erro persistido — habilita botão
  // "Descartar rascunho" + label de retry "Tentar de novo".
  const hasGenerationError =
    status === "draft" && (leadSite?.generation_error ?? null) !== null;

  // ---------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------

  /**
   * Sprint A1: dispara a Server Action `generateLeadSite`. Mantém a
   * mesma semântica de toast/refresh que existia desde #167. O modal
   * de validação chama esta função após o operador confirmar.
   */
  function executeGenerate() {
    startGenerateTransition(async () => {
      try {
        const result = await generateLeadSite(leadId);
        if (result.ok) {
          toast.success("Site gerado!", {
            description: "A pré-visualização já está disponível.",
          });
          setPreGenOpen(false);
          router.refresh();
        } else {
          toast.error("Não foi possível gerar o site", {
            description: generateErrorMessage(result),
          });
          // Mantém o modal aberto em erro pra operador ajustar e
          // retentar sem perder o contexto. O toast já comunicou.
        }
      } catch {
        toast.error("Não foi possível gerar o site", {
          description: "Erro inesperado. Tente novamente.",
        });
      }
    });
  }

  /**
   * Click handler do botão "Gerar site agora". Quando `leadSummary`
   * está presente (page flow), abre o modal de validação primeiro.
   * Caso contrário (drawer flow, retry no estado draft+error), dispara
   * direto pra preservar o comportamento anterior.
   */
  function handleGenerate() {
    if (leadSummary && !hasGenerationError) {
      setPreGenOpen(true);
      return;
    }
    executeGenerate();
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

  function handleRegenerateIdentity() {
    if (!leadSite) return;
    startRegenerateIdentityTransition(async () => {
      try {
        // `force: true` — UI admin assume intenção "quero regerar mesmo
        // se já existe manifest válido" (cobra ~R$ 2,45 cada).
        const result = await regenerateVisualIdentity(leadSite.id, {
          force: true,
        });
        if (result.ok) {
          // Custo real do manifest novo. `cost_estimate_brl` é
          // calculado server-side em `estimateTotalCost(specs).brl`
          // (env.BRL_RATE × USD), então o usuário sempre vê o número
          // exato, não a estimativa de UI (~R$ 2,45).
          const formattedCost = formatBRL(result.manifest.cost_estimate_brl, {
            fractionDigits: 2,
          });
          toast.success("Identidade visual regenerada", {
            description: `Custo desta geração: ${formattedCost}.`,
          });
          setRegenerateIdentityDialogOpen(false);
          // Server Component pai (`<LeadSiteCard />`) re-busca via
          // `getSite()` → manifest novo flui pros 3 sections + OG image.
          router.refresh();
        } else {
          toast.error("Não foi possível regenerar a identidade visual", {
            description: regenerateErrorMessage(result),
          });
        }
      } catch {
        toast.error("Não foi possível regenerar a identidade visual", {
          description: "Erro inesperado. Tente novamente.",
        });
      }
    });
  }

  function handleDiscard() {
    if (!leadSite) return;
    startDiscardTransition(async () => {
      try {
        const result = await discardLeadSiteDraft(leadSite.id);
        if (result.ok) {
          toast.success("Rascunho descartado", {
            description: "Tudo limpo. Você pode gerar o site de novo.",
          });
          router.refresh();
        } else {
          toast.error("Não foi possível descartar o rascunho", {
            description: discardErrorMessage(result),
          });
        }
      } catch {
        toast.error("Não foi possível descartar o rascunho", {
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

  // Estado `none` — sem site, OU `draft` em progresso (sem erro).
  // Sprint A4: quando há `generation_error`, expomos um cluster com
  // "Tentar de novo" + "Descartar rascunho" pra dar saída ao operador.
  if (status === "none" || status === "draft") {
    if (hasGenerationError && leadSite) {
      const busy = isGenerating || isDiscarding;
      return (
        <div data-testid="lead-site-draft-error-wrapper">
          <div
            className="flex flex-wrap items-center gap-2"
            data-testid="lead-site-draft-error-cluster"
          >
            <Button
              type="button"
              onClick={handleGenerate}
              disabled={busy}
              aria-busy={isGenerating}
              data-testid="lead-site-retry-button"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Tentando de novo…
                </>
              ) : (
                <>
                  <RotateCcw className="size-4" aria-hidden="true" />
                  Tentar de novo
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDiscard}
              disabled={busy}
              aria-busy={isDiscarding}
              data-testid="lead-site-discard-button"
            >
              {isDiscarding ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Descartando…
                </>
              ) : (
                <>
                  <Trash2 className="size-4" aria-hidden="true" />
                  Descartar rascunho
                </>
              )}
            </Button>
          </div>
          {/* key={isGenerating ? "active" : "idle"} força remount entre
           *  execuções pra resetar o contador de estágios cosméticos. */}
          <SiteGenerationProgress
            key={isGenerating ? "active" : "idle"}
            active={isGenerating}
          />
        </div>
      );
    }

    return (
      <div data-testid="lead-site-generate-wrapper">
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
        <SiteGenerationProgress active={isGenerating} />
        {leadSummary ? (
          <LeadSitePreGenModal
            open={preGenOpen}
            onOpenChange={(next) => {
              // Não fecha enquanto a action está em flight — operador
              // deve esperar o resultado pra evitar perda de contexto.
              if (!next && isGenerating) return;
              setPreGenOpen(next);
            }}
            lead={leadSummary}
            onConfirm={executeGenerate}
            isGenerating={isGenerating}
          />
        ) : null}
      </div>
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

        <RegenerateIdentityConfirmDialog
          open={regenerateIdentityDialogOpen}
          onOpenChange={setRegenerateIdentityDialogOpen}
          isRegenerating={isRegeneratingIdentity}
          onConfirm={handleRegenerateIdentity}
        >
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isRegeneratingIdentity}
            aria-busy={isRegeneratingIdentity}
            data-testid="lead-site-regen-identity-button"
          >
            {isRegeneratingIdentity ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Gerando imagens (até 90s)…
              </>
            ) : (
              <>
                <ImageIcon className="size-4" aria-hidden="true" />
                Regenerar identidade visual
              </>
            )}
          </Button>
        </RegenerateIdentityConfirmDialog>
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

// ---------------------------------------------------------------------------
// Confirm dialog destrutivo (Regenerar identidade visual) — issue #217
// ---------------------------------------------------------------------------

interface RegenerateIdentityConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isRegenerating: boolean;
  onConfirm: () => void;
  children: React.ReactNode;
}

/**
 * `<AlertDialog>` (Radix) destrutivo que confirma a regeneração de
 * identidade visual AI (#216, ~R$ 2,45/run, 9 imagens, até 90s).
 *
 * **Default focus em Cancelar** — Radix AlertDialog auto-focusa o
 * primeiro `Cancel` por convenção (per spec axe). "Confirmar regeneração"
 * fica em `variant="default"` mas o caller pode trocar pra destructive
 * se preferir; mantemos default pra alinhar com Archive (consistência
 * visual no card).
 *
 * Estilo segue o padrão Apple SK do app (alabaster card, border sutil).
 * Acessibilidade vetada por jest-axe nos testes.
 */
function RegenerateIdentityConfirmDialog({
  open,
  onOpenChange,
  isRegenerating,
  onConfirm,
  children,
}: RegenerateIdentityConfirmDialogProps) {
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
          data-testid="lead-site-regen-identity-dialog"
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
            Regenerar identidade visual
          </AlertDialogPrimitive.Title>
          <AlertDialogPrimitive.Description className="text-muted-foreground mt-2 text-sm">
            Isso vai gerar 9 imagens com IA custando aproximadamente
            R$ 2,45. As imagens atuais serão substituídas.
          </AlertDialogPrimitive.Description>
          <p
            className="text-muted-foreground mt-2 text-xs"
            data-testid="lead-site-regen-identity-duration"
          >
            ⏱ Pode levar até 90 segundos.
          </p>
          <div className="mt-6 flex justify-end gap-2">
            <AlertDialogPrimitive.Cancel asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isRegenerating}
                data-testid="lead-site-regen-identity-cancel"
              >
                Cancelar
              </Button>
            </AlertDialogPrimitive.Cancel>
            <Button
              type="button"
              size="sm"
              onClick={(e) => {
                // Mesma estratégia do Archive: handler controla
                // `setRegenerateIdentityDialogOpen(false)` após sucesso
                // pra mostrar o spinner durante a transition.
                e.preventDefault();
                onConfirm();
              }}
              disabled={isRegenerating}
              aria-busy={isRegenerating}
              data-testid="lead-site-regen-identity-confirm"
            >
              {isRegenerating ? (
                <>
                  <Loader2
                    className="size-4 animate-spin"
                    aria-hidden="true"
                  />
                  Gerando imagens (até 90s)…
                </>
              ) : (
                "Confirmar regeneração"
              )}
            </Button>
          </div>
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  );
}
