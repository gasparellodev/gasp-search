import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: { EVOLUTION_API_URL: "http://x", EVOLUTION_API_KEY: "k" },
}));

const { normalizePhone, parseWebhookPayload, verifyHmac } = await import(
  "@/lib/evolution/webhook"
);

describe("verifyHmac", () => {
  it("aceita assinatura válida (com prefixo sha256=)", () => {
    const body = "{\"event\":\"test\"}";
    const secret = "topsecret123456789";
    const sig = createHmac("sha256", secret).update(body).digest("hex");
    expect(verifyHmac(body, `sha256=${sig}`, secret)).toBe(true);
  });

  it("aceita assinatura sem prefixo", () => {
    const body = "{}";
    const secret = "topsecret123456789";
    const sig = createHmac("sha256", secret).update(body).digest("hex");
    expect(verifyHmac(body, sig, secret)).toBe(true);
  });

  it("rejeita header ausente", () => {
    expect(verifyHmac("{}", null, "secret")).toBe(false);
  });

  it("rejeita assinatura inválida (mesmo tamanho)", () => {
    const body = "{}";
    const secret = "topsecret123456789";
    const wrong = "0".repeat(64);
    expect(verifyHmac(body, wrong, secret)).toBe(false);
  });

  it("rejeita assinatura com tamanho errado", () => {
    expect(verifyHmac("{}", "deadbeef", "secret")).toBe(false);
  });
});

describe("normalizePhone", () => {
  it("remove caracteres não-numéricos", () => {
    expect(normalizePhone("+55 (11) 99999-8888")).toBe("5511999998888");
  });
  it("rejeita string vazia ou nula", () => {
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone("")).toBeNull();
  });
  it("rejeita números muito curtos ou longos", () => {
    expect(normalizePhone("123")).toBeNull();
    expect(normalizePhone("1".repeat(20))).toBeNull();
  });
});

describe("parseWebhookPayload", () => {
  it("parseia messages.upsert com conversation", () => {
    const result = parseWebhookPayload({
      event: "messages.upsert",
      instance: "user_aabbccdd",
      data: {
        key: {
          id: "evo-msg-1",
          remoteJid: "5511999998888@s.whatsapp.net",
          fromMe: false,
        },
        message: { conversation: "Olá!" },
      },
    });
    expect(result).toEqual({
      type: "message.upsert",
      instance: "user_aabbccdd",
      messageId: "evo-msg-1",
      from: "5511999998888",
      content: "Olá!",
      fromMe: false,
    });
  });

  it("parseia messages.upsert com extendedTextMessage", () => {
    const result = parseWebhookPayload({
      event: "messages.upsert",
      instance: "u",
      data: {
        key: { id: "x", remoteJid: "5511999998888@s.whatsapp.net" },
        message: { extendedTextMessage: { text: "tudo bem?" } },
      },
    });
    expect(result.type).toBe("message.upsert");
    if (result.type === "message.upsert") {
      expect(result.content).toBe("tudo bem?");
      expect(result.fromMe).toBe(false);
    }
  });

  it("retorna unknown se messages.upsert sem id ou phone", () => {
    expect(
      parseWebhookPayload({
        event: "messages.upsert",
        instance: "u",
        data: { key: {}, message: { conversation: "x" } },
      }).type,
    ).toBe("unknown");
  });

  it("parseia message.status para sent/delivered/read/failed", () => {
    const cases: Array<[string, "sent" | "delivered" | "read" | "failed"]> = [
      ["PENDING", "sent"],
      ["DELIVERY_ACK", "delivered"],
      ["READ", "read"],
      ["ERROR", "failed"],
    ];
    for (const [raw, expected] of cases) {
      const r = parseWebhookPayload({
        event: "messages.update",
        instance: "u",
        data: { key: { id: "evo-1" }, status: raw },
      });
      expect(r.type).toBe("message.status");
      if (r.type === "message.status") expect(r.status).toBe(expected);
    }
  });

  it("retorna unknown em status desconhecido", () => {
    expect(
      parseWebhookPayload({
        event: "messages.update",
        instance: "u",
        data: { key: { id: "x" }, status: "WHATEVER" },
      }).type,
    ).toBe("unknown");
  });

  it("parseia connection.update com phone do owner JID", () => {
    const r = parseWebhookPayload({
      event: "connection.update",
      instance: "u",
      data: { state: "open", owner: "5511999998888@s.whatsapp.net" },
    });
    expect(r).toEqual({
      type: "connection.update",
      instance: "u",
      status: "open",
      phoneNumber: "5511999998888",
    });
  });

  it("parseia connection.update sem owner", () => {
    const r = parseWebhookPayload({
      event: "connection.update",
      instance: "u",
      data: { state: "close" },
    });
    expect(r.type).toBe("connection.update");
    if (r.type === "connection.update") {
      expect(r.status).toBe("close");
      expect(r.phoneNumber).toBeNull();
    }
  });

  it("retorna unknown para evento desconhecido ou payload sem event", () => {
    expect(parseWebhookPayload({ data: {} }).type).toBe("unknown");
    expect(parseWebhookPayload(null).type).toBe("unknown");
    expect(parseWebhookPayload("string").type).toBe("unknown");
  });
});
