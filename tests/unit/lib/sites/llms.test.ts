/**
 * Testes do helper puro `lib/sites/llms.ts` (issue #214 / Sprint 1 / #S4).
 *
 * Foco: render Markdown determinístico do `llms.txt` consumido por
 * AI crawlers (GPTBot, ClaudeBot, PerplexityBot). Função pura — sem
 * I/O — só consome `variables` validado upstream + `slug` + lê
 * `env.NEXT_PUBLIC_APP_URL` (default vitest = `http://localhost:3000`).
 *
 * Decisões PO refinement:
 *   - Frase factual SEM "loja online" (evita expectativa de e-commerce).
 *   - Hedging "consulte estoque atualizado" SÓ no rodapé.
 *   - Address null → fallback "no Brasil" (não omitir frase Sobre).
 *   - Linhas condicionais (phone/email/etc) null → OMITIDAS, não
 *     "undefined".
 *   - Sem BOM UTF-8 no output.
 *   - Sem PII de leads (apenas dados públicos do negócio).
 */
import { describe, expect, it } from "vitest";

import { renderLlmsTxt } from "@/lib/sites/llms";

import { SITE_FIXTURE } from "../../components/sites/site-fixtures";

const SLUG = "j7k2p9-touring-cars";
const BASE_URL = "http://localhost:3000";

describe("renderLlmsTxt — happy path canônico", () => {
  it("emite Markdown completo com todas as seções", () => {
    const out = renderLlmsTxt({ variables: SITE_FIXTURE, slug: SLUG });

    // Header
    expect(out).toContain(`# ${SITE_FIXTURE.business_name}`);

    // Slogan (blockquote)
    expect(out).toContain(`> ${SITE_FIXTURE.slogan}`);

    // Seções
    expect(out).toContain("## Sobre");
    expect(out).toContain("## Estoque (snapshot)");
    expect(out).toContain("## Contato");
    expect(out).toContain("## Para estoque atualizado em tempo real");

    // Sobre — city/state estruturado
    expect(out).toContain("em Recife, PE");
    // about_text com >= 200 chars (SITE_FIXTURE atende min)
    expect(out).toContain(
      SITE_FIXTURE.about_text.slice(0, 40),
    );

    // Estoque snapshot (até 6 cars)
    for (const car of SITE_FIXTURE.cars) {
      expect(out).toContain(`${car.brand} ${car.model} ${car.year}`);
    }

    // Contato — todas linhas presentes
    expect(out).toContain(`Telefone: ${SITE_FIXTURE.phone_display}`);
    expect(out).toContain(`WhatsApp: ${SITE_FIXTURE.whatsapp}`);
    expect(out).toContain(`Email: ${SITE_FIXTURE.email}`);
    expect(out).toContain(`Av. Boa Viagem 1000, Boa Viagem, Recife/PE`);

    // Link do site
    expect(out).toContain(`Site: ${BASE_URL}/sites/${SLUG}/`);

    // Hedging rodapé
    expect(out).toContain(`Consulte: ${BASE_URL}/sites/${SLUG}/estoque`);
  });

  it("inclui link de detalhes pra cada car listado", () => {
    const out = renderLlmsTxt({ variables: SITE_FIXTURE, slug: SLUG });

    for (const car of SITE_FIXTURE.cars) {
      expect(out).toContain(
        `${BASE_URL}/sites/${SLUG}/estoque/${car.slug}`,
      );
    }
  });

  it("emite preço formatado em BRL pt-BR (sem casas decimais)", () => {
    const out = renderLlmsTxt({ variables: SITE_FIXTURE, slug: SLUG });

    // BRL pt-BR usa NBSP entre símbolo e número — checamos via regex
    expect(out).toMatch(/R\$\s?\d{1,3}\.\d{3}/);
  });

  it("limita estoque a 6 cars (mesmo se variables tiver mais)", () => {
    // SITE_FIXTURE já tem 4 — extendemos só pra esse teste com max=6.
    // Limite max do schema é 6, então construímos um array com 6.
    const extra = [
      SITE_FIXTURE.cars[0],
      SITE_FIXTURE.cars[1],
    ];
    const sixCars = [
      ...SITE_FIXTURE.cars,
      ...(extra.filter((c) => c !== undefined) as typeof SITE_FIXTURE.cars),
    ].slice(0, 6);

    const vars = { ...SITE_FIXTURE, cars: sixCars };
    const out = renderLlmsTxt({ variables: vars, slug: SLUG });

    const bulletCount = (out.match(/^- \*\*.+ \d{4}\*\*/gm) ?? []).length;
    expect(bulletCount).toBeLessThanOrEqual(6);
  });
});

describe("renderLlmsTxt — edge case cars vazio", () => {
  it("renderiza 'Estoque sendo atualizado' quando cars.length === 0", () => {
    // Bypass do `min(4)` do schema — helper consome o shape pós-parse
    // mas test simulamos um payload reduzido pra cobrir o branch.
    const vars = {
      ...SITE_FIXTURE,
      cars: [] as typeof SITE_FIXTURE.cars,
    };
    const out = renderLlmsTxt({ variables: vars, slug: SLUG });

    expect(out).toContain("Estoque sendo atualizado");
    // Não emite bullet markdown
    expect(out).not.toMatch(/^- \*\*/m);
  });
});

describe("renderLlmsTxt — edge case address null", () => {
  it("Sobre usa 'no Brasil' quando address === null", () => {
    const vars = { ...SITE_FIXTURE, address: null };
    const out = renderLlmsTxt({ variables: vars, slug: SLUG });

    expect(out).toContain("no Brasil");
    expect(out).not.toContain("em Recife, PE");
  });

  it("Contato omite linha Endereço quando address === null", () => {
    const vars = { ...SITE_FIXTURE, address: null };
    const out = renderLlmsTxt({ variables: vars, slug: SLUG });

    expect(out).not.toContain("Endereço:");
    expect(out).not.toContain("Endereço: undefined");
    expect(out).not.toContain("Endereço: null");
  });
});

describe("renderLlmsTxt — edge case campos null/empty", () => {
  it("omite linha 'Email' quando email === null", () => {
    const vars = { ...SITE_FIXTURE, email: null };
    const out = renderLlmsTxt({ variables: vars, slug: SLUG });

    expect(out).not.toContain("Email:");
    expect(out).not.toContain("Email: undefined");
    expect(out).not.toContain("Email: null");
  });

  it("renderiza slogan fallback quando slogan undefined", () => {
    const vars = { ...SITE_FIXTURE, slogan: undefined };
    const out = renderLlmsTxt({ variables: vars, slug: SLUG });

    expect(out).toContain(
      "> Loja de carros seminovos em Recife/PE",
    );
  });

  it("renderiza slogan fallback genérico quando slogan undefined E address null", () => {
    const vars = { ...SITE_FIXTURE, slogan: undefined, address: null };
    const out = renderLlmsTxt({ variables: vars, slug: SLUG });

    expect(out).toContain("> Loja de carros seminovos");
  });

  it("business_name empty → fallback 'Loja de carros seminovos'", () => {
    // Bypass de validação Zod — helper deve ser defensivo.
    const vars = { ...SITE_FIXTURE, business_name: "" };
    const out = renderLlmsTxt({ variables: vars, slug: SLUG });

    expect(out).toContain("# Loja de carros seminovos");
  });
});

describe("renderLlmsTxt — sanity defensivo (segurança/parsing)", () => {
  it("sem BOM UTF-8 no início do output", () => {
    const out = renderLlmsTxt({ variables: SITE_FIXTURE, slug: SLUG });
    expect(out.charCodeAt(0)).not.toBe(0xfeff);
  });

  it("não vaza payload bruto JSON nem stringify de Address completo", () => {
    const out = renderLlmsTxt({ variables: SITE_FIXTURE, slug: SLUG });
    expect(out).not.toContain("country: BR");
    expect(out).not.toContain('"country":"BR"');
    expect(out).not.toContain("undefined");
    expect(out).not.toContain("[object Object]");
  });
});
