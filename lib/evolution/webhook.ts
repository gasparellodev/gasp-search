import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

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
//
// A função pura aqui não toca DB nem Evolution — apenas decodifica.
// ----------------------------------------------------------------------------

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
  | { type: "unknown"; raw: unknown };

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

export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d]/g, "");
  if (digits.length < 8 || digits.length > 15) return null;
  return digits;
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
 * Decodifica o payload bruto do webhook em um evento tipado.
 * Eventos não reconhecidos viram `{ type: 'unknown', raw }` — o handler
 * deve loggar e retornar 200 (acknowledgment).
 */
export function parseWebhookPayload(json: unknown): ParsedWebhookEvent {
  const root = asObject(json);
  if (!root) return { type: "unknown", raw: json };

  // Evolution costuma usar `event` ou `eventType` no envelope.
  const event = asString(root.event) ?? asString(root.eventType);
  const instance =
    asString(root.instance) ??
    asString(asObject(root.instance)?.instanceName) ??
    "";
  const data = asObject(root.data);

  if (!event || !data) return { type: "unknown", raw: json };

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
    if (!messageId || !phone || !content) return { type: "unknown", raw: json };
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
    if (!messageId || !rawStatus) return { type: "unknown", raw: json };
    const status = normalizeStatus(rawStatus);
    if (!status) return { type: "unknown", raw: json };
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
    return { type: "unknown", raw: json };
  }

  return { type: "unknown", raw: json };
}
