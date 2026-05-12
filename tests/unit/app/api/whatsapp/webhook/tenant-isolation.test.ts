import { beforeEach, describe, expect, it, vi } from "vitest";

// Integração com mock de Supabase: cobre o cenário "atacante manda webhook
// com instance de outro user" (#130). Garante que nenhuma escrita acontece
// quando o lookup falha — defende contra IDOR via webhook público.

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

function makeReq(body: string) {
  const headers = new Headers({ "content-type": "application/json" });
  return new Request("http://localhost/api/whatsapp/webhook", {
    method: "POST",
    headers,
    body,
  });
}

type Recorded = { table: string; op: string; payload?: unknown };

function makeClient(selectData: unknown) {
  const recorded: Recorded[] = [];

  const buildSelect = () => {
    const maybeSingle = vi.fn(async () => ({
      data: selectData,
      error: null,
    }));
    const eqChain = {
      maybeSingle,
      eq: vi.fn(() => eqChain),
      then: (resolve: (v: { data: unknown; error: null }) => void) =>
        resolve({ data: selectData, error: null }),
    };
    return { eq: vi.fn(() => eqChain) };
  };

  const from = vi.fn((table: string) => ({
    select: () => buildSelect(),
    update: vi.fn((payload: unknown) => {
      const builder: {
        eq: () => typeof builder;
        then: (resolve: (v: { error: null }) => void) => void;
      } = {
        eq() {
          return builder;
        },
        then(resolve) {
          recorded.push({ table, op: "update", payload });
          resolve({ error: null });
        },
      };
      return builder;
    }),
    insert: vi.fn(async (payload: unknown) => {
      recorded.push({ table, op: "insert", payload });
      return { error: null };
    }),
  }));

  return { client: { from }, recorded };
}

beforeEach(() => {
  vi.resetModules();
  serviceMocks.createServiceSupabase.mockReset();
});

describe("webhook tenant isolation (#130)", () => {
  it("atacante envia webhook com instance fake (sem HMAC) → 401 e ZERO escrita", async () => {
    const body = makeBody({
      event: "messages.update",
      instance: "attacker_made_up_slug",
      data: { key: { id: "evo-victim-msg" }, status: "READ" },
    });
    const { client, recorded } = makeClient(null);
    serviceMocks.createServiceSupabase.mockReturnValue(client);
    const { POST } = await import("@/app/api/whatsapp/webhook/route");
    const res = await POST(makeReq(body));
    expect(res.status).toBe(401);

    // Nenhum update / insert deve ter ocorrido para qualquer tabela.
    const writes = recorded.filter(
      (c) => c.op === "update" || c.op === "insert",
    );
    expect(writes).toEqual([]);
  });

  it("atacante envia message.upsert com instance fake → 401 e ZERO insert em lead_messages", async () => {
    const body = makeBody({
      event: "messages.upsert",
      instance: "attacker_made_up_slug",
      data: {
        key: {
          id: "evo-spoof",
          remoteJid: "5511999998888@s.whatsapp.net",
          fromMe: false,
        },
        message: { conversation: "spoofed" },
      },
    });
    const { client, recorded } = makeClient(null);
    serviceMocks.createServiceSupabase.mockReturnValue(client);
    const { POST } = await import("@/app/api/whatsapp/webhook/route");
    const res = await POST(makeReq(body));
    expect(res.status).toBe(401);
    expect(recorded.find((c) => c.table === "lead_messages")).toBeUndefined();
  });
});
