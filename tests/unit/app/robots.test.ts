/**
 * Testes do `app/robots.ts` — issue #212 / Sprint 1 / #S2.
 *
 * Validações:
 *   - Tipo retornado é `MetadataRoute.Robots`.
 *   - Universal rule (`*`) com disallows internos.
 *   - 11 AI crawlers + Bingbot com `allow: '/'`.
 *   - `sitemap` URL absoluto a partir de `NEXT_PUBLIC_APP_URL`.
 *   - `host` hint canônico.
 */
import { describe, expect, it, beforeAll } from "vitest";

describe("robots.ts (#212)", () => {
  beforeAll(() => {
    // Garante baseline de env determinístico (vitest.setup também define).
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
  });

  it("retorna estrutura MetadataRoute.Robots com `rules`, `sitemap`, `host`", async () => {
    const mod = await import("@/app/robots");
    const result = mod.default();
    expect(result).toHaveProperty("rules");
    expect(result).toHaveProperty("sitemap");
    expect(result).toHaveProperty("host");
  });

  it("sitemap URL é absoluto e usa NEXT_PUBLIC_APP_URL", async () => {
    const mod = await import("@/app/robots");
    const result = mod.default();
    expect(result.sitemap).toBe("http://localhost:3000/sitemap.xml");
  });

  it("host hint = NEXT_PUBLIC_APP_URL", async () => {
    const mod = await import("@/app/robots");
    const result = mod.default();
    expect(result.host).toBe("http://localhost:3000");
  });

  it("inclui regra universal `*` com disallow das rotas internas", async () => {
    const mod = await import("@/app/robots");
    const result = mod.default();
    const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
    const universal = rules.find((r) => r.userAgent === "*");
    expect(universal).toBeDefined();
    const disallow = Array.isArray(universal?.disallow)
      ? universal!.disallow
      : universal?.disallow
        ? [universal.disallow]
        : [];
    // Rotas internas — não devem aparecer em search engines
    expect(disallow).toContain("/api/");
    expect(disallow).toContain("/login");
    expect(disallow).toContain("/dashboard/");
    expect(disallow).toContain("/leads/");
    expect(disallow).toContain("/messages/");
    expect(disallow).toContain("/campaigns/");
    expect(disallow).toContain("/pipeline/");
    expect(disallow).toContain("/search/");
  });

  it("inclui allow explícito para 11 AI crawlers + Bingbot (13 regras totais)", async () => {
    const mod = await import("@/app/robots");
    const result = mod.default();
    const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
    // Universal + 11 AI bots + Bingbot = 13
    expect(rules.length).toBe(13);

    const userAgents = rules.map((r) => r.userAgent);
    const expectedBots = [
      "*",
      "GPTBot",
      "ClaudeBot",
      "PerplexityBot",
      "ChatGPT-User",
      "GoogleOther",
      "Google-Extended",
      "Bytespider",
      "CCBot",
      "anthropic-ai",
      "cohere-ai",
      "FacebookBot",
      "Bingbot",
    ];
    for (const ua of expectedBots) {
      expect(userAgents).toContain(ua);
    }
  });

  it("cada AI bot tem allow: '/' (não bloqueia o crawl)", async () => {
    const mod = await import("@/app/robots");
    const result = mod.default();
    const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
    const aiBots = [
      "GPTBot",
      "ClaudeBot",
      "PerplexityBot",
      "ChatGPT-User",
      "GoogleOther",
      "Google-Extended",
      "Bytespider",
      "CCBot",
      "anthropic-ai",
      "cohere-ai",
      "FacebookBot",
    ];
    for (const ua of aiBots) {
      const rule = rules.find((r) => r.userAgent === ua);
      expect(rule, `rule for ${ua} not found`).toBeDefined();
      expect(rule?.allow).toBe("/");
    }
  });
});
