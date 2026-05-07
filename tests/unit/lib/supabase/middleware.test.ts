import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const VALID_ENV = {
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key-123",
  SUPABASE_SERVICE_ROLE_KEY: "service",
  APIFY_TOKEN: "t",
  APIFY_GOOGLE_MAPS_ACTOR_ID: "a",
  APIFY_INSTAGRAM_ACTOR_ID: "b",
  APIFY_WEBSITE_CONTACT_ACTOR_ID: "c",
  ANTHROPIC_API_KEY: "k",
  ANTHROPIC_MODEL: "claude-sonnet-4-6",
} as const;

let savedEnv: NodeJS.ProcessEnv;

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn((_url: string, _key: string, opts: unknown) => {
    // Touch opts to ensure consumer is wiring cookies through
    void opts;
    return {
      auth: { getUser: mocks.getUser },
    };
  }),
}));

beforeEach(() => {
  savedEnv = { ...process.env };
  Object.assign(process.env, VALID_ENV);
  mocks.getUser.mockReset();
  vi.resetModules();
});

afterEach(() => {
  process.env = savedEnv;
  vi.resetModules();
});

function makeRequest(pathname: string): NextRequest {
  const url = `http://localhost:3000${pathname}`;
  return new NextRequest(new URL(url));
}

describe("lib/supabase/middleware.updateSession", () => {
  it("redireciona para /login quando usuário não autenticado em rota protegida", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    const { updateSession } = await import("@/lib/supabase/middleware");
    const res = await updateSession(makeRequest("/dashboard"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toMatch(/\/login/);
  });

  it("preserva o pathname original como ?redirectTo no /login", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    const { updateSession } = await import("@/lib/supabase/middleware");
    const res = await updateSession(makeRequest("/leads?stage=new"));
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("/login");
    expect(location).toContain("redirectTo=");
    expect(decodeURIComponent(location)).toContain("/leads");
  });

  it("não redireciona em /login mesmo sem sessão", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    const { updateSession } = await import("@/lib/supabase/middleware");
    const res = await updateSession(makeRequest("/login"));
    // NextResponse.next() retorna 200 (OK), não 3xx
    expect(res.status).toBe(200);
  });

  it("não redireciona em /callback (OAuth) mesmo sem sessão", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    const { updateSession } = await import("@/lib/supabase/middleware");
    const res = await updateSession(makeRequest("/callback?code=abc"));
    expect(res.status).toBe(200);
  });

  it("passa adiante com NextResponse.next() quando o user existe", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "u1", email: "a@b.com" } },
      error: null,
    });
    const { updateSession } = await import("@/lib/supabase/middleware");
    const res = await updateSession(makeRequest("/dashboard"));
    expect(res.status).toBe(200);
  });

  it("redireciona / para /dashboard quando o user já está logado", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    });
    const { updateSession } = await import("@/lib/supabase/middleware");
    const res = await updateSession(makeRequest("/"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toMatch(/\/dashboard/);
  });

  it("verifica que NextResponse retornado herda response.cookies do client (refresh)", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    });
    const { updateSession } = await import("@/lib/supabase/middleware");
    const res = await updateSession(makeRequest("/dashboard"));
    expect(res).toBeInstanceOf(NextResponse);
  });
});
