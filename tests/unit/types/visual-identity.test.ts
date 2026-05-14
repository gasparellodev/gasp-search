/**
 * Tests para `types/visual-identity.ts` (issue #215).
 *
 * Sprint 2 #A1 — Zod schema canônico pro shape persistido em
 * `lead_sites.visual_identity` (coluna JSONB criada em migration
 * 0019). Estratégia: parse positivo do happy-path + edge cases
 * (limites, nullable, refusal de inputs inválidos) cobrindo ≥80%
 * lines/branches do arquivo.
 */
import { describe, expect, it } from "vitest";
import {
  VisualIdentityManifestSchema,
  VisualIdentityModelSchema,
  type VisualIdentityManifest,
} from "@/types/visual-identity";

const validManifest: VisualIdentityManifest = {
  hero_url: "https://cdn.example.com/sites/abc/hero.webp",
  categories_urls: [
    "https://cdn.example.com/sites/abc/suv.webp",
    "https://cdn.example.com/sites/abc/sedan.webp",
    "https://cdn.example.com/sites/abc/hatch.webp",
  ],
  about_url: "https://cdn.example.com/sites/abc/about.webp",
  contact_url: "/assets/contact-fallback.webp",
  generated_at: "2026-05-11T08:42:00.000Z",
  model: "gpt-image-2-2026-04-21",
  cost_estimate_brl: 0.85,
};

describe("VisualIdentityModelSchema", () => {
  it("aceita 'gpt-image-2-2026-04-21' (snapshot pinado V1)", () => {
    expect(VisualIdentityModelSchema.parse("gpt-image-2-2026-04-21")).toBe(
      "gpt-image-2-2026-04-21",
    );
  });

  it("aceita 'gpt-image-1-mini' (fallback automático)", () => {
    expect(VisualIdentityModelSchema.parse("gpt-image-1-mini")).toBe(
      "gpt-image-1-mini",
    );
  });

  it("rejeita 'dall-e-3' (deprecado 2026-05-12 — não suportado)", () => {
    expect(() => VisualIdentityModelSchema.parse("dall-e-3")).toThrow();
  });

  it("rejeita modelo desconhecido (anti supply-chain drift)", () => {
    expect(() => VisualIdentityModelSchema.parse("midjourney-v7")).toThrow();
  });

  it("rejeita string vazia", () => {
    expect(() => VisualIdentityModelSchema.parse("")).toThrow();
  });
});

describe("VisualIdentityManifestSchema — happy path", () => {
  it("parsea manifest completo válido (3 categories, HTTPS URLs)", () => {
    const parsed = VisualIdentityManifestSchema.parse(validManifest);
    expect(parsed.hero_url).toBe(validManifest.hero_url);
    expect(parsed.categories_urls).toHaveLength(3);
    expect(parsed.model).toBe("gpt-image-2-2026-04-21");
    expect(parsed.cost_estimate_brl).toBe(0.85);
  });

  it("aceita absolute path local (/assets/...) — fallback admin manual", () => {
    const parsed = VisualIdentityManifestSchema.parse({
      ...validManifest,
      hero_url: "/assets/sites/abc/hero.webp",
    });
    expect(parsed.hero_url).toBe("/assets/sites/abc/hero.webp");
  });

  it("aceita http URL além de https", () => {
    const parsed = VisualIdentityManifestSchema.parse({
      ...validManifest,
      contact_url: "http://localhost:3000/dev/contact.webp",
    });
    expect(parsed.contact_url).toBe("http://localhost:3000/dev/contact.webp");
  });

  it("aceita exatamente 6 categories_urls (limite max — 6 categorias)", () => {
    const parsed = VisualIdentityManifestSchema.parse({
      ...validManifest,
      categories_urls: [
        "https://cdn.example.com/suv.webp",
        "https://cdn.example.com/sedan.webp",
        "https://cdn.example.com/hatch.webp",
        "https://cdn.example.com/pickup.webp",
        "https://cdn.example.com/esportivo.webp",
        "https://cdn.example.com/conversivel.webp",
      ],
    });
    expect(parsed.categories_urls).toHaveLength(6);
  });

  it("aceita exatamente 1 category_url (limite min — admin regenera 1 por vez)", () => {
    const parsed = VisualIdentityManifestSchema.parse({
      ...validManifest,
      categories_urls: ["https://cdn.example.com/suv.webp"],
    });
    expect(parsed.categories_urls).toHaveLength(1);
  });

  it("aceita cost_estimate_brl = 0 (manifest mockado em dev)", () => {
    const parsed = VisualIdentityManifestSchema.parse({
      ...validManifest,
      cost_estimate_brl: 0,
    });
    expect(parsed.cost_estimate_brl).toBe(0);
  });

  it("parsea manifest legado sem tradein_url (#298 backward compat)", () => {
    // validManifest não inclui tradein_url — deve passar sem erro
    const parsed = VisualIdentityManifestSchema.parse(validManifest);
    expect(parsed.tradein_url).toBeUndefined();
  });

  it("aceita tradein_url quando provido (#298 — separação Trade-in/About)", () => {
    const parsed = VisualIdentityManifestSchema.parse({
      ...validManifest,
      tradein_url: "https://cdn.example.com/sites/abc/tradein.webp",
    });
    expect(parsed.tradein_url).toBe(
      "https://cdn.example.com/sites/abc/tradein.webp",
    );
  });

  it("aceita tradein_url null (#298 — admin pode setar null explicitamente)", () => {
    const parsed = VisualIdentityManifestSchema.parse({
      ...validManifest,
      tradein_url: null,
    });
    expect(parsed.tradein_url).toBeNull();
  });

  it("parsea manifest legado sem announcement_text (#291 backward compat)", () => {
    const parsed = VisualIdentityManifestSchema.parse(validManifest);
    expect(parsed.announcement_text).toBeUndefined();
  });

  it("aceita announcement_text dentro do limite 140 chars (#291)", () => {
    const parsed = VisualIdentityManifestSchema.parse({
      ...validManifest,
      announcement_text: "Black Friday — descontos em todo estoque",
    });
    expect(parsed.announcement_text).toBe(
      "Black Friday — descontos em todo estoque",
    );
  });

  it("aplica trim ao announcement_text (#291)", () => {
    const parsed = VisualIdentityManifestSchema.parse({
      ...validManifest,
      announcement_text: "   Promoção   ",
    });
    expect(parsed.announcement_text).toBe("Promoção");
  });

  it("rejeita announcement_text com 141+ chars (#291)", () => {
    expect(() =>
      VisualIdentityManifestSchema.parse({
        ...validManifest,
        announcement_text: "a".repeat(141),
      }),
    ).toThrow();
  });
});

describe("VisualIdentityManifestSchema — invalid inputs", () => {
  it("rejeita hero_url vazio", () => {
    expect(() =>
      VisualIdentityManifestSchema.parse({ ...validManifest, hero_url: "" }),
    ).toThrow();
  });

  it("rejeita hero_url com protocolo não-http (ftp://)", () => {
    expect(() =>
      VisualIdentityManifestSchema.parse({
        ...validManifest,
        hero_url: "ftp://example.com/hero.webp",
      }),
    ).toThrow();
  });

  it("rejeita hero_url relativo (sem prefixo /)", () => {
    expect(() =>
      VisualIdentityManifestSchema.parse({
        ...validManifest,
        hero_url: "assets/hero.webp",
      }),
    ).toThrow();
  });

  it("rejeita categories_urls vazio (min 1)", () => {
    expect(() =>
      VisualIdentityManifestSchema.parse({
        ...validManifest,
        categories_urls: [],
      }),
    ).toThrow();
  });

  it("rejeita categories_urls com 7+ itens (max 6 categorias)", () => {
    const sevenUrls = Array.from(
      { length: 7 },
      (_, i) => `https://cdn.example.com/cat${i}.webp`,
    );
    expect(() =>
      VisualIdentityManifestSchema.parse({
        ...validManifest,
        categories_urls: sevenUrls,
      }),
    ).toThrow();
  });

  it("rejeita generated_at sem timezone offset (Zod datetime({offset:true}))", () => {
    expect(() =>
      VisualIdentityManifestSchema.parse({
        ...validManifest,
        generated_at: "2026-05-11T08:42:00",
      }),
    ).toThrow();
  });

  it("rejeita generated_at malformado", () => {
    expect(() =>
      VisualIdentityManifestSchema.parse({
        ...validManifest,
        generated_at: "ontem às 8 da manhã",
      }),
    ).toThrow();
  });

  it("rejeita cost_estimate_brl negativo (não-faz-sentido financeiro)", () => {
    expect(() =>
      VisualIdentityManifestSchema.parse({
        ...validManifest,
        cost_estimate_brl: -0.5,
      }),
    ).toThrow();
  });

  it("rejeita model desconhecido (passa pelo enum)", () => {
    expect(() =>
      VisualIdentityManifestSchema.parse({
        ...validManifest,
        model: "stable-diffusion-3",
      }),
    ).toThrow();
  });

  it("rejeita manifest sem campos obrigatórios (about_url)", () => {
    const { about_url: _omit, ...incomplete } = validManifest;
    void _omit;
    expect(() => VisualIdentityManifestSchema.parse(incomplete)).toThrow();
  });
});
