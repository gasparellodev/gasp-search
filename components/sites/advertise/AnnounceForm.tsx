"use client";

import { useId, useRef, useState, useTransition, type FocusEvent } from "react";
import Link from "next/link";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import imageCompression from "browser-image-compression";
import { toast } from "sonner";

import {
  requestUploadUrl,
  submitAnnouncement,
} from "@/app/actions/site-announcement";
import {
  AnnouncementSchema,
  type AnnouncementInput,
} from "@/lib/sites/announcement.schema";
import { cn } from "@/lib/utils";

const STEPS = ["Carro", "Proprietário", "Fotos", "Revisão+LGPD"] as const;
const LGPD_CONSENT_TEXT =
  "Concordo com o tratamento dos meus dados pessoais para fins de avaliação de veículo, conforme a LGPD.";
const MAX_PHOTOS = 8;
const MIN_PHOTOS = 2;

interface AnnounceFormProps {
  siteId: string;
  slug: string;
  primary_color: string;
  text_on_primary: string;
  targetCarSlug?: string | null;
  formSignature?: string | null;
}

export function AnnounceForm({
  siteId,
  slug,
  primary_color,
  text_on_primary,
  targetCarSlug = null,
  formSignature = null,
}: AnnounceFormProps) {
  const [step, setStep] = useState(0);
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [honeypot, setHoneypot] = useState("");
  const [isPending, startTransition] = useTransition();
  const [submitted, setSubmitted] = useState(false);
  const baseId = useId();
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  const lastFocusedByStep = useRef<Record<number, HTMLElement | null>>({});

  const {
    register,
    handleSubmit,
    trigger,
    reset,
    getValues,
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
      car_target_slug: targetCarSlug ?? undefined,
      lgpd_consent: false as unknown as true,
    },
  });

  const buttonStyle = {
    backgroundColor: primary_color,
    color: text_on_primary,
  };

  async function goNext() {
    const fieldsByStep: (keyof AnnouncementInput)[][] = [
      ["marca", "modelo", "ano", "km", "preco", "mensagem"],
      ["nome", "telefone", "email"],
      [],
      ["lgpd_consent"],
    ];
    const fields = fieldsByStep[step] ?? [];
    const valid =
      fields.length === 0 ? true : await trigger(fields, { shouldFocus: true });
    if (!valid) return;
    if (step === 2 && photos.length < MIN_PHOTOS) {
      setPhotoError("Adicione pelo menos 2 fotos do veículo para continuar.");
      return;
    }
    setPhotoError(null);
    setStep((current) => Math.min(current + 1, STEPS.length - 1));
    window.requestAnimationFrame(() => stepHeadingRef.current?.focus());
  }

  function goBack() {
    const previousStep = Math.max(step - 1, 0);
    setStep(previousStep);
    window.requestAnimationFrame(() => {
      lastFocusedByStep.current[previousStep]?.focus();
    });
  }

  const onSubmit = handleSubmit((values) => {
    if (photos.length < MIN_PHOTOS) {
      setStep(2);
      setPhotoError("Adicione pelo menos 2 fotos do veículo para continuar.");
      return;
    }
    startTransition(async () => {
      try {
        const result = await submitAnnouncement(
          siteId,
          { ...values, car_target_slug: targetCarSlug ?? undefined },
          {
            honeypot,
            formSignature,
          },
        );
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        if (result.leadId) {
          await uploadPhotos(result.leadId, result.uploadToken, photos);
        }
        toast.success("Recebemos seu anúncio! Em breve entramos em contato.");
        setSubmitted(true);
        setPhotos([]);
        reset();
      } catch {
        toast.error("Não foi possível enviar o anúncio. Tente novamente.");
      }
    });
  });

  function rememberFocus(event: FocusEvent<HTMLElement>) {
    if (event.target instanceof HTMLElement) {
      lastFocusedByStep.current[step] = event.target;
    }
  }

  async function uploadPhotos(
    leadId: string,
    uploadToken: string | null,
    selectedPhotos: File[],
  ) {
    for (const [index, photo] of selectedPhotos.entries()) {
      const prepared = await preparePhotoForUpload(photo);
      const upload = await requestUploadUrl(siteId, {
        leadId,
        uploadToken,
        index,
        ext: extensionFromFile(prepared),
        mimeType: prepared.type,
        sizeBytes: prepared.size,
        magicHeader: await readMagicHeader(prepared),
      });

      if (!upload.ok) {
        throw new Error(upload.error);
      }

      const body = new FormData();
      body.append("cacheControl", "3600");
      body.append("", prepared);
      const response = await fetch(upload.signedUrl, {
        method: "PUT",
        body,
      });
      if (!response.ok) {
        throw new Error("upload_failed");
      }
    }
  }

  return (
    <form
      noValidate
      onSubmit={onSubmit}
      aria-label="Formulário para anunciar carro"
      className="rounded-site-feature border border-foreground/15 p-6 md:p-8"
      data-testid="announce-form"
    >
      <ol
        data-testid="announce-stepper"
        className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4"
      >
        {STEPS.map((label, index) => (
          <li
            key={label}
            aria-current={index === step ? "step" : undefined}
            className={cn(
              "rounded-md border px-3 py-2 text-center",
              index === step
                ? "border-foreground bg-foreground text-background"
                : "border-foreground/15 text-foreground/60",
            )}
          >
            {index + 1}. {label}
          </li>
        ))}
      </ol>

      <h2
        ref={stepHeadingRef}
        tabIndex={-1}
        className="mt-8 text-2xl font-semibold outline-none"
      >
        {STEPS[step]}
      </h2>

      {step === 0 && (
        <div
          className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2"
          onFocusCapture={rememberFocus}
        >
          <Field
            id={`${baseId}-marca`}
            label="Marca"
            error={errors.marca?.message}
            inputProps={{ type: "text", ...register("marca") }}
          />
          <Field
            id={`${baseId}-modelo`}
            label="Modelo"
            error={errors.modelo?.message}
            inputProps={{ type: "text", ...register("modelo") }}
          />
          <Field
            id={`${baseId}-ano`}
            label="Ano"
            error={errors.ano?.message}
            inputProps={{
              type: "number",
              inputMode: "numeric",
              ...register("ano", { valueAsNumber: true }),
            }}
          />
          <Field
            id={`${baseId}-km`}
            label="Quilometragem"
            error={errors.km?.message}
            inputProps={{
              type: "number",
              inputMode: "numeric",
              ...register("km", { valueAsNumber: true }),
            }}
          />
          <Field
            id={`${baseId}-preco`}
            label="Preço pretendido (opcional)"
            error={errors.preco?.message}
            inputProps={{
              type: "number",
              inputMode: "decimal",
              step: "0.01",
              ...register("preco", {
                setValueAs: (v: unknown) =>
                  v === "" || v == null ? null : Number(v),
              }),
            }}
          />
          <div className="md:col-span-2">
            <label htmlFor={`${baseId}-mensagem`} className="text-sm font-medium text-foreground/80">
              Mensagem (opcional)
            </label>
            <textarea
              id={`${baseId}-mensagem`}
              {...register("mensagem")}
              rows={4}
              className="mt-1 w-full rounded-md border border-foreground/20 bg-background px-4 py-3 text-sm"
            />
          </div>
        </div>
      )}

      {step === 1 && (
        <div
          className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2"
          onFocusCapture={rememberFocus}
        >
          <Field
            id={`${baseId}-nome`}
            label="Seu nome"
            error={errors.nome?.message}
            inputProps={{
              type: "text",
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
              autoComplete: "email",
              ...register("email"),
            }}
          />
        </div>
      )}

      {step === 2 && (
        <div className="mt-5" onFocusCapture={rememberFocus}>
          <div className="mb-4 flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 size-5 flex-none" aria-hidden="true" />
            <p>Borre a placa antes de enviar as fotos do veículo.</p>
          </div>
          <label htmlFor={`${baseId}-photos`} className="text-sm font-medium text-foreground/80">
            Fotos do veículo
          </label>
          <input
            id={`${baseId}-photos`}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic"
            multiple
            onChange={(event) => {
              const files = Array.from(event.currentTarget.files ?? []).slice(
                0,
                MAX_PHOTOS,
              );
              setPhotos(files);
              setPhotoError(null);
            }}
            className="mt-2 block w-full rounded-md border border-foreground/20 p-3 text-sm"
          />
          <p className="mt-2 text-sm text-foreground/60">
            Envie de 2 a 8 fotos. Selecionadas: {photos.length}.
          </p>
          {photoError && (
            <p role="alert" className="mt-2 text-sm text-red-600">
              {photoError}
            </p>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="mt-5 space-y-5" onFocusCapture={rememberFocus}>
          <dl className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
            <Summary label="Veículo" value={`${getValues("marca")} ${getValues("modelo")}`} />
            <Summary label="Ano" value={String(getValues("ano") || "")} />
            <Summary label="KM" value={String(getValues("km") || "")} />
            <Summary label="Fotos" value={`${photos.length} fotos`} />
          </dl>
          <div className="flex items-start gap-2">
            <input
              id={`${baseId}-lgpd`}
              type="checkbox"
              required
              {...register("lgpd_consent")}
              aria-describedby={errors.lgpd_consent ? `${baseId}-lgpd-error` : undefined}
              className="mt-1 size-4 cursor-pointer rounded border border-foreground/30 accent-foreground"
            />
            <label htmlFor={`${baseId}-lgpd`} className="text-xs text-foreground/70 md:text-sm">
              {LGPD_CONSENT_TEXT}{" "}
              <Link href={`/sites/${slug}/lgpd`} className="underline underline-offset-2">
                Política de Privacidade
              </Link>
            </label>
          </div>
          {errors.lgpd_consent?.message && (
            <p id={`${baseId}-lgpd-error`} role="alert" className="text-xs text-red-600">
              {errors.lgpd_consent.message}
            </p>
          )}
        </div>
      )}

      <input
        type="text"
        name="_hp_company"
        value={honeypot}
        onChange={(event) => setHoneypot(event.currentTarget.value)}
        tabIndex={-1}
        aria-hidden="true"
        className="hidden"
        autoComplete="off"
      />

      <div className="mt-8 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={goBack}
          disabled={step === 0}
          className="rounded-md border border-foreground/15 px-5 py-3 text-sm font-medium disabled:opacity-40"
        >
          Voltar
        </button>
        {step < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={goNext}
            style={buttonStyle}
            className="rounded-md px-5 py-3 text-sm font-medium"
          >
            Continuar
          </button>
        ) : (
          <button
            type="submit"
            disabled={isPending}
            style={buttonStyle}
            className="inline-flex min-h-12 items-center justify-center rounded-md px-8 text-sm font-medium disabled:opacity-60"
          >
            {isPending ? (
              <Loader2 className="size-5 animate-spin" aria-hidden="true" />
            ) : (
              "Enviar anúncio"
            )}
          </button>
        )}
      </div>

      {submitted && (
        <p role="status" aria-live="polite" className="mt-4 text-sm text-foreground/70">
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
          "h-12 rounded-md border bg-background px-4 text-sm text-foreground",
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

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-foreground/10 p-3">
      <dt className="text-xs uppercase text-foreground/50">{label}</dt>
      <dd className="mt-1 text-sm text-foreground">{value || "—"}</dd>
    </div>
  );
}

async function preparePhotoForUpload(file: File) {
  try {
    return await imageCompression(file, {
      maxWidthOrHeight: 1920,
      maxSizeMB: 5,
      useWebWorker: true,
    });
  } catch {
    return file;
  }
}

function extensionFromFile(file: File) {
  const fromName = file.name.split(".").pop();
  if (fromName) return fromName.toLowerCase();
  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/heic") return "heic";
  return "";
}

async function readMagicHeader(file: File) {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
