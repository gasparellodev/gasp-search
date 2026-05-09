"use client";

/**
 * `<LeadSiteEditModal />` — modal de edição manual das variáveis do site
 * (issue #168).
 *
 * Substitui o button disabled "Editar" do `<LeadSiteCardActions />` quando
 * `status IN ('published','sent')`. Renderiza form com inputs pra todos os
 * campos top-level de `SiteVariables` + array editável de `cars[]`.
 *
 * Stack:
 *  - `react-hook-form` + `zodResolver(SiteVariables.partial())` — validação
 *    inline + dirty fields tracking.
 *  - `radix-ui` Dialog (via `@/components/ui/dialog`) — focus trap,
 *    `role="dialog"` e `aria-modal="true"` automáticos.
 *  - Submit envia **apenas `dirtyFields`** pra Server Action
 *    `updateLeadSiteVariables`. Reduz payload e simplifica merge no server.
 *  - URL inputs são text fields V1. Upload de arquivo é follow-up V2
 *    (Vercel Blob picker — registrado no body da issue).
 *
 * **a11y**:
 *  - `aria-labelledby` aponta pro `DialogTitle`.
 *  - Cada input tem `<Label htmlFor>` e `aria-invalid` quando há erro.
 *  - Erros têm `role="alert"` e são associados via `aria-describedby`.
 *  - ESC fecha (Radix); foco volta ao trigger ao fechar.
 */

import { useId, useTransition } from "react";
import {
  useForm,
  useFieldArray,
  type SubmitHandler,
  type FieldErrors,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { updateLeadSiteVariables } from "@/app/actions/lead-site";
import type { UpdateLeadSiteVariablesResult } from "@/app/actions/lead-site";
import { SiteVariables } from "@/types/lead-site";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import type { LeadSiteCardData } from "./lead-site-card-types";

type FormValues = Partial<SiteVariables>;

interface LeadSiteEditModalProps {
  /** Linha de `lead_sites` carregada pelo Server Component pai. */
  leadSite: LeadSiteCardData;
  /** Controle externo do modal (`useState` no parent). */
  open: boolean;
  /** Disparado em ESC, click no overlay, button "Cancelar" e após sucesso. */
  onOpenChange: (open: boolean) => void;
}

/**
 * Mapeia o `error` discriminated da Server Action pra mensagem PT-BR.
 */
function errorMessage(
  result: UpdateLeadSiteVariablesResult & { ok: false },
): string {
  switch (result.error) {
    case "auth":
      return "Sessão expirada. Faça login novamente.";
    case "not_found":
      return "Site não encontrado.";
    case "invalid_status":
      return "Apenas sites publicados ou enviados podem ser editados.";
    case "validation":
      return "Os dados não passaram na validação. Confira os campos.";
    case "db_error":
      return "Erro ao salvar. Tente novamente em instantes.";
    default:
      return result.message ?? "Erro desconhecido.";
  }
}

/**
 * Computa o subset `dirtyFields` do payload completo do form. Usa o mapa
 * de `dirtyFields` do react-hook-form (true marcado nas chaves alteradas).
 *
 * Para arrays (`cars`, `home_categories`, `recent_sales`, `values`) e objetos
 * aninhados (`emphasis`), o RHF marca cada index/key. Como o Server Action
 * faz `{ ...current, ...patch }` em chaves top-level, mandamos o array/objeto
 * **inteiro** quando qualquer descendente foi tocado — o merge no server
 * usa shallow merge e isso preserva o resto.
 */
function computePatch(
  values: FormValues,
  dirtyFields: Record<string, unknown>,
): FormValues {
  const patch: Record<string, unknown> = {};
  const keys = Object.keys(dirtyFields) as Array<keyof FormValues>;
  for (const key of keys) {
    if (dirtyFields[key]) {
      patch[key as string] = values[key];
    }
  }
  return patch as FormValues;
}

/**
 * Wrapper de campo com label + erro inline. `aria-describedby` linka erro
 * ao input pra leitores de tela.
 */
function Field({
  id,
  label,
  error,
  children,
  hint,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && !error ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p
          id={errorId}
          role="alert"
          className="text-xs text-destructive"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function LeadSiteEditModal({
  leadSite,
  open,
  onOpenChange,
}: LeadSiteEditModalProps) {
  const baseId = useId();
  const [isPending, startTransition] = useTransition();

  const variables = leadSite.variables ?? undefined;

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, dirtyFields, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(SiteVariables.partial()),
    defaultValues: variables,
  });

  const carsArray = useFieldArray({
    control,
    // `cars` é typed como SiteCar[] — RHF aceita o key.
    name: "cars" as never,
  });

  const onSubmit: SubmitHandler<FormValues> = (values) => {
    if (!isDirty) {
      // Nada mudou — feedback rápido sem chamar Server.
      toast.message("Nenhuma alteração para salvar.");
      onOpenChange(false);
      return;
    }
    const patch = computePatch(values, dirtyFields as Record<string, unknown>);
    startTransition(async () => {
      try {
        const result = await updateLeadSiteVariables(leadSite.id, patch);
        if (result.ok) {
          toast.success("Site atualizado!", {
            description: "As alterações já estão visíveis na pré-visualização.",
          });
          // Reset com os novos valores como baseline pra próximo dirty diff.
          reset(values);
          onOpenChange(false);
        } else {
          toast.error("Não foi possível salvar", {
            description: errorMessage(result),
          });
        }
      } catch {
        toast.error("Não foi possível salvar", {
          description: "Erro inesperado. Tente novamente.",
        });
      }
    });
  };

  // Erros tipados — RHF entrega `errors` com nested shapes.
  const e = errors as FieldErrors<SiteVariables>;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-2xl max-h-[90vh] overflow-y-auto"
        aria-labelledby={`${baseId}-title`}
        data-testid="lead-site-edit-modal"
      >
        <DialogHeader>
          <DialogTitle id={`${baseId}-title`}>Editar site</DialogTitle>
          <DialogDescription>
            Ajuste manualmente os textos, cores, contatos e estoque do site.
            Apenas campos alterados são enviados.
          </DialogDescription>
        </DialogHeader>

        <form
          noValidate
          onSubmit={handleSubmit(onSubmit)}
          aria-label="Editar variáveis do site"
          className="flex flex-col gap-6"
        >
          {/* ----------------------------- Globais ---------------------------- */}
          <section
            aria-labelledby={`${baseId}-globals`}
            className="flex flex-col gap-3"
          >
            <h3
              id={`${baseId}-globals`}
              className="text-sm font-semibold uppercase tracking-wide text-muted-foreground"
            >
              Globais
            </h3>
            <Field
              id={`${baseId}-business-name`}
              label="Nome do negócio"
              error={e.business_name?.message}
            >
              <Input
                id={`${baseId}-business-name`}
                aria-invalid={!!e.business_name}
                aria-describedby={
                  e.business_name ? `${baseId}-business-name-error` : undefined
                }
                {...register("business_name")}
              />
            </Field>
            <Field
              id={`${baseId}-slogan`}
              label="Slogan"
              error={e.slogan?.message}
              hint="Entre 10 e 120 caracteres."
            >
              <Input
                id={`${baseId}-slogan`}
                aria-invalid={!!e.slogan}
                aria-describedby={
                  e.slogan ? `${baseId}-slogan-error` : `${baseId}-slogan-hint`
                }
                {...register("slogan")}
              />
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field
                id={`${baseId}-primary-color`}
                label="Cor primária"
                error={e.primary_color?.message}
                hint="Hex 6 dígitos (ex.: #0c5cff)."
              >
                <Input
                  id={`${baseId}-primary-color`}
                  type="text"
                  placeholder="#0c5cff"
                  aria-invalid={!!e.primary_color}
                  {...register("primary_color")}
                />
              </Field>
              <Field
                id={`${baseId}-text-on-primary`}
                label="Texto sobre primário"
                error={e.text_on_primary?.message}
                hint="#FFFFFF (branco) ou #0C0C0C (preto)."
              >
                <select
                  id={`${baseId}-text-on-primary`}
                  className={cn(
                    "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm",
                  )}
                  aria-invalid={!!e.text_on_primary}
                  {...register("text_on_primary")}
                >
                  <option value="#FFFFFF">#FFFFFF (branco)</option>
                  <option value="#0C0C0C">#0C0C0C (preto)</option>
                </select>
              </Field>
            </div>
            <Field
              id={`${baseId}-logo-url`}
              label="URL do logo"
              error={e.logo_url?.message}
            >
              <Input
                id={`${baseId}-logo-url`}
                type="url"
                placeholder="https://..."
                aria-invalid={!!e.logo_url}
                {...register("logo_url")}
              />
            </Field>
          </section>

          {/* ------------------------------ Home ------------------------------ */}
          <section
            aria-labelledby={`${baseId}-home`}
            className="flex flex-col gap-3"
          >
            <h3
              id={`${baseId}-home`}
              className="text-sm font-semibold uppercase tracking-wide text-muted-foreground"
            >
              Home
            </h3>
            <Field
              id={`${baseId}-hero-image`}
              label="URL da imagem do hero"
              error={e.hero_image_url?.message}
            >
              <Input
                id={`${baseId}-hero-image`}
                type="url"
                placeholder="https://..."
                aria-invalid={!!e.hero_image_url}
                {...register("hero_image_url")}
              />
            </Field>
          </section>

          {/* ------------------------------ Sobre ----------------------------- */}
          <section
            aria-labelledby={`${baseId}-about`}
            className="flex flex-col gap-3"
          >
            <h3
              id={`${baseId}-about`}
              className="text-sm font-semibold uppercase tracking-wide text-muted-foreground"
            >
              Sobre
            </h3>
            <Field
              id={`${baseId}-about-text`}
              label="Texto institucional"
              error={e.about_text?.message}
              hint="Entre 200 e 1500 caracteres."
            >
              <Textarea
                id={`${baseId}-about-text`}
                rows={5}
                aria-invalid={!!e.about_text}
                {...register("about_text")}
              />
            </Field>
            <Field
              id={`${baseId}-about-image`}
              label="URL da imagem do Sobre"
              error={e.about_image_url?.message}
            >
              <Input
                id={`${baseId}-about-image`}
                type="url"
                placeholder="https://..."
                aria-invalid={!!e.about_image_url}
                {...register("about_image_url")}
              />
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field
                id={`${baseId}-mission`}
                label="Missão"
                error={e.mission?.message}
              >
                <Textarea
                  id={`${baseId}-mission`}
                  rows={3}
                  aria-invalid={!!e.mission}
                  {...register("mission")}
                />
              </Field>
              <Field
                id={`${baseId}-vision`}
                label="Visão"
                error={e.vision?.message}
              >
                <Textarea
                  id={`${baseId}-vision`}
                  rows={3}
                  aria-invalid={!!e.vision}
                  {...register("vision")}
                />
              </Field>
            </div>
          </section>

          {/* ----------------------------- Contato ---------------------------- */}
          <section
            aria-labelledby={`${baseId}-contact`}
            className="flex flex-col gap-3"
          >
            <h3
              id={`${baseId}-contact`}
              className="text-sm font-semibold uppercase tracking-wide text-muted-foreground"
            >
              Contato
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field
                id={`${baseId}-whatsapp`}
                label="WhatsApp"
                error={e.whatsapp?.message}
                hint="Apenas dígitos, 10–13 caracteres (ex.: 5581999999999)."
              >
                <Input
                  id={`${baseId}-whatsapp`}
                  inputMode="numeric"
                  aria-invalid={!!e.whatsapp}
                  {...register("whatsapp")}
                />
              </Field>
              <Field
                id={`${baseId}-phone-display`}
                label="Telefone exibido"
                error={e.phone_display?.message}
              >
                <Input
                  id={`${baseId}-phone-display`}
                  aria-invalid={!!e.phone_display}
                  {...register("phone_display")}
                />
              </Field>
              <Field
                id={`${baseId}-email`}
                label="E-mail"
                error={e.email?.message}
              >
                <Input
                  id={`${baseId}-email`}
                  type="email"
                  aria-invalid={!!e.email}
                  {...register("email")}
                />
              </Field>
              <Field
                id={`${baseId}-instagram`}
                label="URL do Instagram"
                error={e.instagram_url?.message}
              >
                <Input
                  id={`${baseId}-instagram`}
                  type="url"
                  placeholder="https://instagram.com/..."
                  aria-invalid={!!e.instagram_url}
                  {...register("instagram_url")}
                />
              </Field>
              <Field
                id={`${baseId}-facebook`}
                label="URL do Facebook"
                error={e.facebook_url?.message}
              >
                <Input
                  id={`${baseId}-facebook`}
                  type="url"
                  placeholder="https://facebook.com/..."
                  aria-invalid={!!e.facebook_url}
                  {...register("facebook_url")}
                />
              </Field>
              <Field
                id={`${baseId}-youtube`}
                label="URL do YouTube"
                error={e.youtube_url?.message}
              >
                <Input
                  id={`${baseId}-youtube`}
                  type="url"
                  placeholder="https://youtube.com/..."
                  aria-invalid={!!e.youtube_url}
                  {...register("youtube_url")}
                />
              </Field>
              <Field
                id={`${baseId}-address`}
                label="Endereço"
                error={e.address_line?.message}
              >
                <Input
                  id={`${baseId}-address`}
                  aria-invalid={!!e.address_line}
                  {...register("address_line")}
                />
              </Field>
              <Field
                id={`${baseId}-hours`}
                label="Horário"
                error={e.hours?.message}
              >
                <Input
                  id={`${baseId}-hours`}
                  aria-invalid={!!e.hours}
                  {...register("hours")}
                />
              </Field>
            </div>
            <Field
              id={`${baseId}-contact-hero`}
              label="URL da imagem do Contato"
              error={e.contact_hero_image_url?.message}
            >
              <Input
                id={`${baseId}-contact-hero`}
                type="url"
                placeholder="https://..."
                aria-invalid={!!e.contact_hero_image_url}
                {...register("contact_hero_image_url")}
              />
            </Field>
          </section>

          {/* ----------------------------- Estoque ---------------------------- */}
          <section
            aria-labelledby={`${baseId}-cars`}
            className="flex flex-col gap-3"
          >
            <div className="flex items-center justify-between">
              <h3
                id={`${baseId}-cars`}
                className="text-sm font-semibold uppercase tracking-wide text-muted-foreground"
              >
                Estoque ({carsArray.fields.length}/6)
              </h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={carsArray.fields.length >= 6}
                onClick={() =>
                  carsArray.append({
                    slug: `car-${carsArray.fields.length + 1}`,
                    brand: "",
                    model: "",
                    year: new Date().getFullYear(),
                    km: 0,
                    price: null,
                    transmission: "Automático",
                    fuel: "Flex",
                    color: "",
                    description: "",
                    thumbnail_url: "",
                    gallery_urls: ["", "", ""],
                    datasheet: [],
                    featured: false,
                  } as never)
                }
                data-testid="lead-site-edit-add-car"
              >
                <Plus className="size-4" aria-hidden="true" />
                Adicionar carro
              </Button>
            </div>
            {carsArray.fields.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Sem carros cadastrados. Adicione ao menos 4 antes de salvar.
              </p>
            ) : null}
            <ul className="flex flex-col gap-3">
              {carsArray.fields.map((field, index) => (
                <li
                  key={field.id}
                  className="rounded-lg border border-border p-3"
                  data-testid={`lead-site-edit-car-${index}`}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <strong className="text-sm">Carro {index + 1}</strong>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => carsArray.remove(index)}
                      aria-label={`Remover carro ${index + 1}`}
                      data-testid={`lead-site-edit-remove-car-${index}`}
                      disabled={carsArray.fields.length <= 4}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <Field
                      id={`${baseId}-car-${index}-brand`}
                      label="Marca"
                    >
                      <Input
                        id={`${baseId}-car-${index}-brand`}
                        {...register(`cars.${index}.brand` as const)}
                      />
                    </Field>
                    <Field
                      id={`${baseId}-car-${index}-model`}
                      label="Modelo"
                    >
                      <Input
                        id={`${baseId}-car-${index}-model`}
                        {...register(`cars.${index}.model` as const)}
                      />
                    </Field>
                    <Field id={`${baseId}-car-${index}-year`} label="Ano">
                      <Input
                        id={`${baseId}-car-${index}-year`}
                        type="number"
                        {...register(`cars.${index}.year` as const, {
                          valueAsNumber: true,
                        })}
                      />
                    </Field>
                    <Field id={`${baseId}-car-${index}-km`} label="Km">
                      <Input
                        id={`${baseId}-car-${index}-km`}
                        type="number"
                        {...register(`cars.${index}.km` as const, {
                          valueAsNumber: true,
                        })}
                      />
                    </Field>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
              data-testid="lead-site-edit-cancel"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              aria-busy={isPending}
              data-testid="lead-site-edit-submit"
            >
              {isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Salvando…
                </>
              ) : (
                "Salvar alterações"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
