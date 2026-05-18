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

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Sparkles, X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CUSTOM_SLUG_LIMITS,
  suggestSlugFromName,
  validateCustomSlug,
} from "@/lib/sites/slug";
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
  /**
   * Sprint B1 — slug customizado escolhido pelo operador. Parent
   * recebe o `customSlug` aqui e o passa pra `generateLeadSite`.
   * Quando string vazia, o pipeline cai pro auto-gen `<nanoid8>-<base>`.
   */
  onConfirm: (input: { customSlug: string }) => void;
  /** True enquanto a Server Action está em flight — desabilita o CTA
   *  pra evitar double-submit. */
  isGenerating: boolean;
  /**
   * Base pública pra preview da URL (`${appBaseUrl}/sites/<slug>`).
   * Mantém o operador ciente do que vai ser publicado.
   */
  appBaseUrl: string;
  /**
   * Erro de slug retornado pela Server Action (`slug_invalid` /
   * `slug_taken`). Quando presente, o modal mostra inline + bloqueia
   * o CTA até o operador editar o campo. Reset quando o slug muda.
   */
  serverSlugError?: string | null;
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
  appBaseUrl,
  serverSlugError,
}: LeadSitePreGenModalProps) {
  // Sugestão inicial derivada do business_name. Lida só no mount —
  // se o operador mudar de lead, o parent (`<LeadSiteCardActions>`) é
  // remontado e a sugestão volta a respeitar o novo nome. Evita
  // `setState` em effect (react-hooks/set-state-in-effect).
  const suggestedSlug = useMemo(
    () => suggestSlugFromName(lead.name),
    [lead.name],
  );
  const [slugInput, setSlugInput] = useState<string>(suggestedSlug);

  const localValidation = useMemo(
    () => validateCustomSlug(slugInput),
    [slugInput],
  );
  // Snapshot do slug submetido na última tentativa. Quando o operador
  // edita o input, a comparação falha e o `serverSlugError` é escondido
  // automaticamente — sem setState dentro de useEffect.
  const [submittedSlug, setSubmittedSlug] = useState<string | null>(null);

  const showServerError =
    serverSlugError !== null &&
    submittedSlug !== null &&
    submittedSlug === localValidation.normalized;

  const slugErrorMessage =
    !localValidation.ok && localValidation.message
      ? localValidation.message
      : showServerError
        ? serverSlugError
        : null;

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

  const submitDisabled =
    missingCritical || !localValidation.ok || isGenerating || !!slugErrorMessage;

  const baseUrlClean = appBaseUrl.replace(/\/$/, "");
  const previewUrl = `${baseUrlClean}/sites/${localValidation.normalized || slugInput.trim().toLowerCase() || "—"}`;

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

          <div className="mt-5" data-testid="pre-gen-slug-section">
            <Label htmlFor="pre-gen-slug-input" className="text-sm">
              URL do site
            </Label>
            <div className="mt-1 flex flex-wrap items-center gap-1 text-muted-foreground text-xs">
              <span>{baseUrlClean}/sites/</span>
              <Input
                id="pre-gen-slug-input"
                type="text"
                inputMode="text"
                autoComplete="off"
                spellCheck={false}
                value={slugInput}
                onChange={(e) => {
                  setSlugInput(e.target.value);
                }}
                aria-invalid={!!slugErrorMessage}
                aria-describedby={
                  slugErrorMessage ? "pre-gen-slug-error" : undefined
                }
                maxLength={CUSTOM_SLUG_LIMITS.max + 4}
                className="font-mono text-sm"
                data-testid="pre-gen-slug-input"
              />
            </div>
            <p className="text-muted-foreground mt-1 text-xs">
              {slugErrorMessage ? (
                <span
                  className="text-destructive font-medium"
                  id="pre-gen-slug-error"
                  data-testid="pre-gen-slug-error"
                >
                  {slugErrorMessage}
                </span>
              ) : (
                <>
                  Preview:{" "}
                  <span
                    className="font-mono"
                    data-testid="pre-gen-slug-preview"
                  >
                    {previewUrl}
                  </span>
                </>
              )}
            </p>
          </div>

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
              onClick={() => {
                setSubmittedSlug(localValidation.normalized);
                onConfirm({ customSlug: localValidation.normalized });
              }}
              disabled={submitDisabled}
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
