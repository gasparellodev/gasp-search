import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { SlugCollisionError } from "@/lib/sites/errors";
import { generateUniqueSlug } from "@/lib/sites/slug";
import type { Database } from "@/types/database";

// Regex completa do slug: 8 chars do alfabeto seguros, hífen, base alfanum/-.
const SLUG_REGEX = /^[a-z0-9]{8}-[a-z0-9-]+$/;
// Regex apenas pro prefix nanoid (sem 0/o/1/i/l).
const PREFIX_ALPHABET = /^[abcdefghjkmnpqrstuvwxyz23456789]{8}$/;

/**
 * Cria um mock determinístico do `SupabaseClient<Database>` que responde a
 * `.from('lead_sites').select('id', { count, head }).eq('slug', x)` com a
 * sequência de `count`s informada — uma por chamada de `.eq`.
 *
 * Quando os counts da sequência se esgotam, lança um erro pra deixar claro
 * que o teste pediu mais consultas do que esperava.
 */
function createMockClient(counts: ReadonlyArray<number>) {
  let call = 0;
  const eqSpy = vi.fn(async () => {
    if (call >= counts.length) {
      throw new Error(
        `Mock client exhausted after ${call} eq() calls; teste pediu mais que o configurado`,
      );
    }
    const count = counts[call] as number;
    call += 1;
    return { count, error: null };
  });

  const fromSpy = vi.fn((table: string) => {
    if (table !== "lead_sites") {
      throw new Error(`Unexpected table: ${table}`);
    }
    return {
      select: vi.fn(() => ({
        eq: eqSpy,
      })),
    };
  });

  const client = {
    from: fromSpy,
  } as unknown as SupabaseClient<Database>;

  return { client, eqSpy, fromSpy, getCallCount: () => call };
}

describe("generateUniqueSlug()", () => {
  it("AC1 — retorna slug no formato <nanoid8>-<base> em 1 tentativa quando não há colisão", async () => {
    const { client, getCallCount } = createMockClient([0]);

    const slug = await generateUniqueSlug("Toyota do Recife", client);

    expect(slug).toMatch(SLUG_REGEX);
    const [prefix, ...rest] = slug.split("-");
    expect(prefix).toMatch(PREFIX_ALPHABET);
    expect(rest.join("-")).toBe("toyota-do-recife");
    expect(getCallCount()).toBe(1);
  });

  it("AC1 — base é truncada em 30 caracteres", async () => {
    const longName = "A".repeat(80); // slugify -> 80 'a's, deve ser cortada em 30
    const { client } = createMockClient([0]);

    const slug = await generateUniqueSlug(longName, client);

    const base = slug.slice(9); // pula `<8chars>-`
    expect(base).toHaveLength(30);
    expect(base).toBe("a".repeat(30));
  });

  it("AC1 — quando business_name produz slug vazio, usa 'lead' como base", async () => {
    const { client } = createMockClient([0]);

    const slug = await generateUniqueSlug("🚗", client);

    expect(slug).toMatch(SLUG_REGEX);
    expect(slug.endsWith("-lead")).toBe(true);
  });

  it("AC1 — prefix usa apenas o alfabeto seguro (sem 0/o/1/i/l)", async () => {
    // Roda o gerador várias vezes pra forçar entropia variada e validar que
    // todos os prefixes ficam dentro do alfabeto restrito.
    const { client } = createMockClient([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

    for (let i = 0; i < 10; i++) {
      const slug = await generateUniqueSlug("Toyota", client);
      const prefix = slug.split("-")[0] as string;
      expect(prefix).toMatch(PREFIX_ALPHABET);
    }
  });

  it("AC3 — retorna slug na 4ª tentativa quando as 3 primeiras colidem", async () => {
    const { client, getCallCount } = createMockClient([1, 1, 1, 0]);

    const slug = await generateUniqueSlug("Toyota", client);

    expect(slug).toMatch(SLUG_REGEX);
    expect(getCallCount()).toBe(4);
  });

  it("AC3 — consulta a tabela 'lead_sites' filtrando pela coluna 'slug'", async () => {
    const { client, fromSpy } = createMockClient([0]);

    await generateUniqueSlug("Toyota", client);

    expect(fromSpy).toHaveBeenCalledWith("lead_sites");
  });

  it("AC3/AC4 — lança SlugCollisionError com attempts=5 e business_name após 5 colisões", async () => {
    const businessName = "Toyota";
    const { client, getCallCount } = createMockClient([1, 1, 1, 1, 1]);

    let caught: unknown;
    try {
      await generateUniqueSlug(businessName, client);
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(SlugCollisionError);
    expect(caught).toBeInstanceOf(Error);
    const slugErr = caught as SlugCollisionError;
    expect(slugErr.attempts).toBe(5);
    expect(slugErr.business_name).toBe(businessName);
    expect(slugErr.message).toContain(businessName);
    expect(slugErr.message).toContain("5");
    expect(slugErr.name).toBe("SlugCollisionError");
    expect(getCallCount()).toBe(5);
  });

  it("AC3 — trata count null como zero (slot disponível)", async () => {
    // Supabase pode devolver count=null em alguns cenários; tratar como
    // ausência de registros (slug livre) é o comportamento defensivo.
    const counts = [null] as unknown as number[];
    const { client } = createMockClient(counts);

    const slug = await generateUniqueSlug("Toyota", client);

    expect(slug).toMatch(SLUG_REGEX);
  });
});

describe("SlugCollisionError", () => {
  it("AC4 — preserva attempts e business_name como readonly", () => {
    const err = new SlugCollisionError(5, "Toyota");

    expect(err.attempts).toBe(5);
    expect(err.business_name).toBe("Toyota");
    expect(err.name).toBe("SlugCollisionError");
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe(
      'Failed to generate unique slug for "Toyota" after 5 attempts',
    );
  });
});
