import type { SupabaseClient } from "@supabase/supabase-js";
import { customAlphabet } from "nanoid";

import { slugify } from "@/lib/utils/slug";
import type { Database } from "@/types/database";

import { SlugCollisionError } from "./errors";

/**
 * Alfabeto seguro pra prefix do slug.
 *
 * Sem `0/o/1/i/l` por legibilidade — esses caracteres são facilmente
 * confundidos quando alguém lê o link em voz alta no WhatsApp ou tenta
 * digitá-lo manualmente.
 *
 * Espaço total: 30^8 = ~6.56e11 combinações por base. Com 5 tentativas e
 * o unique index `lead_sites_slug_uniq` no DB, a probabilidade de colisão
 * acumulada é desprezível em qualquer cenário realista.
 */
const SAFE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

const PREFIX_LENGTH = 8;
const MAX_BASE_LENGTH = 30;
const MAX_ATTEMPTS = 5;

const generatePrefix = customAlphabet(SAFE_ALPHABET, PREFIX_LENGTH);

/**
 * Gera um slug global único pra um `lead_site`, no formato
 * `<nanoid8>-<base>` (ex: `j7k2p9q4-toyota-do-recife`).
 *
 * O prefixo nanoid vem **antes** da base por dois motivos:
 *  1. WhatsApp encurta links a partir do início — manter randomness no
 *     começo evita que duas concessionárias da mesma cidade compartilhem
 *     a preview encurtada.
 *  2. Reduz adivinhação por força bruta de outros slugs do mesmo lead.
 *
 * Contrato com o DB:
 *  - Esta função **propõe** um slug consultando `lead_sites.slug` via
 *    `count: 'exact', head: true`. Há uma janela TOCTOU entre o SELECT e
 *    o INSERT que o caller fará.
 *  - A garantia final de unicidade é o unique index `lead_sites_slug_uniq`
 *    criado em #153 (M1.1). Em race condition, o INSERT do caller falhará
 *    com `23505` (Postgres `unique_violation`); cabe ao caller decidir
 *    entre re-chamar `generateUniqueSlug` ou propagar.
 *
 * @param business_name Nome bruto do estabelecimento (será normalizado
 *   via `slugify` e truncado em 30 chars).
 * @param client `SupabaseClient<Database>` injetado por DI — facilita
 *   testes determinísticos e suporta tanto sessão de usuário (RLS) quanto
 *   service-role.
 *
 * @throws {SlugCollisionError} se as 5 tentativas colidirem.
 */
export async function generateUniqueSlug(
  business_name: string,
  client: SupabaseClient<Database>,
): Promise<string> {
  const base = slugify(business_name).slice(0, MAX_BASE_LENGTH);

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const candidate = `${generatePrefix()}-${base}`;

    const { count } = await client
      .from("lead_sites")
      .select("id", { count: "exact", head: true })
      .eq("slug", candidate);

    // count===null pode ocorrer em alguns cenários da PostgREST API
    // (ex: linha sem permissão visível). Tratamos como "slot livre" —
    // o unique index é o guardião final.
    if (count === 0 || count == null) {
      return candidate;
    }
  }

  throw new SlugCollisionError(MAX_ATTEMPTS, business_name);
}
