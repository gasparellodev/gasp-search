"use client";

import { useId, useState, useTransition } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { submitSiteForm } from "@/app/actions/site-form";
import { trackEvent } from "@/lib/analytics/track-event";
import { sanitizeHex } from "@/lib/sites/sanitize";
import {
  SiteFormSchema,
  type SiteFormInput,
} from "@/lib/sites/site-form.schema";
import { cn } from "@/lib/utils";

export type SiteFormVariant = "home" | "contact" | "car-detail";

interface SiteFormProps {
  siteId: string;
  variant: SiteFormVariant;
  /**
   * Pré-preenche o campo `model` (read-only) quando a variante é
   * `'car-detail'` — caso o usuário esteja na página do carro X, o nome
   * do modelo já vem capturado.
   */
  prefillModel?: string;
  /** Cor primária do site (hex sanitizado) — bg do botão Enviar. */
  primary_color: string;
  /** Cor de texto sobre primário (hex sanitizado) — texto do botão. */
  text_on_primary: string;
  /** Slug do site, usado no link da Política de Privacidade. */
  slug: string;
  /**
   * Título customizado renderizado no `<h2>` do header do form. Quando
   * omitido, mantém o copy default `"Você está procurando algum modelo
   * em específico?"`. Permite que `<HomeForm>` (#162) reuse o componente
   * com o título canônico da Home sem fork. Não-quebrante: callers
   * existentes não precisam atualizar.
   */
  title?: string;
}

/**
 * Form público de captura de lead (Phase 7 — issue #161). Client Component.
 *
 * 3 variantes (todos os mesmos campos, layouts diferentes):
 *   - `'home'` / `'contact'`: 4 campos lado-a-lado no desktop + LGPD abaixo.
 *   - `'car-detail'`: idem, mas `model` é read-only e pré-preenchido.
 *
 * Submit chama Server Action `submitSiteForm` (stub MVP). Toast de sucesso
 * via `sonner`. Toast de erro em falha de validação server-side.
 */
export function SiteForm({
  siteId,
  variant,
  prefillModel,
  primary_color,
  text_on_primary,
  slug,
  title,
}: SiteFormProps) {
  const [isPending, startTransition] = useTransition();
  const [submitted, setSubmitted] = useState(false);
  const errorIdBase = useId();

  const safePrimary = sanitizeHex(primary_color);
  const safeTextOnPrimary = sanitizeHex(text_on_primary);

  const isCarDetail = variant === "car-detail";

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SiteFormInput>({
    resolver: zodResolver(SiteFormSchema),
    defaultValues: {
      model: prefillModel ?? "",
      name: "",
      email: "",
      phone: "",
      lgpd: false as unknown as true,
    },
  });

  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
      try {
        const result = await submitSiteForm(siteId, values);
        if (!result.success) {
          toast.error(result.error);
          return;
        }
        toast.success("Mensagem enviada!");
        trackEvent("form_submit", { form_variant: variant });
        setSubmitted(true);
        reset({
          model: prefillModel ?? "",
          name: "",
          email: "",
          phone: "",
          lgpd: false as unknown as true,
        });
      } catch {
        toast.error("Erro ao enviar. Tente novamente.");
      }
    });
  });

  const buttonStyle = {
    backgroundColor: safePrimary,
    color: safeTextOnPrimary,
  };

  return (
    <section
      data-testid="site-form"
      data-variant={variant}
      className="w-full"
    >
      <div className="mx-auto max-w-6xl px-4 md:px-8">
        <header className="mb-6 space-y-2">
          <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            {title ?? (
              <>
                Você está procurando
                <br />
                algum modelo em específico?
              </>
            )}
          </h2>
          <p className="text-sm text-foreground/70 md:text-base">
            Deixe seu contato para que a nossa equipe entre em contato com
            você!
          </p>
        </header>

        <form
          noValidate
          onSubmit={onSubmit}
          aria-label="Formulário de contato"
          className="rounded-2xl border border-foreground/15 p-6 md:p-8"
        >
          <div
            className={cn(
              "grid gap-4",
              "grid-cols-1 md:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_auto]",
            )}
          >
            <FormField
              id={`${errorIdBase}-model`}
              label="Modelo"
              error={errors.model?.message}
              inputProps={{
                type: "text",
                readOnly: isCarDetail,
                placeholder: "Modelo",
                "aria-readonly": isCarDetail || undefined,
                ...register("model"),
              }}
            />
            <FormField
              id={`${errorIdBase}-name`}
              label="Nome"
              error={errors.name?.message}
              inputProps={{
                type: "text",
                placeholder: "Nome",
                autoComplete: "name",
                ...register("name"),
              }}
            />
            <FormField
              id={`${errorIdBase}-email`}
              label="E-mail"
              error={errors.email?.message}
              inputProps={{
                type: "email",
                placeholder: "E-mail",
                autoComplete: "email",
                ...register("email"),
              }}
            />
            <FormField
              id={`${errorIdBase}-phone`}
              label="Número"
              error={errors.phone?.message}
              inputProps={{
                type: "tel",
                placeholder: "Número",
                autoComplete: "tel",
                ...register("phone"),
              }}
            />
            <button
              type="submit"
              disabled={isPending}
              style={buttonStyle}
              className="inline-flex h-12 items-center justify-center rounded-md px-6 text-sm font-medium transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30 disabled:cursor-not-allowed disabled:opacity-60 lg:self-end"
            >
              {isPending ? (
                <Loader2 className="size-5 animate-spin" aria-hidden />
              ) : (
                "Enviar"
              )}
            </button>
          </div>

          <div className="mt-4 flex items-start gap-2">
            <input
              id={`${errorIdBase}-lgpd`}
              type="checkbox"
              {...register("lgpd")}
              aria-describedby={
                errors.lgpd ? `${errorIdBase}-lgpd-error` : undefined
              }
              className="mt-1 size-4 cursor-pointer rounded border border-foreground/30 accent-foreground"
            />
            <label
              htmlFor={`${errorIdBase}-lgpd`}
              className="text-xs text-foreground/70 md:text-sm"
            >
              De acordo com a LGPD, concordo em fornecer os dados acima para
              que entrem em contato comigo para apresentar serviços. Seu nome,
              e-mail e telefone serão usados de acordo com a nossa{" "}
              <Link
                href={`/sites/${slug}/lgpd`}
                className="underline underline-offset-2 hover:text-foreground"
              >
                Política de Privacidade
              </Link>
              .
            </label>
          </div>
          {errors.lgpd?.message && (
            <p
              id={`${errorIdBase}-lgpd-error`}
              role="alert"
              className="mt-2 text-xs text-red-600"
            >
              {errors.lgpd.message}
            </p>
          )}

          {submitted && (
            <p
              role="status"
              aria-live="polite"
              className="mt-4 text-sm text-foreground/70"
            >
              Recebemos seu contato — em breve nossa equipe responde.
            </p>
          )}
        </form>
      </div>
    </section>
  );
}

interface FormFieldProps {
  id: string;
  label: string;
  error?: string;
  inputProps: React.InputHTMLAttributes<HTMLInputElement>;
}

function FormField({ id, label, error, inputProps }: FormFieldProps) {
  const errorId = `${id}-error`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        id={id}
        {...inputProps}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn(
          "h-12 rounded-md border bg-background px-4 text-sm text-foreground placeholder:text-foreground/40 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30 disabled:cursor-not-allowed disabled:opacity-60",
          error ? "border-red-500" : "border-foreground/20",
          inputProps.readOnly && "cursor-not-allowed bg-foreground/5",
        )}
      />
      {error && (
        <p id={errorId} role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
