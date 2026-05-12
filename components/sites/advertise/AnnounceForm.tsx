"use client";

import { useId, useState, useTransition } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import {
  AnnouncementSchema,
  type AnnouncementInput,
} from "@/lib/sites/announcement.schema";
import { submitAnnouncement } from "@/app/actions/site-announcement";

interface AnnounceFormProps {
  siteId: string;
  slug: string;
  /** Cor primária (hex sanitizado). */
  primary_color: string;
  /** Cor de texto sobre primário (hex sanitizado). */
  text_on_primary: string;
}

/**
 * Form do "Anuncie seu carro aqui" (Phase 7 — issue #163). Client Component.
 *
 * `react-hook-form` + `zodResolver(AnnouncementSchema)`. Submit chama a
 * Server Action `submitAnnouncement(siteId, payload)` (stub V1 — não
 * persiste). Toast `sonner` em sucesso e em falha de validação
 * server-side.
 *
 * **a11y**: cada campo tem `<label>` linkado por `htmlFor`. Mensagens
 * de erro têm `role="alert"` e são associadas via `aria-describedby`.
 *
 * **Anti-XSS**: input do usuário **não é** renderizado de volta como
 * HTML. Form values só viajam pro Server Action — nunca tocam DOM como
 * markup.
 */
export function AnnounceForm({
  siteId,
  slug,
  primary_color,
  text_on_primary,
}: AnnounceFormProps) {
  const [isPending, startTransition] = useTransition();
  const [submitted, setSubmitted] = useState(false);
  const baseId = useId();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AnnouncementInput>({
    resolver: zodResolver(AnnouncementSchema),
    defaultValues: {
      marca: "",
      modelo: "",
      ano: undefined as unknown as number,
      km: undefined as unknown as number,
      preco: null,
      nome: "",
      telefone: "",
      email: "",
      mensagem: undefined,
      lgpd_consent: false as unknown as true,
    },
  });

  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
      try {
        const result = await submitAnnouncement(siteId, values);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success("Recebemos seu anúncio! Em breve entramos em contato.");
        setSubmitted(true);
        reset();
      } catch {
        toast.error("Erro ao enviar. Tente novamente.");
      }
    });
  });

  const buttonStyle = {
    backgroundColor: primary_color,
    color: text_on_primary,
  };

  return (
    <form
      noValidate
      onSubmit={onSubmit}
      aria-label="Formulário para anunciar carro"
      className="rounded-2xl border border-foreground/15 p-6 md:p-8"
      data-testid="announce-form"
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field
          id={`${baseId}-marca`}
          label="Marca"
          error={errors.marca?.message}
          inputProps={{
            type: "text",
            placeholder: "Ex.: Toyota",
            ...register("marca"),
          }}
        />
        <Field
          id={`${baseId}-modelo`}
          label="Modelo"
          error={errors.modelo?.message}
          inputProps={{
            type: "text",
            placeholder: "Ex.: Corolla XEi",
            ...register("modelo"),
          }}
        />
        <Field
          id={`${baseId}-ano`}
          label="Ano"
          error={errors.ano?.message}
          inputProps={{
            type: "number",
            placeholder: "2022",
            inputMode: "numeric",
            ...register("ano", {
              valueAsNumber: true,
            }),
          }}
        />
        <Field
          id={`${baseId}-km`}
          label="Quilometragem"
          error={errors.km?.message}
          inputProps={{
            type: "number",
            placeholder: "35000",
            inputMode: "numeric",
            ...register("km", {
              valueAsNumber: true,
            }),
          }}
        />
        <Field
          id={`${baseId}-preco`}
          label="Preço pretendido (opcional)"
          error={errors.preco?.message}
          inputProps={{
            type: "number",
            placeholder: "Ex.: 89000",
            inputMode: "decimal",
            step: "0.01",
            ...register("preco", {
              setValueAs: (v: unknown) => {
                if (v === "" || v === null || v === undefined) return null;
                const n = Number(v);
                return Number.isFinite(n) ? n : null;
              },
            }),
          }}
        />
        <Field
          id={`${baseId}-nome`}
          label="Seu nome"
          error={errors.nome?.message}
          inputProps={{
            type: "text",
            placeholder: "Nome completo",
            autoComplete: "name",
            ...register("nome"),
          }}
        />
        <Field
          id={`${baseId}-telefone`}
          label="Telefone"
          error={errors.telefone?.message}
          inputProps={{
            type: "tel",
            placeholder: "(00) 00000-0000",
            autoComplete: "tel",
            ...register("telefone"),
          }}
        />
        <Field
          id={`${baseId}-email`}
          label="E-mail"
          error={errors.email?.message}
          inputProps={{
            type: "email",
            placeholder: "voce@email.com",
            autoComplete: "email",
            ...register("email"),
          }}
        />
      </div>

      <div className="mt-4 flex flex-col gap-1">
        <label
          htmlFor={`${baseId}-mensagem`}
          className="text-sm font-medium text-foreground/80"
        >
          Mensagem (opcional)
        </label>
        <textarea
          id={`${baseId}-mensagem`}
          {...register("mensagem")}
          aria-invalid={errors.mensagem ? "true" : undefined}
          aria-describedby={
            errors.mensagem ? `${baseId}-mensagem-error` : undefined
          }
          rows={4}
          placeholder="Conte mais detalhes sobre o veículo, estado de conservação, etc."
          className={cn(
            "w-full rounded-md border bg-background px-4 py-3 text-sm text-foreground placeholder:text-foreground/40 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30",
            errors.mensagem ? "border-red-500" : "border-foreground/20",
          )}
        />
        {errors.mensagem?.message && (
          <p
            id={`${baseId}-mensagem-error`}
            role="alert"
            className="text-xs text-red-600"
          >
            {errors.mensagem.message}
          </p>
        )}
      </div>

      <div className="mt-6 flex items-start gap-2">
        <input
          id={`${baseId}-lgpd`}
          type="checkbox"
          {...register("lgpd_consent")}
          aria-describedby={
            errors.lgpd_consent ? `${baseId}-lgpd-error` : undefined
          }
          className="mt-1 size-4 cursor-pointer rounded border border-foreground/30 accent-foreground"
        />
        <label
          htmlFor={`${baseId}-lgpd`}
          className="text-xs text-foreground/70 md:text-sm"
        >
          De acordo com a LGPD, concordo em fornecer os dados acima para que
          entrem em contato comigo. Seus dados serão usados de acordo com a
          nossa{" "}
          <Link
            href={`/sites/${slug}/lgpd`}
            className="underline underline-offset-2 hover:text-foreground"
          >
            Política de Privacidade
          </Link>
          .
        </label>
      </div>
      {errors.lgpd_consent?.message && (
        <p
          id={`${baseId}-lgpd-error`}
          role="alert"
          className="mt-2 text-xs text-red-600"
        >
          {errors.lgpd_consent.message}
        </p>
      )}

      <div className="mt-6 flex items-center justify-end">
        <button
          type="submit"
          disabled={isPending}
          style={buttonStyle}
          className="inline-flex h-12 items-center justify-center rounded-md px-8 text-sm font-medium transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? (
            <Loader2 className="size-5 animate-spin" aria-hidden />
          ) : (
            "Enviar anúncio"
          )}
        </button>
      </div>

      {submitted && (
        <p
          role="status"
          aria-live="polite"
          className="mt-4 text-sm text-foreground/70"
        >
          Recebemos seu anúncio — em breve nossa equipe responde.
        </p>
      )}
    </form>
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
      <label htmlFor={id} className="text-sm font-medium text-foreground/80">
        {label}
      </label>
      <input
        id={id}
        {...inputProps}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn(
          "h-12 rounded-md border bg-background px-4 text-sm text-foreground placeholder:text-foreground/40 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30",
          error ? "border-red-500" : "border-foreground/20",
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
