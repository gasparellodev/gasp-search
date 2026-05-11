/**
 * E2E: /robots.txt + /sitemap.xml — issue #212 / Sprint 1 / #S2.
 *
 * Não depende de seed de Supabase real — `/robots.txt` é estático e
 * `/sitemap.xml` em ambiente CI sem DB retorna `[]` (graceful) com
 * XML vazio mas válido.
 *
 * Validações:
 *   - `/robots.txt` retorna 200 + `text/plain`, contém os AI bots
 *     e o `Sitemap:` URL absoluto.
 *   - `/sitemap.xml` retorna 200 + XML válido com `urlset` xmlns
 *     correto (estrutura mínima).
 */
import { expect, test } from "@playwright/test";

test.describe("SEO files — /robots.txt + /sitemap.xml (#212)", () => {
  test("/robots.txt — 200, content-type text/plain, contém AI bots", async ({
    request,
  }) => {
    const response = await request.get("/robots.txt");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toMatch(/text\/plain/);

    const body = await response.text();
    // Universal rule
    expect(body).toContain("User-Agent: *");
    // AI bots — sampling alguns dos 11
    expect(body).toContain("GPTBot");
    expect(body).toContain("ClaudeBot");
    expect(body).toContain("PerplexityBot");
    expect(body).toContain("Google-Extended");
    // Sitemap URL absoluto
    expect(body).toMatch(/Sitemap: https?:\/\//);
    expect(body).toMatch(/sitemap\.xml/);
  });

  test("/robots.txt — disallow das rotas internas", async ({ request }) => {
    const response = await request.get("/robots.txt");
    const body = await response.text();
    expect(body).toContain("/api/");
    expect(body).toContain("/dashboard/");
    expect(body).toContain("/leads/");
    expect(body).toContain("/login");
  });

  test("/sitemap.xml — 200, content-type XML, urlset xmlns válido", async ({
    request,
  }) => {
    const response = await request.get("/sitemap.xml");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toMatch(/xml/);

    const body = await response.text();
    // XML válido — header + urlset
    expect(body).toMatch(/^<\?xml/);
    expect(body).toContain(
      "http://www.sitemaps.org/schemas/sitemap/0.9",
    );
    expect(body).toContain("<urlset");
    expect(body).toContain("</urlset>");
  });
});
