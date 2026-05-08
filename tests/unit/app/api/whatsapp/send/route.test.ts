import { beforeEach, describe, expect, it, vi } from "vitest";

const supabaseMocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  createServerSupabase: vi.fn(),
}));

const sendMocks = vi.hoisted(() => ({
  sendWhatsAppMessage: vi.fn(),
  checkRateLimit: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: supabaseMocks.createServerSupabase,
}));

vi.mock("@/lib/evolution/send", () => ({
  sendWhatsAppMessage: sendMocks.sendWhatsAppMessage,
}));

vi.mock("@/lib/evolution/rate-limit", () => ({
  checkRateLimit: sendMocks.checkRateLimit,
}));

function makeReq(body: unknown) {
  return new Request("http://localhost/api/whatsapp/send", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.resetModules();
  supabaseMocks.getUser.mockReset();
  supabaseMocks.createServerSupabase.mockReset();
  supabaseMocks.createServerSupabase.mockResolvedValue({
    auth: { getUser: supabaseMocks.getUser },
  });
  sendMocks.sendWhatsAppMessage.mockReset();
  sendMocks.checkRateLimit.mockReset();
  sendMocks.checkRateLimit.mockReturnValue({ ok: true });
});

const validBody = {
  leadId: "11111111-1111-4111-8111-111111111111",
  content: "Olá!",
};

describe("POST /api/whatsapp/send", () => {
  it("retorna 401 sem usuário", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });
    const { POST } = await import("@/app/api/whatsapp/send/route");
    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(401);
  });

  it("retorna 400 em JSON inválido", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    });
    const { POST } = await import("@/app/api/whatsapp/send/route");
    const res = await POST(makeReq("{invalid json"));
    expect(res.status).toBe(400);
  });

  it("retorna 400 em validação zod (leadId não é UUID)", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    });
    const { POST } = await import("@/app/api/whatsapp/send/route");
    const res = await POST(makeReq({ leadId: "x", content: "olá" }));
    expect(res.status).toBe(400);
  });

  it("retorna 429 quando rate-limit bloqueia", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    });
    sendMocks.checkRateLimit.mockReturnValue({ ok: false, retryAfterMs: 2500 });
    const { POST } = await import("@/app/api/whatsapp/send/route");
    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("3");
  });

  it("retorna 201 em happy path", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    });
    sendMocks.sendWhatsAppMessage.mockResolvedValue({
      ok: true,
      messageId: "msg-1",
      whatsappMsgId: "evo-1",
    });
    const { POST } = await import("@/app/api/whatsapp/send/route");
    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toEqual({
      messageId: "msg-1",
      whatsappMsgId: "evo-1",
      status: "sent",
    });
  });

  it("retorna 409 quando instance_disconnected", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    });
    sendMocks.sendWhatsAppMessage.mockResolvedValue({
      ok: false,
      reason: "instance_disconnected",
    });
    const { POST } = await import("@/app/api/whatsapp/send/route");
    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(409);
  });

  it("retorna 404 em lead_not_found", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    });
    sendMocks.sendWhatsAppMessage.mockResolvedValue({
      ok: false,
      reason: "lead_not_found",
    });
    const { POST } = await import("@/app/api/whatsapp/send/route");
    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(404);
  });

  it("retorna 422 em lead_missing_phone", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    });
    sendMocks.sendWhatsAppMessage.mockResolvedValue({
      ok: false,
      reason: "lead_missing_phone",
    });
    const { POST } = await import("@/app/api/whatsapp/send/route");
    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(422);
  });

  it("retorna 502 em evolution_error com messageId", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    });
    sendMocks.sendWhatsAppMessage.mockResolvedValue({
      ok: false,
      reason: "evolution_error",
      messageId: "msg-2",
      error: "boom",
    });
    const { POST } = await import("@/app/api/whatsapp/send/route");
    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body).toMatchObject({ messageId: "msg-2" });
  });
});
