"use client";

import { useCallback, useEffect, useId, useState, useTransition } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { submitSiteForm } from "@/app/actions/site-form";
import { trackEvent } from "@/lib/analytics/track-event";
import { publicEnv } from "@/lib/env-public";
import {
  SiteFormSchema,
  type SiteFormInput,
} from "@/lib/sites/site-form.schema";
import { cn } from "@/lib/utils";

interface HomeContactFormQuickProps {
  /** ID do `lead_sites` row, propagado pra Server Action de submit. */
  siteId: string;
  /** Nome do negócio — usado na LGPD checkbox label. */
  businessName: string;
  /** Slug do site, usado no link da LGPD. */
  slug: string;
  /**
   * Tema visual do card:
   * - `'dark'` (default): `bg-foreground text-background` — âncora
   *   visual de conversão (decisão original #223).
   * - `'light'`: `bg-background text-foreground` — alinha com páginas
   *   majoritariamente claras (ex: `/sobre`, onde o salto cromático
   *   ficava dissonante com o restante do layout).
   */
  variant?: "dark" | "light";
}

/**
 * Tokens de tema do form. Cada variant tem seu próprio mapa
 * estático — Tailwind v4 scanner consegue extrair todas as classes
 * literais. Não concatenar dinamicamente.
 */
const FORM_THEMES = {
  dark: {
    section: "bg-foreground text-background",
    subtitle: "text-background/75",
    formContainer: "border-background/15 bg-background/[0.04]",
    inputBase:
      "bg-background/[0.06] text-background placeholder:text-background/45 focus-visible:ring-background/40",
    inputBorderDefault: "border-background/20",
    inputBorderError: "border-red-400/60",
    labelText: "text-background",
    helperText: "text-background/60",
    lgpdText: "text-background/75",
    lgpdCheckbox: "border-background/40 accent-background",
    errorText: "text-red-300",
    successText: "text-background/85",
    submitFocusRing: "focus-visible:ring-background/40",
  },
  light: {
    section: "bg-background text-foreground",
    subtitle: "text-foreground/70",
    formContainer: "border-foreground/10 bg-foreground/[0.03]",
    inputBase:
      "bg-background text-foreground placeholder:text-foreground/45 focus-visible:ring-foreground/40",
    inputBorderDefault: "border-foreground/15",
    inputBorderError: "border-red-600/60",
    labelText: "text-foreground",
    helperText: "text-foreground/60",
    lgpdText: "text-foreground/70",
    lgpdCheckbox: "border-foreground/40 accent-foreground",
    errorText: "text-red-600",
    successText: "text-foreground/85",
    submitFocusRing: "focus-visible:ring-foreground/40",
  },
} as const;

type FormTheme = (typeof FORM_THEMES)[keyof typeof FORM_THEMES];

/**
 * Contact form quick — captura principal conversão final da Home
 * (Phase 7 / Sprint 4 / #H3 — issue #223).
 *
 * **Visual:** `bg-foreground text-background` (dark card destacado,
 * exceção intencional do design system — ver `components/sites/CLAUDE.md`).
 *
 * **Anti-bot:**
 *  - Honeypot: `<input name="website">` escondido CSS (`position:
 *    absolute; left:-9999px`), `tabIndex={-1}`, `aria-hidden="true"`,
 *    `autocomplete="off"`. Bots costumam preencher; humanos não.
 *  - Min-time gate: hidden field `_rendered_at` capturado no
 *    `useEffect` de mount; submit < 2000ms é silenciosamente
 *    descartado server-side.
 *
 * **Feature flag:** componente só renderiza quando
 * `NEXT_PUBLIC_SITE_FORMS_ENABLED === '1'` (PR conditional — deploy
 * gradual). Caller (`<SitePage>`) também checa a flag, mas defesa em
 * profundidade aqui evita render acidental.
 *
 * **Schema:** reusa `SiteFormSchema` (#161) estendido com `message`
 * opt em #223. Form torna `message` *required* via UI mas o schema
 * mantém opcional pra compat (`min(10)` quando string presente).
 *
 * **A11y:** labels visíveis, `aria-describedby` em cada input ligando
 * ao alert de erro, focus management em primeiro input com erro pós-submit.
 */
export function HomeContactFormQuick({
  siteId,
  businessName,
  slug,
  variant = "dark",
}: HomeContactFormQuickProps) {
  // Feature flag — defesa em profundidade.
  if (publicEnv.NEXT_PUBLIC_SITE_FORMS_ENABLED !== "1") {
    return null;
  }

  return (
    <HomeContactFormQuickInner
      siteId={siteId}
      businessName={businessName}
      slug={slug}
      variant={variant}
    />
  );
}

function HomeContactFormQuickInner({
  siteId,
  businessName,
  slug,
  variant = "dark",
}: HomeContactFormQuickProps) {
  const theme = FORM_THEMES[variant];
  const [isPending, startTransition] = useTransition();
  const [submitted, setSubmitted] = useState(false);
  const [renderedAt, setRenderedAt] = useState<number | null>(null);
  const [honeypotValue, setHoneypotValue] = useState("");
  const formIdBase = useId();

  // Wave B2 (R-03): mount time capturado em state (não em ref) pra
  // satisfazer react-hooks/purity (React 19) — Date.now() é impura e
  // não pode rodar durante render. Capturamos no mount-effect pra
  // obter o tempo de hydration no cliente (quando o usuário REALMENTE
  // pode interagir), em vez do tempo de render server-side. Há uma
  // janela curta entre render e effect onde renderedAt=null; a defesa
  // está no server (`app/actions/site-form.ts`) — se renderedAt
  // ausente, submit é tratado como bot e tropa retorna early-success
  // sem persistir.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional mount-time capture
    setRenderedAt(Date.now());
  }, []);

  const {
    register,
    handleSubmit,
    reset,
    setFocus,
    formState: { errors, isSubmitted },
  } = useForm<SiteFormInput>({
    resolver: zodResolver(SiteFormSchema),
    defaultValues: {
      model: "Contato pela home",
      name: "",
      email: "",
      phone: "",
      message: "",
      lgpd: false as unknown as true,
    },
  });

  // Focus management: pós-submit com erro, foca o primeiro campo inválido.
  useEffect(() => {
    if (!isSubmitted) return;
    const order: (keyof SiteFormInput)[] = [
      "name",
      "phone",
      "email",
      "message",
      "lgpd",
    ];
    for (const field of order) {
      if (errors[field]) {
        // setFocus opera no `register`-ed input
        try {
          setFocus(field as Exclude<keyof SiteFormInput, "lgpd">);
        } catch {
          // lgpd é checkbox — silent
        }
        break;
      }
    }
  }, [isSubmitted, errors, setFocus]);

  const submitWithExtras = useCallback(
    (values: SiteFormInput) => {
      startTransition(async () => {
        try {
          const result = await submitSiteForm(siteId, values, {
            honeypot: honeypotValue,
            renderedAt: renderedAt ?? undefined,
          });
          if (!result.success) {
            toast.error(result.error);
            return;
          }
          toast.success(
            "Mensagem enviada! Em breve entraremos em contato.",
          );
          trackEvent("form_submit", { form_variant: "home_quick" });
          setSubmitted(true);
          reset({
            model: "Contato pela home",
            name: "",
            email: "",
            phone: "",
            message: "",
            lgpd: false as unknown as true,
          });
        } catch {
          toast.error("Erro ao enviar. Tente novamente.");
        }
      });
    },
    [siteId, reset, honeypotValue, renderedAt],
  );

  const onSubmit = handleSubmit(submitWithExtras);

  const inputBaseCls = cn(
    "h-12 rounded-md border px-4 text-sm transition focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-60",
    theme.inputBase,
  );

  return (
    <section
      data-testid="home-contact-form-quick"
      data-variant={variant}
      aria-label="Formulário de contato rápido"
      className={cn("w-full py-16 md:py-24", theme.section)}
    >
      <div className="mx-auto max-w-3xl px-4 md:px-8">
        <header className="mb-8 flex flex-col gap-3 text-center md:mb-10">
          <h2 className="as-h2">
            Fale com a nossa equipe
          </h2>
          <p className={cn("text-sm md:text-base", theme.subtitle)}>
            Deixe seu contato e nossa equipe retorna em até 1 dia útil.
          </p>
        </header>

        <form
          noValidate
          onSubmit={onSubmit}
          aria-label="Formulário de contato"
          aria-describedby={`${formIdBase}-summary`}
          className={cn(
            "flex flex-col gap-4 rounded-2xl border p-6 md:p-8",
            theme.formContainer,
          )}
        >
          {/*
            Honeypot field — escondido via inline style pra ser robusto
            mesmo se o CSS do site não carregar.
          */}
          <div
            style={{
              position: "absolute",
              left: "-9999px",
              top: "auto",
              width: "1px",
              height: "1px",
              overflow: "hidden",
            }}
            aria-hidden="true"
          >
            <label htmlFor={`${formIdBase}-website`}>
              Website (não preencher)
            </label>
            <input
              id={`${formIdBase}-website`}
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              value={honeypotValue}
              onChange={(e) => setHoneypotValue(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field
              id={`${formIdBase}-name`}
              label="Nome completo"
              error={errors.name?.message}
              theme={theme}
              inputProps={{
                type: "text",
                autoComplete: "name",
                placeholder: "Seu nome",
                className: inputBaseCls,
                ...register("name"),
              }}
            />
            <Field
              id={`${formIdBase}-phone`}
              label="Telefone (WhatsApp)"
              error={errors.phone?.message}
              theme={theme}
              inputProps={{
                type: "tel",
                autoComplete: "tel",
                placeholder: "(11) 99999-9999",
                className: inputBaseCls,
                ...register("phone"),
              }}
            />
            <Field
              id={`${formIdBase}-email`}
              label="E-mail"
              error={errors.email?.message}
              theme={theme}
              inputProps={{
                type: "email",
                autoComplete: "email",
                placeholder: "seu@email.com",
                className: inputBaseCls,
                ...register("email"),
              }}
            />
            <div className="md:col-span-1 flex items-end">
              <p className={cn("text-xs", theme.helperText)}>
                Responderemos via WhatsApp ou e-mail no horário comercial.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor={`${formIdBase}-message`}
              className={cn("text-sm font-medium", theme.labelText)}
            >
              Mensagem
            </label>
            <textarea
              id={`${formIdBase}-message`}
              rows={4}
              placeholder="Descreva o que está procurando (mínimo 10 caracteres)"
              aria-invalid={errors.message ? "true" : undefined}
              aria-describedby={
                errors.message ? `${formIdBase}-message-error` : undefined
              }
              className={cn(
                "min-h-[120px] rounded-md border px-4 py-3 text-sm transition focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-60",
                theme.inputBase,
                errors.message
                  ? theme.inputBorderError
                  : theme.inputBorderDefault,
              )}
              {...register("message")}
            />
            {errors.message && (
              <p
                id={`${formIdBase}-message-error`}
                role="alert"
                className={cn("text-xs", theme.errorText)}
              >
                {errors.message.message}
              </p>
            )}
          </div>

          <div className="flex items-start gap-2">
            <input
              id={`${formIdBase}-lgpd`}
              type="checkbox"
              {...register("lgpd")}
              aria-describedby={
                errors.lgpd ? `${formIdBase}-lgpd-error` : undefined
              }
              className={cn(
                "mt-1 size-4 cursor-pointer rounded border",
                theme.lgpdCheckbox,
              )}
            />
            <label
              htmlFor={`${formIdBase}-lgpd`}
              className={cn("text-xs md:text-sm", theme.lgpdText)}
            >
              Concordo com a Política de Privacidade de{" "}
              <strong className="font-semibold">{businessName}</strong> e
              GaspLab.{" "}
              <Link
                href={`/sites/${slug}/lgpd`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:opacity-80"
              >
                Ler política
              </Link>
              .
            </label>
          </div>
          {errors.lgpd?.message && (
            <p
              id={`${formIdBase}-lgpd-error`}
              role="alert"
              className={cn("text-xs", theme.errorText)}
            >
              {errors.lgpd.message}
            </p>
          )}

          <button
            type="submit"
            disabled={isPending}
            style={{
              backgroundColor: "var(--site-primary)",
              color: "var(--site-text-on-primary)",
            }}
            className={cn(
              "mt-2 inline-flex h-12 items-center justify-center rounded-md px-6 text-sm font-semibold transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-60",
              theme.submitFocusRing,
            )}
          >
            {isPending ? (
              <Loader2 className="size-5 animate-spin" aria-hidden />
            ) : (
              "Enviar mensagem"
            )}
          </button>

          {submitted && (
            <p
              id={`${formIdBase}-summary`}
              role="status"
              aria-live="polite"
              className={cn("text-sm", theme.successText)}
            >
              Recebemos seu contato — em breve nossa equipe responde.
            </p>
          )}
        </form>
      </div>
    </section>
  );
}

interface FieldProps {
  id: string;
  label: string;
  error?: string;
  theme: FormTheme;
  inputProps: React.InputHTMLAttributes<HTMLInputElement>;
}

function Field({ id, label, error, theme, inputProps }: FieldProps) {
  const errorId = `${id}-error`;
  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={id}
        className={cn("text-sm font-medium", theme.labelText)}
      >
        {label}
      </label>
      <input
        id={id}
        {...inputProps}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn(
          inputProps.className,
          error ? theme.inputBorderError : theme.inputBorderDefault,
        )}
      />
      {error && (
        <p id={errorId} role="alert" className={cn("text-xs", theme.errorText)}>
          {error}
        </p>
      )}
    </div>
  );
}
