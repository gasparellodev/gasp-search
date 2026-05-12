import { beforeEach, describe, expect, it, vi } from "vitest";

const insertMock = vi.hoisted(() => vi.fn(async () => ({ error: null })));
const fromMock = vi.hoisted(() => vi.fn(() => ({ insert: insertMock })));

vi.mock("@/lib/supabase/service", () => ({
  createServiceSupabase: () => ({ from: fromMock }),
}));

import { logConsent } from "@/lib/lgpd/consent-audit";

describe("logConsent()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("persiste a decisão em consent_logs com shape auditável", async () => {
    const result = await logConsent({
      user_id: undefined,
      ip: "203.0.113.10",
      user_agent: "Playwright",
      timestamp: "2026-05-12T00:00:00.000Z",
      consent_text:
        "Usamos cookies para melhorar sua experiência. Você pode aceitar todos ou personalizar.",
      version: "v1",
      action: "accept_selected",
      categories: {
        necessary: true,
        analytics: true,
        marketing: false,
      },
    });

    expect(result).toEqual({ ok: true });
    expect(fromMock).toHaveBeenCalledWith("consent_logs");
    expect(insertMock).toHaveBeenCalledWith({
      user_id: null,
      ip: "203.0.113.10",
      user_agent: "Playwright",
      timestamp: "2026-05-12T00:00:00.000Z",
      consent_text:
        "Usamos cookies para melhorar sua experiência. Você pode aceitar todos ou personalizar.",
      version: "v1",
      action: "accept_selected",
      categories: {
        necessary: true,
        analytics: true,
        marketing: false,
      },
    });
  });

  it("retorna ok:false sem vazar detalhe de banco quando insert falha", async () => {
    insertMock.mockResolvedValueOnce({
      error: { message: "relation missing" },
    } as never);

    const result = await logConsent({
      ip: null,
      user_agent: null,
      timestamp: "2026-05-12T00:00:00.000Z",
      consent_text: "copy",
      version: "v1",
      action: "reject",
      categories: {
        necessary: true,
        analytics: false,
        marketing: false,
      },
    });

    expect(result).toEqual({ ok: false });
  });
});
