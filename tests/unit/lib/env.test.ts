import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const VALID_ENV = {
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key-123",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key-123",
  APIFY_TOKEN: "apify_token_123",
  APIFY_GOOGLE_MAPS_ACTOR_ID: "compass~crawler-google-places",
  APIFY_INSTAGRAM_ACTOR_ID: "apify~instagram-scraper",
  APIFY_WEBSITE_CONTACT_ACTOR_ID: "vdrmota~contact-info-scraper",
  ANTHROPIC_API_KEY: "sk-ant-123",
  ANTHROPIC_MODEL: "claude-sonnet-4-6",
} as const;

let savedEnv: NodeJS.ProcessEnv;

beforeEach(() => {
  savedEnv = { ...process.env };
  for (const k of Object.keys(VALID_ENV)) {
    delete process.env[k];
  }
  vi.resetModules();
});

afterEach(() => {
  process.env = savedEnv;
  vi.resetModules();
});

describe("lib/env (server)", () => {
  it("aceita um set válido de envs e expõe valores", async () => {
    Object.assign(process.env, VALID_ENV);
    const { env } = await import("@/lib/env");
    expect(env.NEXT_PUBLIC_APP_URL).toBe("http://localhost:3000");
    expect(env.SUPABASE_SERVICE_ROLE_KEY).toBe("service-role-key-123");
    expect(env.ANTHROPIC_MODEL).toBe("claude-sonnet-4-6");
  });

  it("aplica default do ANTHROPIC_MODEL quando ausente", async () => {
    Object.assign(process.env, { ...VALID_ENV, ANTHROPIC_MODEL: undefined });
    delete process.env.ANTHROPIC_MODEL;
    const { env } = await import("@/lib/env");
    expect(env.ANTHROPIC_MODEL).toBe("claude-sonnet-4-6");
  });

  it("rejeita NEXT_PUBLIC_SUPABASE_URL inválida (não-URL)", async () => {
    Object.assign(process.env, {
      ...VALID_ENV,
      NEXT_PUBLIC_SUPABASE_URL: "not-a-url",
    });
    await expect(import("@/lib/env")).rejects.toThrow(
      /NEXT_PUBLIC_SUPABASE_URL/,
    );
  });

  it("rejeita SUPABASE_SERVICE_ROLE_KEY ausente", async () => {
    const e = { ...VALID_ENV } as Record<string, string | undefined>;
    delete e.SUPABASE_SERVICE_ROLE_KEY;
    Object.assign(process.env, e);
    await expect(import("@/lib/env")).rejects.toThrow(
      /SUPABASE_SERVICE_ROLE_KEY/,
    );
  });

  it("rejeita APIFY_TOKEN vazio", async () => {
    Object.assign(process.env, { ...VALID_ENV, APIFY_TOKEN: "" });
    await expect(import("@/lib/env")).rejects.toThrow(/APIFY_TOKEN/);
  });

  it("rejeita ANTHROPIC_API_KEY ausente", async () => {
    const e = { ...VALID_ENV } as Record<string, string | undefined>;
    delete e.ANTHROPIC_API_KEY;
    Object.assign(process.env, e);
    await expect(import("@/lib/env")).rejects.toThrow(/ANTHROPIC_API_KEY/);
  });
});

describe("lib/env-public (client-safe)", () => {
  it("expõe apenas variáveis NEXT_PUBLIC_*", async () => {
    Object.assign(process.env, VALID_ENV);
    const { publicEnv } = await import("@/lib/env-public");
    expect(publicEnv).toEqual({
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key-123",
    });
    expect(Object.keys(publicEnv)).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(Object.keys(publicEnv)).not.toContain("APIFY_TOKEN");
    expect(Object.keys(publicEnv)).not.toContain("ANTHROPIC_API_KEY");
  });

  it("rejeita NEXT_PUBLIC_APP_URL inválida", async () => {
    Object.assign(process.env, {
      ...VALID_ENV,
      NEXT_PUBLIC_APP_URL: "javascript:alert(1)",
    });
    await expect(import("@/lib/env-public")).rejects.toThrow(
      /NEXT_PUBLIC_APP_URL/,
    );
  });
});
