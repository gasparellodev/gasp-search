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
}

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
    />
  );
}

function HomeContactFormQuickInner({
  siteId,
  businessName,
  slug,
}: HomeContactFormQuickProps) {
  const [isPending, startTransition] = useTransition();
  const [submitted, setSubmitted] = useState(false);
  const [renderedAt, setRenderedAt] = useState<number | null>(null);
  const [honeypotValue, setHoneypotValue] = useState("");
  const formIdBase = useId();

  // Mount time capturado em state (não em ref) pra satisfazer
  // `react-hooks/refs` (React 19 rule). Não use `useState(() => Date.now())`
  // porque o SSR rendering produziria valor no servidor — queremos o tempo
  // de hydration no cliente (quando o usuário REALMENTE pode interagir).
  // O cascading render extra do `setRenderedAt` é intencional aqui — sem
  // custo perceptível (1 re-render no mount).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional mount-time capture, see comment above
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

  const inputBaseCls =
    "h-12 rounded-md border bg-background/[0.06] px-4 text-sm text-background placeholder:text-background/45 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-background/40 disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <section
      data-testid="home-contact-form-quick"
      aria-label="Formulário de contato rápido"
      className="w-full bg-foreground py-16 text-background md:py-24"
    >
      <div className="mx-auto max-w-3xl px-4 md:px-8">
        <header className="mb-8 flex flex-col gap-3 text-center md:mb-10">
          <h2
            className="font-bold leading-tight tracking-tight"
            style={{ fontSize: "clamp(1.875rem, 4vw, 3rem)" }}
          >
            Fale com a nossa equipe
          </h2>
          <p className="text-sm text-background/75 md:text-base">
            Deixe seu contato e nossa equipe retorna em até 1 dia útil.
          </p>
        </header>

        <form
          noValidate
          onSubmit={onSubmit}
          aria-label="Formulário de contato"
          aria-describedby={`${formIdBase}-summary`}
          className="flex flex-col gap-4 rounded-2xl border border-background/15 bg-background/[0.04] p-6 md:p-8"
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
              inputProps={{
                type: "email",
                autoComplete: "email",
                placeholder: "seu@email.com",
                className: inputBaseCls,
                ...register("email"),
              }}
            />
            <div className="md:col-span-1 flex items-end">
              <p className="text-xs text-background/60">
                Responderemos via WhatsApp ou e-mail no horário comercial.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor={`${formIdBase}-message`}
              className="text-sm font-medium text-background"
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
                "min-h-[120px] rounded-md border bg-background/[0.06] px-4 py-3 text-sm text-background placeholder:text-background/45 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-background/40 disabled:cursor-not-allowed disabled:opacity-60",
                errors.message
                  ? "border-red-400/60"
                  : "border-background/20",
              )}
              {...register("message")}
            />
            {errors.message && (
              <p
                id={`${formIdBase}-message-error`}
                role="alert"
                className="text-xs text-red-300"
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
              className="mt-1 size-4 cursor-pointer rounded border border-background/40 accent-background"
            />
            <label
              htmlFor={`${formIdBase}-lgpd`}
              className="text-xs text-background/75 md:text-sm"
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
              className="text-xs text-red-300"
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
            className="mt-2 inline-flex h-12 items-center justify-center rounded-md px-6 text-sm font-semibold transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-background/40 disabled:cursor-not-allowed disabled:opacity-60"
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
              className="text-sm text-background/85"
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
  inputProps: React.InputHTMLAttributes<HTMLInputElement>;
}

function Field({ id, label, error, inputProps }: FieldProps) {
  const errorId = `${id}-error`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-background">
        {label}
      </label>
      <input
        id={id}
        {...inputProps}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn(
          inputProps.className,
          error ? "border-red-400/60" : "border-background/20",
        )}
      />
      {error && (
        <p id={errorId} role="alert" className="text-xs text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
