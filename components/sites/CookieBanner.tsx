"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";

import { recordConsentDecision } from "@/app/actions/consent-audit";
import {
  CONSENT_CHANGE_EVENT,
  CONSENT_STORAGE_KEY,
  COOKIE_CONSENT_TEXT,
  buildConsentDecision,
  type ConsentAction,
  type ConsentCategories,
} from "@/lib/lgpd/consent-state";
import { useConsentDecision } from "@/lib/hooks/use-consent";

type ToggleCategories = Omit<ConsentCategories, "necessary">;

export function CookieBanner() {
  const decision = useConsentDecision();
  const [customOpen, setCustomOpen] = useState(false);
  const [draft, setDraft] = useState<ToggleCategories>({
    analytics: false,
    marketing: false,
  });

  if (decision) return null;

  const persistDecision = (
    action: ConsentAction,
    categories: ToggleCategories,
  ) => {
    const nextDecision = buildConsentDecision(action, categories);
    window.localStorage.setItem(
      CONSENT_STORAGE_KEY,
      JSON.stringify(nextDecision),
    );
    window.dispatchEvent(new Event(CONSENT_CHANGE_EVENT));
    void recordConsentDecision({
      version: nextDecision.version,
      action: nextDecision.action,
      categories: nextDecision.categories,
    });
  };

  return (
    <>
      <section
        data-testid="cookie-banner"
        role="region"
        aria-label="Preferências de cookies"
        className="fixed inset-x-3 bottom-3 z-[var(--z-cookie-banner,80)] rounded-[var(--auto-radius-md,8px)] border border-[var(--auto-border,#e5e5e5)] bg-[var(--auto-surface,#ffffff)] p-4 text-[var(--auto-foreground,#0a0a0a)] shadow-[var(--auto-shadow-2xl)] md:left-auto md:right-4 md:max-w-xl"
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <p className="as-body-sm flex-1">{COOKIE_CONSENT_TEXT}</p>
          <div className="flex flex-col gap-2 sm:flex-row md:shrink-0">
            <button
              type="button"
              onClick={() =>
                persistDecision("accept_all", {
                  analytics: true,
                  marketing: true,
                })
              }
              className="inline-flex h-10 items-center justify-center rounded-[var(--auto-radius-md,8px)] bg-[var(--auto-primary,#0a0a0a)] px-4 text-sm font-medium text-[var(--auto-on-primary,#fafafa)] transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--auto-focus-ring,#0a0a0a)]"
            >
              Aceitar todos
            </button>
            <button
              type="button"
              onClick={() => setCustomOpen(true)}
              className="inline-flex h-10 items-center justify-center rounded-[var(--auto-radius-md,8px)] border border-[var(--auto-border,#e5e5e5)] px-4 text-sm font-medium transition hover:bg-[var(--auto-muted,#f5f5f5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--auto-focus-ring,#0a0a0a)]"
            >
              Personalizar
            </button>
            <button
              type="button"
              onClick={() =>
                persistDecision("reject", {
                  analytics: false,
                  marketing: false,
                })
              }
              className="inline-flex h-10 items-center justify-center rounded-[var(--auto-radius-md,8px)] px-4 text-sm font-medium text-[var(--auto-muted-foreground,#737373)] transition hover:bg-[var(--auto-muted,#f5f5f5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--auto-focus-ring,#0a0a0a)]"
            >
              Apenas necessários
            </button>
          </div>
        </div>
      </section>

      <DialogPrimitive.Root open={customOpen} onOpenChange={setCustomOpen} modal>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-[var(--z-cookie-banner,80)] bg-black/40" />
          <DialogPrimitive.Content
            className="fixed left-1/2 top-1/2 z-[calc(var(--z-cookie-banner,80)+1)] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-[var(--auto-radius-md,8px)] border border-[var(--auto-border,#e5e5e5)] bg-[var(--auto-surface,#ffffff)] p-5 text-[var(--auto-foreground,#0a0a0a)] shadow-[var(--auto-shadow-2xl)] outline-none"
            aria-describedby={undefined}
          >
            <div className="flex items-start justify-between gap-4">
              <DialogPrimitive.Title className="as-h4">
                Preferências de privacidade
              </DialogPrimitive.Title>
              <DialogPrimitive.Close asChild>
                <button
                  type="button"
                  aria-label="Fechar preferências"
                  className="inline-flex size-9 items-center justify-center rounded-[var(--auto-radius-md,8px)] transition hover:bg-[var(--auto-muted,#f5f5f5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--auto-focus-ring,#0a0a0a)]"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </DialogPrimitive.Close>
            </div>

            <div className="mt-5 space-y-4">
              <ConsentCheckbox
                label="Necessários"
                description="Essenciais para segurança, navegação e envio de formulários."
                checked
                disabled
              />
              <ConsentCheckbox
                label="Analytics"
                description="Ajuda a entender visitas e conversões sem vender seus dados."
                checked={draft.analytics}
                onChange={(checked) =>
                  setDraft((current) => ({ ...current, analytics: checked }))
                }
              />
              <ConsentCheckbox
                label="Marketing"
                description="Permite medir campanhas e melhorar comunicações futuras."
                checked={draft.marketing}
                onChange={(checked) =>
                  setDraft((current) => ({ ...current, marketing: checked }))
                }
              />
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  persistDecision("accept_selected", draft);
                  setCustomOpen(false);
                }}
                className="inline-flex h-10 items-center justify-center rounded-[var(--auto-radius-md,8px)] bg-[var(--auto-primary,#0a0a0a)] px-4 text-sm font-medium text-[var(--auto-on-primary,#fafafa)] transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--auto-focus-ring,#0a0a0a)]"
              >
                Salvar escolhas
              </button>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}

interface ConsentCheckboxProps {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange?: (checked: boolean) => void;
}

function ConsentCheckbox({
  label,
  description,
  checked,
  disabled = false,
  onChange,
}: ConsentCheckboxProps) {
  return (
    <label className="flex items-start gap-3 rounded-[var(--auto-radius-md,8px)] border border-[var(--auto-border,#e5e5e5)] p-3">
      <input
        type="checkbox"
        aria-label={label}
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange?.(event.currentTarget.checked)}
        className="mt-1 size-4 rounded border-[var(--auto-border-strong,#a3a3a3)] accent-[var(--auto-primary,#0a0a0a)]"
      />
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="as-body-sm block text-[var(--auto-muted-foreground,#737373)]">
          {description}
        </span>
      </span>
    </label>
  );
}
