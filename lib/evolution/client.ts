import "server-only";
import { env } from "@/lib/env";
import {
  evolutionInstanceCreateResponseSchema,
  evolutionInstanceStatusResponseSchema,
  evolutionQrResponseSchema,
  evolutionSendTextResponseSchema,
} from "@/lib/validators/whatsapp";

// ----------------------------------------------------------------------------
// Wrapper REST do Evolution API
// ----------------------------------------------------------------------------
//
// A Evolution API expõe endpoints REST autenticados via header `apikey`.
// Este módulo encapsula:
//   - construção de URL (sem barra final dupla)
//   - injeção de auth header
//   - mapeamento de erros HTTP / parse falho para EvolutionApiError tipada
//
// Toda função que faz I/O real é importada SEM mutação global; o factory
// devolve um objeto com métodos puros para facilitar testes (mock fetch).
// ----------------------------------------------------------------------------

export class EvolutionApiError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(message: string, options: { status: number; code: string }) {
    super(message);
    this.name = "EvolutionApiError";
    this.status = options.status;
    this.code = options.code;
  }
}

export type EvolutionStatus =
  | "disconnected"
  | "qr_pending"
  | "connecting"
  | "connected"
  | "error";

function normalizeStatus(raw: string | null | undefined): EvolutionStatus {
  if (!raw) return "disconnected";
  switch (raw) {
    case "open":
    case "connected":
      return "connected";
    case "connecting":
      return "connecting";
    case "qrReadError":
    case "qr":
    case "qrcode":
    case "qr_pending":
      return "qr_pending";
    case "close":
    case "disconnected":
    case "logout":
      return "disconnected";
    default:
      return "error";
  }
}

export type EvolutionInstanceCreated = {
  instanceName: string;
  status: EvolutionStatus;
  qrcode: string | null;
};

export type EvolutionQRCode = {
  qrcode: string | null;
  pairingCode: string | null;
};

export type EvolutionInstanceStatus = {
  status: EvolutionStatus;
  phoneNumber: string | null;
};

export type EvolutionSentMessage = {
  messageId: string;
  status: string | null;
};

export type EvolutionClient = {
  createInstance(name: string): Promise<EvolutionInstanceCreated>;
  getQRCode(instance: string): Promise<EvolutionQRCode>;
  sendText(
    instance: string,
    to: string,
    content: string,
  ): Promise<EvolutionSentMessage>;
  getStatus(instance: string): Promise<EvolutionInstanceStatus>;
  deleteInstance(instance: string): Promise<void>;
};

type FetchFn = typeof fetch;

type ClientOptions = {
  baseUrl?: string;
  apiKey?: string;
  fetch?: FetchFn;
};

function buildUrl(baseUrl: string, path: string): string {
  const trimmedBase = baseUrl.replace(/\/+$/, "");
  const trimmedPath = path.startsWith("/") ? path : `/${path}`;
  return `${trimmedBase}${trimmedPath}`;
}

function ensureApiKey(apiKey: string | undefined): string {
  if (!apiKey || apiKey.length === 0) {
    throw new EvolutionApiError(
      "EVOLUTION_API_KEY ausente. Habilite NEXT_PUBLIC_WHATSAPP_ENABLED=1 e configure a variável.",
      { status: 500, code: "EVOLUTION_API_KEY_MISSING" },
    );
  }
  return apiKey;
}

async function request<T>(
  fetchFn: FetchFn,
  url: string,
  apiKey: string,
  init: RequestInit,
  parse: (json: unknown) => T,
): Promise<T> {
  let response: Response;
  try {
    response = await fetchFn(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        accept: "application/json",
        apikey: apiKey,
        ...(init.headers ?? {}),
      },
    });
  } catch (cause) {
    throw new EvolutionApiError(
      cause instanceof Error ? cause.message : "Falha de rede no Evolution",
      { status: 0, code: "NETWORK_ERROR" },
    );
  }

  // Alguns endpoints (DELETE, por exemplo) retornam 200 com body vazio.
  // Lemos texto antes de JSON.parse para conseguir distinguir vazio de inválido.
  const text = await response.text();
  let payload: unknown = undefined;
  if (text.length > 0) {
    try {
      payload = JSON.parse(text);
    } catch {
      throw new EvolutionApiError(
        `Resposta do Evolution não é JSON válido (HTTP ${response.status}).`,
        { status: response.status, code: "INVALID_JSON" },
      );
    }
  }

  if (!response.ok) {
    let message = `Evolution respondeu HTTP ${response.status}`;
    if (
      payload &&
      typeof payload === "object" &&
      "message" in payload &&
      typeof (payload as { message: unknown }).message === "string"
    ) {
      message = `${message}: ${(payload as { message: string }).message}`;
    }
    throw new EvolutionApiError(message, {
      status: response.status,
      code: response.status === 401 ? "UNAUTHORIZED" : "HTTP_ERROR",
    });
  }

  try {
    return parse(payload ?? {});
  } catch (cause) {
    throw new EvolutionApiError(
      cause instanceof Error
        ? `Resposta do Evolution não bate com schema: ${cause.message}`
        : "Resposta do Evolution não bate com schema",
      { status: response.status, code: "SCHEMA_MISMATCH" },
    );
  }
}

export function createEvolutionClient(options: ClientOptions = {}): EvolutionClient {
  const baseUrl = options.baseUrl ?? env.EVOLUTION_API_URL;
  const apiKey = ensureApiKey(options.apiKey ?? env.EVOLUTION_API_KEY);
  const fetchFn = options.fetch ?? fetch;

  return {
    async createInstance(name) {
      const json = await request(
        fetchFn,
        buildUrl(baseUrl, "/instance/create"),
        apiKey,
        {
          method: "POST",
          body: JSON.stringify({
            instanceName: name,
            qrcode: true,
            integration: "WHATSAPP-BAILEYS",
          }),
        },
        (raw) => evolutionInstanceCreateResponseSchema.parse(raw),
      );

      return {
        instanceName: json.instance.instanceName,
        status: normalizeStatus(json.instance.status),
        qrcode: json.qrcode?.base64 ?? null,
      };
    },

    async getQRCode(instance) {
      const json = await request(
        fetchFn,
        buildUrl(baseUrl, `/instance/connect/${encodeURIComponent(instance)}`),
        apiKey,
        { method: "GET" },
        (raw) => evolutionQrResponseSchema.parse(raw),
      );
      return {
        qrcode: json.base64 ?? null,
        pairingCode: json.pairingCode ?? null,
      };
    },

    async sendText(instance, to, content) {
      if (!to || to.length === 0) {
        throw new EvolutionApiError("Número de destino vazio.", {
          status: 422,
          code: "INVALID_PHONE",
        });
      }
      const json = await request(
        fetchFn,
        buildUrl(baseUrl, `/message/sendText/${encodeURIComponent(instance)}`),
        apiKey,
        {
          method: "POST",
          body: JSON.stringify({ number: to, text: content }),
        },
        (raw) => evolutionSendTextResponseSchema.parse(raw),
      );
      return {
        messageId: json.key.id,
        status: json.status ?? null,
      };
    },

    async getStatus(instance) {
      const json = await request(
        fetchFn,
        buildUrl(
          baseUrl,
          `/instance/connectionState/${encodeURIComponent(instance)}`,
        ),
        apiKey,
        { method: "GET" },
        (raw) => evolutionInstanceStatusResponseSchema.parse(raw),
      );
      const state = json.instance?.state ?? json.state;
      const owner = json.instance?.owner ?? null;
      // owner geralmente vem no formato "<phone>@s.whatsapp.net".
      const phoneNumber = owner ? owner.split("@")[0] ?? null : null;
      return {
        status: normalizeStatus(state),
        phoneNumber,
      };
    },

    async deleteInstance(instance) {
      await request(
        fetchFn,
        buildUrl(baseUrl, `/instance/delete/${encodeURIComponent(instance)}`),
        apiKey,
        { method: "DELETE" },
        () => undefined,
      );
    },
  };
}
