import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Cenários de segurança HIGH para /api/whatsapp/webhook (issue #130):
//
// 1. message.status update tem que ser escopado por user_id (cross-tenant flip).
// 2. Eventos unknown NÃO devem short-circuitar antes do lookup quando o
//    request chega sem HMAC — caso contrário a resposta vaza "HMAC está
//    configurado" para qualquer atacante.

vi.mock("@/lib/env", () => ({
  env: {
    NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "service-key",
    EVOLUTION_API_URL: "http://x",
    EVOLUTION_API_KEY: "k",
    EVOLUTION_WEBHOOK_SECRET: "topsecret123456789",
  },
}));

const serviceMocks = vi.hoisted(() => ({
  createServiceSupabase: vi.fn(),
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceSupabase: serviceMocks.createServiceSupabase,
}));

function makeBody(payload: Record<string, unknown>): string {
  return JSON.stringify(payload);
}

function sigHeader(body: string, secret = "topsecret123456789") {
  return createHmac("sha256", secret).update(body).digest("hex");
}

function makeReq(body: string, sig: string | null) {
  const headers = new Headers({ "content-type": "application/json" });
  if (sig) headers.set("x-evolution-signature", sig);
  return new Request("http://localhost/api/whatsapp/webhook", {
    method: "POST",
    headers,
    body,
  });
}

type SelectStub = { data: unknown; error?: unknown };
type UpdateCall = {
  table: string;
  payload: unknown;
  filters: Array<{ column: string; value: unknown }>;
};

function makeClient(tables: Record<string, SelectStub>) {
  const updateCalls: UpdateCall[] = [];

  const buildSelect = (table: string) => {
    const stub = tables[table] ?? { data: null };
    const maybeSingle = vi.fn(async () => ({
      data: stub.data,
      error: stub.error ?? null,
    }));
    const eqChain = {
      maybeSingle,
      eq: vi.fn(() => eqChain),
      then: (resolve: (v: { data: unknown; error: null }) => void) =>
        resolve({ data: stub.data, error: null }),
    };
    return {
      eq: vi.fn(() => eqChain),
    };
  };

  const from = vi.fn((table: string) => ({
    select: () => buildSelect(table),
    update: vi.fn((payload: unknown) => {
      const filters: Array<{ column: string; value: unknown }> = [];
      const builder: {
        eq: (column: string, value: unknown) => typeof builder;
        then: (resolve: (v: { error: null }) => void) => void;
      } = {
        eq(column: string, value: unknown) {
          filters.push({ column, value });
          return builder;
        },
        then(resolve) {
          updateCalls.push({ table, payload, filters });
          resolve({ error: null });
        },
      };
      return builder;
    }),
    insert: vi.fn(async () => ({ error: null })),
  }));

  return { client: { from }, updateCalls };
}

beforeEach(() => {
  vi.resetModules();
  serviceMocks.createServiceSupabase.mockReset();
});

describe("POST /api/whatsapp/webhook — auth hardening (#130)", () => {
  it("update de message.status SEMPRE filtra por user_id resolvido (cross-tenant flip blocked)", async () => {
    const body = makeBody({
      event: "messages.update",
      instance: "victim_instance_v2",
      data: { key: { id: "evo-msg-victim" }, status: "READ" },
    });
    const { client, updateCalls } = makeClient({
      whatsapp_instances: {
        data: { user_id: "owner-user", status: "connected" },
      },
    });
    serviceMocks.createServiceSupabase.mockReturnValue(client);
    const { POST } = await import("@/app/api/whatsapp/webhook/route");
    const res = await POST(makeReq(body, sigHeader(body)));
    expect(res.status).toBe(200);

    const statusUpdate = updateCalls.find((c) => c.table === "lead_messages");
    expect(statusUpdate).toBeDefined();
    // ⚠️ Defesa anti-IDOR: o update precisa escopar pelo dono da instância.
    // Sem isto, um atacante com HMAC válido (ou via fallback de instância)
    // pode flipar status de mensagens de outros tenants conhecendo apenas
    // o whatsapp_msg_id.
    expect(statusUpdate?.filters).toEqual(
      expect.arrayContaining([
        { column: "whatsapp_msg_id", value: "evo-msg-victim" },
        { column: "user_id", value: "owner-user" },
      ]),
    );
  });

  it("connection.update escopa o update por user_id (defense-in-depth, não só evo_instance)", async () => {
    const body = makeBody({
      event: "connection.update",
      instance: "owner_instance_v2",
      data: { state: "open", owner: "5511999998888@s.whatsapp.net" },
    });
    const { client, updateCalls } = makeClient({
      whatsapp_instances: {
        data: { user_id: "owner-user", status: "qr_pending" },
      },
    });
    serviceMocks.createServiceSupabase.mockReturnValue(client);
    const { POST } = await import("@/app/api/whatsapp/webhook/route");
    const res = await POST(makeReq(body, sigHeader(body)));
    expect(res.status).toBe(200);
    const instanceUpdate = updateCalls.find(
      (c) => c.table === "whatsapp_instances",
    );
    expect(instanceUpdate?.filters).toEqual(
      expect.arrayContaining([{ column: "user_id", value: "owner-user" }]),
    );
  });

  it("leads update (promote stage) filtra por user_id além de id (defense-in-depth)", async () => {
    const body = makeBody({
      event: "messages.upsert",
      instance: "owner_instance_v2",
      data: {
        key: {
          id: "evo-1",
          remoteJid: "5511999998888@s.whatsapp.net",
          fromMe: false,
        },
        message: { conversation: "Olá" },
      },
    });
    const { client, updateCalls } = makeClient({
      whatsapp_instances: {
        data: { user_id: "owner-user", status: "connected" },
      },
      leads: {
        data: [
          {
            id: "lead-1",
            stage: "new",
            phone: "5511999998888",
            whatsapp: null,
          },
        ],
      },
    });
    serviceMocks.createServiceSupabase.mockReturnValue(client);
    const { POST } = await import("@/app/api/whatsapp/webhook/route");
    const res = await POST(makeReq(body, sigHeader(body)));
    expect(res.status).toBe(200);
    const leadUpdate = updateCalls.find((c) => c.table === "leads");
    expect(leadUpdate?.filters).toEqual(
      expect.arrayContaining([
        { column: "id", value: "lead-1" },
        { column: "user_id", value: "owner-user" },
      ]),
    );
  });

  it("evento unknown SEM HMAC e SEM instance conhecida → 401 (sem leak HMAC)", async () => {
    const body = makeBody({
      event: "unknown.event",
      instance: "ghost_instance",
      data: {},
    });
    const { client } = makeClient({
      whatsapp_instances: { data: null },
    });
    serviceMocks.createServiceSupabase.mockReturnValue(client);
    const { POST } = await import("@/app/api/whatsapp/webhook/route");
    const res = await POST(makeReq(body, null));
    expect(res.status).toBe(401);
  });

  it("evento unknown COM HMAC válido → 200 ok+ignored (acknowledge trusted)", async () => {
    const body = makeBody({ event: "unknown.event", data: {} });
    const { client } = makeClient({
      whatsapp_instances: { data: null },
    });
    serviceMocks.createServiceSupabase.mockReturnValue(client);
    const { POST } = await import("@/app/api/whatsapp/webhook/route");
    const res = await POST(makeReq(body, sigHeader(body)));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, ignored: true });
  });
});
