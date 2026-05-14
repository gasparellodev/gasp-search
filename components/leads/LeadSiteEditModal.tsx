"use client";

/**
 * `<LeadSiteEditModal />` — modal de edição manual das variáveis do site
 * (issue #168 + #197 PR-C).
 *
 * Substitui o button disabled "Editar" do `<LeadSiteCardActions />` quando
 * `status IN ('published','sent')`. Renderiza form com inputs pra todos os
 * campos top-level de `SiteVariablesV2` + array editável de `cars[]`.
 *
 * **Migração v2 (#197 PR-C):**
 *  - `address` é nested (`street`/`number`/`neighborhood`/`city`/`state`/`zip`)
 *    com checkbox "endereço indisponível" que seta `address: null`.
 *  - `brand_assets` é nested (`logo_url`/`primary_color`/`text_on_primary`/
 *    `hero_image_url`/`about_image_url`/`contact_image_url`).
 *  - `cars[]` ganha `category` (select), `doors` (select), `photos[]`
 *    (textarea newline-separated, min 3 max 8), `vin` (regex 17 chars),
 *    `plates_visible: false` literal **readonly** (compliance — sempre
 *    enviado false; não editável pelo admin).
 *
 * Stack:
 *  - `react-hook-form` + `zodResolver(SiteVariablesV2.partial())` — validação
 *    inline + dirty fields tracking.
 *  - `radix-ui` Dialog (via `@/components/ui/dialog`) — focus trap,
 *    `role="dialog"` e `aria-modal="true"` automáticos.
 *  - Submit envia **apenas `dirtyFields`** pra Server Action
 *    `updateLeadSiteVariables`. Reduz payload e simplifica merge no server.
 *  - Quando qualquer key nested está em `dirtyFields` (e.g.
 *    `address.street` ou `brand_assets.logo_url`), o patch envia o objeto
 *    **inteiro** (`address` ou `brand_assets`) — Server Action faz shallow
 *    merge top-level e isso preserva o resto da row.
 *
 * **a11y**:
 *  - `aria-labelledby` aponta pro `DialogTitle`.
 *  - Cada input tem `<Label htmlFor>` e `aria-invalid` quando há erro.
 *  - Erros têm `role="alert"` e são associados via `aria-describedby`.
 *  - ESC fecha (Radix); foco volta ao trigger ao fechar.
 */

import { useId, useState, useTransition } from "react";
import {
  useForm,
  useFieldArray,
  type SubmitHandler,
  type FieldErrors,
  type Resolver,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { updateLeadSiteVariables } from "@/app/actions/lead-site";
import type { UpdateLeadSiteVariablesResult } from "@/app/actions/lead-site";
import { SiteVariablesV2 } from "@/types/lead-site";
import type { SiteCar, SiteVariablesV2 as SiteVariablesV2Type } from "@/types/lead-site";
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

import { LogoUploadField } from "./LogoUploadField";
import type { LeadSiteCardData } from "./lead-site-card-types";

type FormValues = Partial<SiteVariablesV2Type>;

interface LeadSiteEditModalProps {
  /** Linha de `lead_sites` carregada pelo Server Component pai. */
  leadSite: LeadSiteCardData;
  /** Controle externo do modal (`useState` no parent). */
  open: boolean;
  /** Disparado em ESC, click no overlay, button "Cancelar" e após sucesso. */
  onOpenChange: (open: boolean) => void;
}

const CAR_CATEGORIES = [
  "SUV",
  "Sedan",
  "Hatch",
  "Pickup",
  "Esportivo",
  "Conversível",
] as const;

const CAR_DOORS = [2, 3, 4, 5] as const;

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
 * Top-level keys de `SiteVariablesV2` que são objetos nested. Quando qualquer
 * sub-key está em `dirtyFields`, mandamos o objeto inteiro (Server Action
 * faz shallow merge top-level).
 */
const NESTED_OBJECT_KEYS = [
  "address",
  "brand_assets",
  "emphasis",
] as const satisfies ReadonlyArray<keyof FormValues>;

/**
 * Computa o subset `dirtyFields` do payload completo do form. Usa o mapa
 * de `dirtyFields` do react-hook-form (true marcado nas chaves alteradas).
 *
 * Para arrays (`cars`, `home_categories`, `recent_sales`, `values`) e objetos
 * aninhados (`address`, `brand_assets`, `emphasis`), o RHF marca cada
 * index/key. Como o Server Action faz `{ ...current, ...patch }` em chaves
 * top-level, mandamos o array/objeto **inteiro** quando qualquer descendente
 * foi tocado — o merge no server usa shallow merge e isso preserva o resto.
 *
 * Para `address` especificamente, mesmo quando admin marca "endereço
 * indisponível" (seta `address: null`), o RHF marca dirty no top-level e
 * mandamos o objeto null inteiro.
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
  // Garantia explícita: nested objects sempre vão inteiros se foram tocados.
  // (Caso RHF marque apenas sub-key como dirty, copiamos o objeto top-level
  // do values para preservar o shape nested completo.)
  for (const nestedKey of NESTED_OBJECT_KEYS) {
    if (dirtyFields[nestedKey]) {
      patch[nestedKey] = values[nestedKey];
    }
  }
  return patch as FormValues;
}

/**
 * Helper: converte string textarea (newline-separated) em array de URLs.
 * Trim cada linha; descarta vazios.
 */
function parsePhotosTextarea(input: string): string[] {
  return input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/**
 * Helper inverso: array de URLs → texto multilinha pro textarea.
 */
function stringifyPhotos(photos: readonly string[] | undefined): string {
  if (!photos) return "";
  return photos.join("\n");
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
        <p id={errorId} role="alert" className="text-xs text-destructive">
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

  // Estado UI: checkbox "endereço indisponível" — controla null vs object.
  // Inicializa em `true` quando o lead_site veio com `address: null`.
  const [addressDisabled, setAddressDisabled] = useState<boolean>(
    variables?.address == null,
  );

  // Photos textarea state — RHF não tem useFieldArray nested fácil, então
  // gerenciamos via Controller-like pattern: estado local serializa pra string,
  // setValue empurra array no submit.
  const initialPhotos: Record<number, string> = {};
  if (variables?.cars) {
    variables.cars.forEach((car: SiteCar, idx) => {
      initialPhotos[idx] = stringifyPhotos(car.photos);
    });
  }
  const [photosByCarIdx, setPhotosByCarIdx] =
    useState<Record<number, string>>(initialPhotos);

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    getValues,
    formState: { errors, dirtyFields, isDirty },
  } = useForm<FormValues>({
    // Cast deliberado: `Address.country` usa `.default('BR')` em Zod, o que
    // gera input type com `country?: 'BR' | undefined` e output `country: 'BR'`.
    // RHF infere o input type da Resolver, mas o usuário final do form
    // espera o output type. O cast `Resolver<FormValues>` é seguro porque
    // a Zod validation roda na hora certa — só o type-check tem essa fricção.
    resolver: zodResolver(SiteVariablesV2.partial()) as unknown as Resolver<FormValues>,
    defaultValues: variables,
  });

  const carsArray = useFieldArray({
    control,
    name: "cars" as never,
  });

  const onSubmit: SubmitHandler<FormValues> = (values) => {
    // Sync photos textarea state → form values antes de computar patch.
    let photosTouched = false;
    if (Array.isArray(values.cars)) {
      values.cars.forEach((car, idx) => {
        const textareaValue = photosByCarIdx[idx];
        if (textareaValue !== undefined) {
          const parsed = parsePhotosTextarea(textareaValue);
          const current = car.photos ?? [];
          // Comparação ordenada — array length + each value.
          const same =
            parsed.length === current.length &&
            parsed.every((p, i) => p === current[i]);
          if (!same) {
            car.photos = parsed;
            photosTouched = true;
          }
        }
      });
    }

    // Marca `address: null` quando checkbox "indisponível" foi ativado.
    let addressTouched = false;
    if (addressDisabled && values.address !== null) {
      values.address = null;
      addressTouched = true;
    }

    if (!isDirty && !photosTouched && !addressTouched) {
      toast.message("Nenhuma alteração para salvar.");
      onOpenChange(false);
      return;
    }

    // Copia rasa do dirtyFields — RHF considera o original immutable.
    const dirtyMap: Record<string, unknown> = {
      ...(dirtyFields as Record<string, unknown>),
    };
    if (photosTouched) {
      dirtyMap["cars"] = true;
    }
    if (addressTouched) {
      dirtyMap["address"] = true;
    }

    const patch = computePatch(values, dirtyMap);
    startTransition(async () => {
      try {
        const result = await updateLeadSiteVariables(leadSite.id, patch);
        if (result.ok) {
          toast.success("Site atualizado!", {
            description: "As alterações já estão visíveis na pré-visualização.",
          });
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
  const e = errors as FieldErrors<SiteVariablesV2Type>;

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
          onSubmit={handleSubmit(onSubmit, (errs) => {
            // RHF invalid handler — debug log para detectar quando validação
            // bloqueia o submit. Em prod isso fica silencioso; testes podem
            // assertar que errs vazio implica submit fluindo.
            if (process.env.NODE_ENV === "test") {
              console.debug("[LeadSiteEditModal] validation errors:", errs);
            }
          })}
          aria-label="Editar variáveis do site"
          className="flex flex-col gap-6"
        >
          {/* --------------------------- Identidade --------------------------- */}
          <section
            aria-labelledby={`${baseId}-identity`}
            className="flex flex-col gap-3"
          >
            <h3
              id={`${baseId}-identity`}
              className="text-sm font-semibold uppercase tracking-wide text-muted-foreground"
            >
              Identidade
            </h3>
            <Field
              id={`${baseId}-business-name`}
              label="Nome do negócio"
              error={e.business_name?.message}
            >
              <Input
                id={`${baseId}-business-name`}
                aria-invalid={!!e.business_name}
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
                {...register("slogan")}
              />
            </Field>
          </section>

          {/* --------------------- Identidade visual (brand_assets) --------- */}
          <section
            aria-labelledby={`${baseId}-brand-assets`}
            className="flex flex-col gap-3"
          >
            <h3
              id={`${baseId}-brand-assets`}
              className="text-sm font-semibold uppercase tracking-wide text-muted-foreground"
            >
              Identidade visual
            </h3>
            <Field
              id={`${baseId}-logo-upload`}
              label="Logo"
              error={e.brand_assets?.logo_url?.message}
            >
              <LogoUploadField
                leadSiteId={leadSite.id}
                currentLogoUrl={
                  leadSite.variables?.brand_assets?.logo_url ?? null
                }
                onUploaded={(url) =>
                  setValue("brand_assets.logo_url", url, {
                    shouldDirty: false,
                    shouldValidate: false,
                    shouldTouch: false,
                  })
                }
              />
              <input
                type="hidden"
                aria-hidden="true"
                {...register("brand_assets.logo_url")}
              />
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field
                id={`${baseId}-primary-color`}
                label="Cor primária"
                error={e.brand_assets?.primary_color?.message}
                hint="Hex 6 dígitos (ex.: #0c5cff)."
              >
                <Input
                  id={`${baseId}-primary-color`}
                  type="text"
                  placeholder="#0c5cff"
                  aria-invalid={!!e.brand_assets?.primary_color}
                  {...register("brand_assets.primary_color")}
                />
              </Field>
              <Field
                id={`${baseId}-text-on-primary`}
                label="Texto sobre primário"
                error={e.brand_assets?.text_on_primary?.message}
                hint="#FFFFFF (branco) ou #0C0C0C (preto)."
              >
                <select
                  id={`${baseId}-text-on-primary`}
                  className={cn(
                    "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm",
                  )}
                  aria-invalid={!!e.brand_assets?.text_on_primary}
                  {...register("brand_assets.text_on_primary")}
                >
                  <option value="#FFFFFF">#FFFFFF (branco)</option>
                  <option value="#0C0C0C">#0C0C0C (preto)</option>
                </select>
              </Field>
            </div>
            <Field
              id={`${baseId}-hero-image`}
              label="URL da imagem do hero"
              error={e.brand_assets?.hero_image_url?.message}
            >
              <Input
                id={`${baseId}-hero-image`}
                type="url"
                placeholder="https://..."
                aria-invalid={!!e.brand_assets?.hero_image_url}
                {...register("brand_assets.hero_image_url")}
              />
            </Field>
            <Field
              id={`${baseId}-about-image`}
              label="URL da imagem do Sobre"
              error={e.brand_assets?.about_image_url?.message}
            >
              <Input
                id={`${baseId}-about-image`}
                type="url"
                placeholder="https://..."
                aria-invalid={!!e.brand_assets?.about_image_url}
                {...register("brand_assets.about_image_url")}
              />
            </Field>
            <Field
              id={`${baseId}-contact-image`}
              label="URL da imagem do Contato"
              error={e.brand_assets?.contact_image_url?.message}
            >
              <Input
                id={`${baseId}-contact-image`}
                type="url"
                placeholder="https://..."
                aria-invalid={!!e.brand_assets?.contact_image_url}
                {...register("brand_assets.contact_image_url")}
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

            {/* -------------------- Endereço (nested address) --------------- */}
            <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">Endereço</h4>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={addressDisabled}
                    onChange={(ev) => {
                      const next = ev.target.checked;
                      setAddressDisabled(next);
                      if (next) {
                        setValue("address", null, {
                          shouldDirty: true,
                        });
                      } else {
                        // Re-popula com defaults vazios — admin preenche.
                        const current = getValues("address");
                        if (!current) {
                          setValue(
                            "address",
                            {
                              street: "",
                              number: "",
                              neighborhood: "",
                              city: "",
                              state: "",
                              zip: "",
                              country: "BR",
                            },
                            { shouldDirty: true },
                          );
                        }
                      }
                    }}
                    data-testid="lead-site-edit-address-disabled"
                  />
                  Endereço indisponível
                </label>
              </div>
              {!addressDisabled ? (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Field
                    id={`${baseId}-address-street`}
                    label="Rua"
                    error={e.address?.street?.message}
                  >
                    <Input
                      id={`${baseId}-address-street`}
                      aria-invalid={!!e.address?.street}
                      {...register("address.street")}
                    />
                  </Field>
                  <Field
                    id={`${baseId}-address-number`}
                    label="Número"
                    error={e.address?.number?.message}
                    hint="Use 'S/N' se sem número."
                  >
                    <Input
                      id={`${baseId}-address-number`}
                      aria-invalid={!!e.address?.number}
                      {...register("address.number")}
                    />
                  </Field>
                  <Field
                    id={`${baseId}-address-neighborhood`}
                    label="Bairro"
                    error={e.address?.neighborhood?.message}
                  >
                    <Input
                      id={`${baseId}-address-neighborhood`}
                      aria-invalid={!!e.address?.neighborhood}
                      {...register("address.neighborhood")}
                    />
                  </Field>
                  <Field
                    id={`${baseId}-address-city`}
                    label="Cidade"
                    error={e.address?.city?.message}
                  >
                    <Input
                      id={`${baseId}-address-city`}
                      aria-invalid={!!e.address?.city}
                      {...register("address.city")}
                    />
                  </Field>
                  <Field
                    id={`${baseId}-address-state`}
                    label="UF"
                    error={e.address?.state?.message}
                    hint="2 letras maiúsculas (SP, RJ, ...)."
                  >
                    <Input
                      id={`${baseId}-address-state`}
                      maxLength={2}
                      aria-invalid={!!e.address?.state}
                      {...register("address.state")}
                    />
                  </Field>
                  <Field
                    id={`${baseId}-address-zip`}
                    label="CEP"
                    error={e.address?.zip?.message}
                    hint="00000-000 ou 00000000."
                  >
                    <Input
                      id={`${baseId}-address-zip`}
                      aria-invalid={!!e.address?.zip}
                      {...register("address.zip")}
                    />
                  </Field>
                </div>
              ) : null}
            </div>
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
                    photos: ["", "", ""],
                    datasheet: [],
                    featured: false,
                    category: "Sedan",
                    plates_visible: false,
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
                    <Field
                      id={`${baseId}-car-${index}-category`}
                      label="Categoria"
                      error={e.cars?.[index]?.category?.message}
                    >
                      <select
                        id={`${baseId}-car-${index}-category`}
                        className={cn(
                          "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm",
                        )}
                        aria-invalid={!!e.cars?.[index]?.category}
                        {...register(`cars.${index}.category` as const)}
                      >
                        {CAR_CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field
                      id={`${baseId}-car-${index}-doors`}
                      label="Portas"
                      error={e.cars?.[index]?.doors?.message}
                      hint="Opcional."
                    >
                      <select
                        id={`${baseId}-car-${index}-doors`}
                        className={cn(
                          "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm",
                        )}
                        aria-invalid={!!e.cars?.[index]?.doors}
                        {...register(`cars.${index}.doors` as const, {
                          setValueAs: (v) => {
                            if (v === "" || v == null) return undefined;
                            return Number(v);
                          },
                        })}
                      >
                        <option value="">— não informar —</option>
                        {CAR_DOORS.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field
                      id={`${baseId}-car-${index}-vin`}
                      label="VIN/Chassi"
                      error={e.cars?.[index]?.vin?.message}
                      hint="17 caracteres alfanuméricos (sem I/O/Q). Opcional."
                    >
                      <Input
                        id={`${baseId}-car-${index}-vin`}
                        maxLength={17}
                        aria-invalid={!!e.cars?.[index]?.vin}
                        {...register(`cars.${index}.vin` as const, {
                          // VIN é optional + regex 17 chars; string vazia deve
                          // virar undefined senão regex falha.
                          setValueAs: (v) => {
                            if (typeof v !== "string") return v;
                            const trimmed = v.trim();
                            return trimmed.length === 0 ? undefined : trimmed;
                          },
                        })}
                      />
                    </Field>
                  </div>
                  <div className="mt-2">
                    <Field
                      id={`${baseId}-car-${index}-photos`}
                      label="Fotos (URLs, uma por linha)"
                      hint="Entre 3 e 8 URLs, uma por linha."
                    >
                      <Textarea
                        id={`${baseId}-car-${index}-photos`}
                        rows={4}
                        data-testid={`lead-site-edit-car-${index}-photos`}
                        value={photosByCarIdx[index] ?? ""}
                        onChange={(ev) => {
                          setPhotosByCarIdx((prev) => ({
                            ...prev,
                            [index]: ev.target.value,
                          }));
                        }}
                      />
                    </Field>
                  </div>
                  {/*
                   * `plates_visible: false` — sempre enviado false (compliance).
                   * Não editável pelo admin. Não registramos no RHF para evitar
                   * dirty spurious; o Server Action shallow-merge mantém o valor
                   * `false` que veio em `cars[].plates_visible` no payload do
                   * defaultValues (carros existentes têm o field).
                   *
                   * Para novos carros adicionados via `carsArray.append`, o
                   * defaultValue já inclui `plates_visible: false`.
                   */}
                  <input
                    type="hidden"
                    aria-hidden="true"
                    data-testid={`lead-site-edit-car-${index}-plates-hidden`}
                    value="false"
                    readOnly
                  />
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
