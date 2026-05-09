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
  EVOLUTION_API_URL: "http://localhost:8080",
  EVOLUTION_API_KEY: "evo-key-1234567890",
  EVOLUTION_WEBHOOK_SECRET: "whsec-1234567890abcdef",
  NEXT_PUBLIC_WHATSAPP_ENABLED: "0",
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

  it("aplica default de EVOLUTION_API_URL quando ausente", async () => {
    const e = { ...VALID_ENV } as Record<string, string | undefined>;
    delete e.EVOLUTION_API_URL;
    Object.assign(process.env, e);
    const { env } = await import("@/lib/env");
    expect(env.EVOLUTION_API_URL).toBe("http://localhost:8080");
  });

  it("rejeita EVOLUTION_API_URL inválida", async () => {
    Object.assign(process.env, {
      ...VALID_ENV,
      EVOLUTION_API_URL: "not-a-url",
    });
    await expect(import("@/lib/env")).rejects.toThrow(/EVOLUTION_API_URL/);
  });

  it("aplica default '0' de NEXT_PUBLIC_WHATSAPP_ENABLED quando ausente", async () => {
    const e = { ...VALID_ENV } as Record<string, string | undefined>;
    delete e.NEXT_PUBLIC_WHATSAPP_ENABLED;
    Object.assign(process.env, e);
    const { env } = await import("@/lib/env");
    expect(env.NEXT_PUBLIC_WHATSAPP_ENABLED).toBe("0");
  });

  it("rejeita NEXT_PUBLIC_WHATSAPP_ENABLED com valor inválido", async () => {
    Object.assign(process.env, {
      ...VALID_ENV,
      NEXT_PUBLIC_WHATSAPP_ENABLED: "yes",
    });
    await expect(import("@/lib/env")).rejects.toThrow(
      /NEXT_PUBLIC_WHATSAPP_ENABLED/,
    );
  });

  it("permite EVOLUTION_API_KEY ausente quando WhatsApp desabilitado", async () => {
    const e = { ...VALID_ENV } as Record<string, string | undefined>;
    delete e.EVOLUTION_API_KEY;
    delete e.EVOLUTION_WEBHOOK_SECRET;
    Object.assign(process.env, { ...e, NEXT_PUBLIC_WHATSAPP_ENABLED: "0" });
    const { env } = await import("@/lib/env");
    expect(env.EVOLUTION_API_KEY).toBeUndefined();
  });

  it("rejeita quando WhatsApp habilitado sem EVOLUTION_API_KEY", async () => {
    const e = { ...VALID_ENV } as Record<string, string | undefined>;
    delete e.EVOLUTION_API_KEY;
    Object.assign(process.env, { ...e, NEXT_PUBLIC_WHATSAPP_ENABLED: "1" });
    await expect(import("@/lib/env")).rejects.toThrow(/EVOLUTION_API_KEY/);
  });

  it("rejeita quando WhatsApp habilitado com EVOLUTION_WEBHOOK_SECRET curto", async () => {
    Object.assign(process.env, {
      ...VALID_ENV,
      NEXT_PUBLIC_WHATSAPP_ENABLED: "1",
      EVOLUTION_WEBHOOK_SECRET: "short",
    });
    await expect(import("@/lib/env")).rejects.toThrow(
      /EVOLUTION_WEBHOOK_SECRET/,
    );
  });

  it("trata TEST_SEED_TOKEN/TEST_SEED_USER_ID vazios como undefined (GH Actions injeta '' p/ secrets ausentes)", async () => {
    Object.assign(process.env, {
      ...VALID_ENV,
      TEST_SEED_TOKEN: "",
      TEST_SEED_USER_ID: "",
    });
    const { env } = await import("@/lib/env");
    expect(env.TEST_SEED_TOKEN).toBeUndefined();
    expect(env.TEST_SEED_USER_ID).toBeUndefined();
  });

  it("aceita TEST_SEED_TOKEN/TEST_SEED_USER_ID válidos quando preenchidos", async () => {
    Object.assign(process.env, {
      ...VALID_ENV,
      TEST_SEED_TOKEN: "abcdef0123456789",
      TEST_SEED_USER_ID: "00000000-0000-4000-8000-000000000000",
    });
    const { env } = await import("@/lib/env");
    expect(env.TEST_SEED_TOKEN).toBe("abcdef0123456789");
    expect(env.TEST_SEED_USER_ID).toBe("00000000-0000-4000-8000-000000000000");
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
      NEXT_PUBLIC_WHATSAPP_ENABLED: "0",
    });
    expect(Object.keys(publicEnv)).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(Object.keys(publicEnv)).not.toContain("APIFY_TOKEN");
    expect(Object.keys(publicEnv)).not.toContain("ANTHROPIC_API_KEY");
    expect(Object.keys(publicEnv)).not.toContain("EVOLUTION_API_KEY");
  });

  it("aceita NEXT_PUBLIC_WHATSAPP_ENABLED='1'", async () => {
    Object.assign(process.env, {
      ...VALID_ENV,
      NEXT_PUBLIC_WHATSAPP_ENABLED: "1",
    });
    const { publicEnv } = await import("@/lib/env-public");
    expect(publicEnv.NEXT_PUBLIC_WHATSAPP_ENABLED).toBe("1");
  });

  it("aplica default '0' de NEXT_PUBLIC_WHATSAPP_ENABLED quando ausente", async () => {
    const e = { ...VALID_ENV } as Record<string, string | undefined>;
    delete e.NEXT_PUBLIC_WHATSAPP_ENABLED;
    Object.assign(process.env, e);
    const { publicEnv } = await import("@/lib/env-public");
    expect(publicEnv.NEXT_PUBLIC_WHATSAPP_ENABLED).toBe("0");
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
