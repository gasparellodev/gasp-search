"use client";

/**
 * Cluster de botões interativos do `<LeadSiteCard />` (issue #167).
 *
 * Server boundary: o `<LeadSiteCard />` (Server Component) busca o
 * `lead_sites` row via Supabase com RLS e passa os dados serializáveis
 * pra cá. **Toda lógica de cliente** (clipboard, useTransition, toast)
 * vive aqui.
 *
 * **Decisão V1 (refinamento PO 11):** Botões "Editar" (#168), "Regerar"
 * (#169), "Arquivar" / "Restaurar" (#169) e "Enviar via WhatsApp" (#171)
 * são renderizados como **disabled** com tooltip indicando a issue de
 * origem. Quando essas issues mergearem, basta remover o `disabled` +
 * fiar o handler real no lugar.
 */

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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

import { generateLeadSite } from "@/app/actions/lead-site";
import type { GenerateLeadSiteResult } from "@/app/actions/lead-site";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
 * Mapeia o `error` discriminated da Server Action pra mensagem amigável
 * em PT-BR (CLAUDE.md §convenções: "PT-BR em mensagens ao usuário").
 */
function errorMessage(error: GenerateLeadSiteResult & { ok: false }): string {
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

export function LeadSiteCardActions({
  leadSite,
  leadId,
  appUrl,
}: LeadSiteCardActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const status: LeadSiteStatus | "none" = leadSite?.status ?? "none";

  // ---------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------
  function handleGenerate() {
    startTransition(async () => {
      try {
        const result = await generateLeadSite(leadId);
        if (result.ok) {
          toast.success("Site gerado!", {
            description: "A pré-visualização já está disponível.",
          });
          router.refresh();
        } else {
          toast.error("Não foi possível gerar o site", {
            description: errorMessage(result),
          });
        }
      } catch {
        toast.error("Não foi possível gerar o site", {
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
        disabled={isPending}
        aria-busy={isPending}
        data-testid="lead-site-generate-button"
      >
        {isPending ? (
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

  // Estado `archived`
  if (status === "archived") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled
                aria-disabled="true"
                data-testid="lead-site-restore-button"
              >
                <ArchiveRestore className="size-4" aria-hidden="true" />
                Restaurar
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>Disponível em #169</TooltipContent>
        </Tooltip>
      </TooltipProvider>
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

        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled
                aria-disabled="true"
                data-testid="lead-site-edit-button"
              >
                <Pencil className="size-4" aria-hidden="true" />
                Editar
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>Disponível em #168</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled
                aria-disabled="true"
                data-testid="lead-site-regen-button"
              >
                <RotateCcw className="size-4" aria-hidden="true" />
                Regerar
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>Disponível em #169</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled
                aria-disabled="true"
                data-testid="lead-site-archive-button"
              >
                <ArchiveX className="size-4" aria-hidden="true" />
                Arquivar
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>Disponível em #169</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled
                aria-disabled="true"
                data-testid="lead-site-whatsapp-button"
              >
                <Send className="size-4" aria-hidden="true" />
                Enviar via WhatsApp
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>Disponível em #171</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
