import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

import { nanoid } from "nanoid";

import { normalizePhone } from "@/lib/evolution/phone";

// Reexport pra manter compat com importers existentes (`route.ts` do webhook
// e specs antigos). A implementação canônica vive em `@/lib/evolution/phone`
// — ver #138a. Evita reintroduzir critério divergente entre send/webhook.
export { normalizePhone };

// ----------------------------------------------------------------------------
// Parser e validação de webhooks do Evolution API.
// ----------------------------------------------------------------------------
// O Evolution dispara eventos em uma URL configurada (WEBHOOK_GLOBAL_URL no
// docker-compose.yml). Este módulo é responsável por:
//
//   1. Verificar HMAC do header de assinatura (config local nossa, fora do
//      Evolution — o handler calcula HMAC do raw body com EVOLUTION_WEBHOOK_SECRET
//      e compara constante-time).
//   2. Parsear o payload bruto pra um union type discriminado fácil de consumir.
//   3. Normalizar phones (remove +, espaços, etc.) pra E.164 sem +.
//   4. Gerar slug não-previsível (`generateInstanceSlug`) para novas
//      instâncias Evolution — fecha o vetor de enumeração descrito em #130.
//
// A função pura aqui não toca DB nem Evolution — apenas decodifica.
// ----------------------------------------------------------------------------

/**
 * Tamanho do slug de instância em chars. 16 chars do alfabeto URL-safe
 * nanoid (`A-Za-z0-9_-`) = 64^16 ≈ 7.9e28 combinações (~95 bits). Resiste
 * a enumeração mesmo com taxas absurdas (1M req/s levariam ~10^15 anos).
 *
 * **Por que não usar `user_${userId.slice(0, 8)}`?** O slug legado tinha
 * 32 bits efetivos (8 hex chars), enumerável em minutos por um atacante
 * com acesso ao webhook público (#130).
 */
const INSTANCE_SLUG_LENGTH = 16;

/**
 * Gera um slug seguro para uma nova instância Evolution.
 *
 * Persiste em `whatsapp_instances.evo_instance_v2` (migration 0022).
 * Não inclui informação derivável do `user_id`: o lookup contra o DB é o
 * que liga o slug ao tenant via `lookupUserByInstance` no route handler.
 */
export function generateInstanceSlug(): string {
  return nanoid(INSTANCE_SLUG_LENGTH);
}

export type ParsedWebhookEvent =
  | {
      type: "message.upsert";
      instance: string;
      messageId: string;
      from: string; // phone normalizado E.164 sem '+'
      content: string;
      fromMe: boolean;
    }
  | {
      type: "message.status";
      instance: string;
      messageId: string;
      status: "sent" | "delivered" | "read" | "failed";
    }
  | {
      type: "connection.update";
      instance: string;
      status: "open" | "close" | "connecting" | "qrReadError";
      phoneNumber: string | null;
    }
  | { type: "unknown"; instance: string | null; raw: unknown };

export function verifyHmac(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): boolean {
  if (!signatureHeader) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  // Strip prefixos comuns ("sha256=...") tolerando que o Evolution mande
  // com ou sem prefixo.
  const provided = signatureHeader.replace(/^sha256=/, "").trim();
  if (provided.length !== expected.length) return false;
  try {
    return timingSafeEqual(
      Buffer.from(provided, "hex"),
      Buffer.from(expected, "hex"),
    );
  } catch {
    return false;
  }
}

const STATUS_MAP: Record<string, "sent" | "delivered" | "read" | "failed"> = {
  PENDING: "sent",
  SERVER_ACK: "sent",
  DELIVERY_ACK: "delivered",
  READ: "read",
  PLAYED: "read",
  ERROR: "failed",
};

function normalizeStatus(
  raw: string,
): "sent" | "delivered" | "read" | "failed" | null {
  const upper = raw.toUpperCase();
  return STATUS_MAP[upper] ?? null;
}

function jidPhone(jid: string | undefined | null): string | null {
  if (!jid || typeof jid !== "string") return null;
  const local = jid.split("@")[0];
  return normalizePhone(local);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function asObject(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/**
 * Extrai o nome da instância Evolution do envelope raiz, aceitando tanto
 * a forma string (`instance: "slug"`) quanto a forma objeto que algumas
 * versões do Evolution mandam (`instance: { instanceName: "slug" }`).
 *
 * Exportado e usado pelo route handler para `lookupUserByInstance` em
 * todos os tipos de evento, **inclusive `unknown`**. Sem isso, o caminho
 * de unknown short-circuita antes do lookup e vaza presença de HMAC
 * para atacantes não autenticados (#130).
 */
export function extractInstanceFromRoot(json: unknown): string | null {
  const root = asObject(json);
  if (!root) return null;
  const direct = asString(root.instance);
  if (direct) return direct;
  const nested = asObject(root.instance);
  if (nested) {
    const name = asString(nested.instanceName);
    if (name) return name;
  }
  return null;
}

/**
 * Decodifica o payload bruto do webhook em um evento tipado.
 * Eventos não reconhecidos viram `{ type: 'unknown', instance, raw }` —
 * o handler do route faz `lookupUserByInstance(instance)` ANTES de
 * acknowledgement (#130).
 */
export function parseWebhookPayload(json: unknown): ParsedWebhookEvent {
  const root = asObject(json);
  if (!root) return { type: "unknown", instance: null, raw: json };

  // Evolution costuma usar `event` ou `eventType` no envelope.
  const event = asString(root.event) ?? asString(root.eventType);
  const instanceCandidate = extractInstanceFromRoot(root);
  const instance = instanceCandidate ?? "";
  const data = asObject(root.data);

  if (!event || !data) {
    return { type: "unknown", instance: instanceCandidate, raw: json };
  }

  if (event === "messages.upsert" || event === "message.upsert") {
    const key = asObject(data.key);
    const messageId = asString(key?.id);
    const remoteJid = asString(key?.remoteJid);
    const fromMe = asBoolean(key?.fromMe) ?? false;
    const message = asObject(data.message);
    const content =
      asString(message?.conversation) ??
      asString(asObject(message?.extendedTextMessage)?.text) ??
      "";
    const phone = jidPhone(remoteJid);
    if (!messageId || !phone || !content) {
      return { type: "unknown", instance: instanceCandidate, raw: json };
    }
    return {
      type: "message.upsert",
      instance,
      messageId,
      from: phone,
      content,
      fromMe,
    };
  }

  if (
    event === "messages.update" ||
    event === "message.status" ||
    event === "messages.status"
  ) {
    const key = asObject(data.key);
    const messageId = asString(key?.id) ?? asString(data.messageId);
    const rawStatus = asString(data.status) ?? asString(data.update);
    if (!messageId || !rawStatus) {
      return { type: "unknown", instance: instanceCandidate, raw: json };
    }
    const status = normalizeStatus(rawStatus);
    if (!status) {
      return { type: "unknown", instance: instanceCandidate, raw: json };
    }
    return { type: "message.status", instance, messageId, status };
  }

  if (event === "connection.update") {
    const stateRaw = asString(data.state) ?? asString(data.status);
    if (
      stateRaw === "open" ||
      stateRaw === "close" ||
      stateRaw === "connecting" ||
      stateRaw === "qrReadError"
    ) {
      const owner = asString(data.owner) ?? asString(data.wid);
      return {
        type: "connection.update",
        instance,
        status: stateRaw,
        phoneNumber: jidPhone(owner),
      };
    }
    return { type: "unknown", instance: instanceCandidate, raw: json };
  }

  return { type: "unknown", instance: instanceCandidate, raw: json };
}
