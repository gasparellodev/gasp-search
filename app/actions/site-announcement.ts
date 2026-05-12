"use server";

/**
 * Server Actions do fluxo `/sites/[slug]/anunciar` (Phase 7 — #231).
 *
 * `submitAnnouncement` persiste a submissão em `lead_form_submissions`,
 * grava auditoria LGPD em `consent_logs` e devolve um token curto para
 * upload das fotos. `requestUploadUrl` valida metadados + magic bytes dos
 * arquivos e gera URL assinada para o bucket privado `tradein-photos`.
 */

import "server-only";

import { headers } from "next/headers";

import {
  AnnouncementSchema,
  type AnnouncementInput,
} from "@/lib/sites/announcement.schema";
import {
  createAnnouncementUploadToken,
  verifyAnnouncementFormSignature,
  verifyAnnouncementUploadToken,
  verifySameOrigin,
} from "@/lib/sites/announcement-security";
import {
  buildTradeinPhotoPath,
  validateTradeinUploadRequest,
} from "@/lib/sites/tradein-upload";
import { readSiteVariablesSafe } from "@/lib/sites/migrate-variables";
import { createServiceSupabase } from "@/lib/supabase/service";

const RATE_LIMIT_PER_HOUR = 3;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const LGPD_CONSENT_TEXT =
  "Concordo com o tratamento dos meus dados pessoais para fins de avaliação de veículo, conforme a LGPD.";

const submitRateLimit = new Map<string, number[]>();

export interface SubmitAnnouncementExtras {
  honeypot?: string;
  formSignature?: string | null;
}

export type SubmitAnnouncementResult =
  | { ok: true; leadId: string; uploadToken: string | null }
  | { ok: false; error: string };

export interface RequestUploadUrlInput {
  leadId: string;
  uploadToken?: string | null;
  index: number;
  ext: string;
  mimeType: string;
  sizeBytes: number;
  magicHeader: string;
}

export type RequestUploadUrlResult =
  | { ok: true; path: string; signedUrl: string }
  | { ok: false; error: string };

export async function submitAnnouncement(
  siteId: string,
  payload: AnnouncementInput,
  extras: SubmitAnnouncementExtras = {},
): Promise<SubmitAnnouncementResult> {
  if (typeof siteId !== "string" || siteId.length === 0) {
    return { ok: false, error: "siteId inválido" };
  }

  const parsed = AnnouncementSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Payload inválido",
    };
  }

  if (typeof extras.honeypot === "string" && extras.honeypot.length > 0) {
    console.warn("submitAnnouncement:honeypot_tripped", { lead_site_id: siteId });
    return { ok: true, leadId: "", uploadToken: null };
  }

  const hdrs = await headers();
  if (!verifySameOrigin(hdrs.get("origin"))) {
    return { ok: false, error: "Origem inválida" };
  }

  if (
    !verifyAnnouncementFormSignature({
      siteId,
      targetSlug: parsed.data.car_target_slug ?? null,
      signature: extras.formSignature,
    })
  ) {
    return { ok: false, error: "Assinatura inválida" };
  }

  const ip = resolveClientIp(hdrs);
  if (ip && isRateLimited(ip)) {
    return { ok: false, error: "Muitas tentativas. Tente novamente em 1 hora." };
  }

  const supabase = createServiceSupabase();
  const siteLookup = await supabase
    .from("lead_sites")
    .select("id, user_id, variables")
    .eq("id", siteId)
    .maybeSingle();

  const siteRow = siteLookup.data as
    | { id: string; user_id: string; variables: unknown }
    | null
    | undefined;

  if (siteLookup.error || !siteRow) {
    return { ok: false, error: "Site não encontrado" };
  }

  const targetLabel = resolveTargetCarLabel(
    siteRow.variables,
    parsed.data.car_target_slug,
  );

  const insertResult = await supabase
    .from("lead_form_submissions")
    .insert({
      user_id: siteRow.user_id,
      lead_site_id: siteRow.id,
      name: parsed.data.nome,
      phone: parsed.data.telefone,
      email: parsed.data.email,
      model: `${parsed.data.marca} ${parsed.data.modelo} ${parsed.data.ano}`,
      message: buildAnnouncementMessage(parsed.data, targetLabel),
      consent_text: LGPD_CONSENT_TEXT,
      consent_ip: ip,
      consent_user_agent: hdrs.get("user-agent") ?? null,
      consent_timestamp: new Date().toISOString(),
    })
    .select("id")
    .single();

  const inserted = insertResult.data as { id: string } | null | undefined;
  if (insertResult.error || !inserted) {
    console.warn("submitAnnouncement:insert_error", {
      lead_site_id: siteId,
      error_message: insertResult.error?.message ?? "missing inserted row",
    });
    return { ok: false, error: "Erro ao registrar anúncio. Tente novamente." };
  }

  const consentResult = await supabase.from("consent_logs").insert({
    user_id: siteRow.user_id,
    ip,
    user_agent: hdrs.get("user-agent") ?? null,
    timestamp: new Date().toISOString(),
    consent_text: LGPD_CONSENT_TEXT,
    version: "tradein_submission_v1",
    action: "accept_selected",
    categories: {
      necessary: true,
      analytics: false,
      marketing: false,
      purpose: "tradein_submission",
      lead_id: inserted.id,
    },
  });

  if (consentResult.error) {
    await supabase.from("lead_form_submissions").delete().eq("id", inserted.id);
    console.warn("submitAnnouncement:consent_insert_error", {
      lead_site_id: siteId,
      error_message: consentResult.error.message,
    });
    return { ok: false, error: "Erro ao registrar consentimento. Tente novamente." };
  }

  return {
    ok: true,
    leadId: inserted.id,
    uploadToken: createAnnouncementUploadToken({ siteId, leadId: inserted.id }),
  };
}

export async function requestUploadUrl(
  siteId: string,
  input: RequestUploadUrlInput,
): Promise<RequestUploadUrlResult> {
  const hdrs = await headers();
  if (!verifySameOrigin(hdrs.get("origin"))) {
    return { ok: false, error: "Origem inválida" };
  }
  if (typeof siteId !== "string" || siteId.length === 0) {
    return { ok: false, error: "siteId inválido" };
  }
  if (
    !verifyAnnouncementUploadToken({
      siteId,
      leadId: input.leadId,
      token: input.uploadToken,
    })
  ) {
    return { ok: false, error: "Token de upload inválido" };
  }

  const validation = validateTradeinUploadRequest(input);
  if (!validation.ok) return validation;

  const supabase = createServiceSupabase();
  const submissionLookup = await supabase
    .from("lead_form_submissions")
    .select("id, lead_site_id")
    .eq("id", input.leadId)
    .eq("lead_site_id", siteId)
    .maybeSingle();

  if (submissionLookup.error || !submissionLookup.data) {
    return { ok: false, error: "Anúncio não encontrado" };
  }

  const path = buildTradeinPhotoPath({
    leadId: input.leadId,
    index: input.index,
    timestamp: Date.now(),
    ext: validation.ext,
  });
  const signed = await supabase.storage
    .from("tradein-photos")
    .createSignedUploadUrl(path, { upsert: false });

  if (signed.error || !signed.data?.signedUrl) {
    console.warn("requestUploadUrl:signed_url_error", {
      lead_site_id: siteId,
      error_message: signed.error?.message ?? "missing signedUrl",
    });
    return { ok: false, error: "Erro ao preparar upload. Tente novamente." };
  }

  return { ok: true, path, signedUrl: signed.data.signedUrl };
}

export async function _resetAnnouncementRateLimitForTests() {
  submitRateLimit.clear();
}

function isRateLimited(ip: string) {
  const now = Date.now();
  const recent = (submitRateLimit.get(ip) ?? []).filter(
    (timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS,
  );
  if (recent.length >= RATE_LIMIT_PER_HOUR) {
    submitRateLimit.set(ip, recent);
    return true;
  }
  recent.push(now);
  submitRateLimit.set(ip, recent);
  return false;
}

function resolveClientIp(hdrs: Headers): string | null {
  const xff = hdrs.get("x-forwarded-for");
  if (xff && xff.length > 0) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const xri = hdrs.get("x-real-ip");
  return xri && xri.length > 0 ? xri.trim() : null;
}

function resolveTargetCarLabel(variables: unknown, targetSlug?: string) {
  if (!targetSlug) return null;
  const parsed = readSiteVariablesSafe(variables);
  if (!parsed.success) return null;
  const car = parsed.data.cars.find((item) => item.slug === targetSlug);
  if (!car) return null;
  return `${car.brand} ${car.model} ${car.year}`;
}

function buildAnnouncementMessage(
  payload: AnnouncementInput,
  targetLabel: string | null,
) {
  const lines = [
    `Veículo anunciado: ${payload.marca} ${payload.modelo} ${payload.ano}`,
    `Quilometragem: ${payload.km}`,
    payload.preco == null ? null : `Preço pretendido: ${payload.preco}`,
    targetLabel ? `Entrada para: ${targetLabel}` : null,
    payload.mensagem ? `Mensagem: ${payload.mensagem}` : null,
  ];
  return lines.filter(Boolean).join("\n");
}
