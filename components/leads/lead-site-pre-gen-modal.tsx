"use client";

/**
 * `<LeadSitePreGenModal />` — Modal de validação que aparece ANTES do
 * operador disparar `generateLeadSite(leadId)` (sprint A1 onsite flow).
 *
 * Motivação: hoje o botão "Gerar site agora" abre um pipeline de ~45s
 * que custa Anthropic call + (eventualmente) OpenAI Images. Se o lead
 * está faltando `name` ou `phone` (mínimo viável para WhatsApp), o site
 * é gerado mas vai sair quebrado — operador percebe só na demo. Este
 * modal mostra o que vai entrar no pipeline com badges ✓/⚠ e bloqueia
 * o submit quando faltam campos críticos.
 *
 * **Bloqueia** geração quando: `name` vazio OU `phone` vazio (defesa
 *   pra demo onsite — sem telefone, WhatsApp CTA quebra).
 * **Avisa** mas permite quando: `email`, `address` (city/state),
 *   `instagram_handle`, `website` vazios — operador decide se aceita
 *   site sem aqueles dados.
 *
 * Componente puro: receber `onConfirm` (parent dispara a action) +
 * `lead` (subset de campos). Sem dependência de Server Action aqui.
 */

import { AlertTriangle, CheckCircle2, Sparkles, X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Subset do lead que o modal exibe + valida. Mantemos plano — sem
 * arrastar `Database['public']['Tables']['leads']['Row']` (Server-only
 * type leaks tipos do Supabase pro Client). Caller passa cópia
 * superficial.
 */
export interface PreGenLeadSummary {
  name: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  instagram_handle: string | null;
  city: string | null;
  state: string | null;
}

interface LeadSitePreGenModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: PreGenLeadSummary;
  /** Disparado quando operador confirma. Parent inicia o pipeline. */
  onConfirm: () => void;
  /** True enquanto a Server Action está em flight — desabilita o CTA
   *  pra evitar double-submit. */
  isGenerating: boolean;
}

/**
 * Decide se um campo opcional tem valor utilizável (não-vazio depois
 * de trim). String vazia/`null`/só espaços → considerado ausente.
 */
function hasValue(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

interface FieldRow {
  label: string;
  value: string | null;
  /** Campo crítico bloqueia geração se vazio. Caso contrário, só
   *  avisa visualmente. */
  critical: boolean;
}

function FieldBadge({ ok, critical }: { ok: boolean; critical: boolean }) {
  if (ok) {
    return (
      <span
        className="inline-flex items-center gap-1 text-emerald-600 text-xs font-medium"
        data-testid="pre-gen-field-ok"
      >
        <CheckCircle2 className="size-3.5" aria-hidden="true" />
        Preenchido
      </span>
    );
  }
  if (critical) {
    return (
      <span
        className="inline-flex items-center gap-1 text-destructive text-xs font-medium"
        data-testid="pre-gen-field-missing-critical"
      >
        <AlertTriangle className="size-3.5" aria-hidden="true" />
        Obrigatório
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 text-amber-600 text-xs font-medium"
      data-testid="pre-gen-field-missing-optional"
    >
      <AlertTriangle className="size-3.5" aria-hidden="true" />
      Faltando
    </span>
  );
}

export function LeadSitePreGenModal({
  open,
  onOpenChange,
  lead,
  onConfirm,
  isGenerating,
}: LeadSitePreGenModalProps) {
  const rows: FieldRow[] = [
    { label: "Nome do negócio", value: lead.name, critical: true },
    { label: "Telefone", value: lead.phone, critical: true },
    { label: "E-mail", value: lead.email, critical: false },
    { label: "Website", value: lead.website, critical: false },
    {
      label: "Instagram",
      value: lead.instagram_handle ? `@${lead.instagram_handle}` : null,
      critical: false,
    },
    {
      label: "Localização",
      value:
        hasValue(lead.city) || hasValue(lead.state)
          ? [lead.city, lead.state].filter(Boolean).join(" / ")
          : null,
      critical: false,
    },
  ];

  const missingCritical = rows.some(
    (r) => r.critical && !hasValue(r.value),
  );
  const missingOptionalCount = rows.filter(
    (r) => !r.critical && !hasValue(r.value),
  ).length;

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
          data-testid="lead-site-pre-gen-modal"
          className={cn(
            "fixed top-1/2 left-1/2 z-50 w-[min(34rem,calc(100vw-2rem))]",
            "-translate-x-1/2 -translate-y-1/2",
            "bg-card text-card-foreground",
            "border border-border rounded-xl shadow-lg",
            "max-h-[calc(100vh-2rem)] overflow-y-auto",
            "p-6",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          )}
        >
          <DialogPrimitive.Title className="text-lg font-semibold leading-tight">
            Verificar dados antes de gerar
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="text-muted-foreground mt-1 text-sm">
            A IA usa estes campos pra montar o site. Confira antes de
            disparar a geração (~30-60s).
          </DialogPrimitive.Description>

          <DialogPrimitive.Close
            className="absolute top-3 right-3 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            aria-label="Fechar"
          >
            <X className="size-4" aria-hidden="true" />
          </DialogPrimitive.Close>

          <ul
            className="mt-5 space-y-2 text-sm"
            data-testid="pre-gen-field-list"
          >
            {rows.map((row) => {
              const ok = hasValue(row.value);
              return (
                <li
                  key={row.label}
                  className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
                  data-testid={`pre-gen-row-${row.label
                    .toLowerCase()
                    .normalize("NFD")
                    .replace(/[̀-ͯ]/g, "")
                    .replace(/\s+/g, "-")}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-muted-foreground text-xs uppercase tracking-wide">
                      {row.label}
                    </div>
                    <div className="truncate text-foreground">
                      {ok ? row.value : "—"}
                    </div>
                  </div>
                  <FieldBadge ok={ok} critical={row.critical} />
                </li>
              );
            })}
          </ul>

          {missingCritical ? (
            <p
              className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              role="alert"
              data-testid="pre-gen-blocker-message"
            >
              Faltam dados <strong>obrigatórios</strong> (nome e telefone)
              para gerar o site. Edite o lead e tente de novo.
            </p>
          ) : missingOptionalCount > 0 ? (
            <p
              className="mt-4 rounded-md border border-amber-300/40 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-700/40 dark:bg-amber-950/40 dark:text-amber-200"
              data-testid="pre-gen-warning-message"
            >
              {missingOptionalCount === 1
                ? "1 campo opcional está faltando."
                : `${missingOptionalCount} campos opcionais estão faltando.`}{" "}
              O site é gerado mesmo assim, mas pode ficar com seções vazias.
            </p>
          ) : null}

          <div className="mt-6 flex justify-end gap-2">
            <DialogPrimitive.Close asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isGenerating}
                data-testid="lead-site-pre-gen-cancel"
              >
                Cancelar
              </Button>
            </DialogPrimitive.Close>
            <Button
              type="button"
              size="sm"
              onClick={onConfirm}
              disabled={missingCritical || isGenerating}
              aria-busy={isGenerating}
              data-testid="lead-site-pre-gen-confirm"
            >
              <Sparkles className="size-4" aria-hidden="true" />
              Gerar site
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
