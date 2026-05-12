import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

// #138b — guard contra open redirect via `?redirectTo=`.
//
// Sem o guard, `redirectTo=//evil.com` é tratado como path relativo pelo
// `NextResponse.redirect(\`${origin}${redirectTo}\`)` e o `Location`
// resultante (`https://app//evil.com`) é interpretado como
// protocol-relative pelo browser → redireciona pra `https://evil.com`.

vi.mock("@/lib/env", () => ({
  env: {
    NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
  },
}));

const supabaseMocks = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  verifyOtp: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      exchangeCodeForSession: supabaseMocks.exchangeCodeForSession,
      verifyOtp: supabaseMocks.verifyOtp,
    },
  })),
}));

function makeRequest(url: string): NextRequest {
  return new Request(url) as unknown as NextRequest;
}

beforeEach(() => {
  supabaseMocks.exchangeCodeForSession.mockReset();
  supabaseMocks.exchangeCodeForSession.mockResolvedValue({ error: null });
  supabaseMocks.verifyOtp.mockReset();
  supabaseMocks.verifyOtp.mockResolvedValue({ error: null });
});

describe("GET /callback — open redirect guard (#138b)", () => {
  it("redirectTo=//evil.com (protocol-relative) → fallback /dashboard", async () => {
    const { GET } = await import("@/app/(auth)/callback/route");
    const res = await GET(
      makeRequest(
        "http://localhost/callback?code=abc&redirectTo=%2F%2Fevil.com",
      ),
    );
    expect(res.headers.get("location")).toBe("http://localhost/dashboard");
  });

  it("redirectTo=/leads (path relativo seguro) → preservado", async () => {
    const { GET } = await import("@/app/(auth)/callback/route");
    const res = await GET(
      makeRequest("http://localhost/callback?code=abc&redirectTo=%2Fleads"),
    );
    expect(res.headers.get("location")).toBe("http://localhost/leads");
  });

  it("redirectTo=https://evil.com (URL absoluta) → fallback /dashboard", async () => {
    const { GET } = await import("@/app/(auth)/callback/route");
    const res = await GET(
      makeRequest(
        "http://localhost/callback?code=abc&redirectTo=https%3A%2F%2Fevil.com",
      ),
    );
    expect(res.headers.get("location")).toBe("http://localhost/dashboard");
  });

  it("redirectTo ausente → /dashboard (default)", async () => {
    const { GET } = await import("@/app/(auth)/callback/route");
    const res = await GET(makeRequest("http://localhost/callback?code=abc"));
    expect(res.headers.get("location")).toBe("http://localhost/dashboard");
  });

  it("redirectTo vazio → /dashboard (string vazia não passa no guard)", async () => {
    const { GET } = await import("@/app/(auth)/callback/route");
    const res = await GET(
      makeRequest("http://localhost/callback?code=abc&redirectTo="),
    );
    expect(res.headers.get("location")).toBe("http://localhost/dashboard");
  });

  it("redirectTo=/\\evil.com (backslash bypass) → fallback /dashboard", async () => {
    const { GET } = await import("@/app/(auth)/callback/route");
    const res = await GET(
      makeRequest(
        "http://localhost/callback?code=abc&redirectTo=%2F%5Cevil.com",
      ),
    );
    expect(res.headers.get("location")).toBe("http://localhost/dashboard");
  });

  it("guard se aplica também ao fluxo de email confirmation (token_hash)", async () => {
    const { GET } = await import("@/app/(auth)/callback/route");
    const res = await GET(
      makeRequest(
        "http://localhost/callback?token_hash=xyz&type=email&redirectTo=%2F%2Fevil.com",
      ),
    );
    expect(res.headers.get("location")).toBe("http://localhost/dashboard");
  });
});
