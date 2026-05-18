import type { SupabaseClient } from "@supabase/supabase-js";
import { customAlphabet } from "nanoid";

import { slugify } from "@/lib/utils/slug";
import type { Database } from "@/types/database";

import { SlugCollisionError } from "./errors";

/**
 * Slugs reservados pelo app (rotas internas) que NÃO podem ser usados
 * como slug de `lead_sites` — colidiriam com paths existentes ou
 * geraríam confusão UX. Lista conservadora; estender quando rotas
 * novas surgirem.
 */
const RESERVED_SLUGS = new Set<string>([
  "admin",
  "api",
  "app",
  "auth",
  "callback",
  "campaigns",
  "dashboard",
  "leads",
  "login",
  "messages",
  "pipeline",
  "search",
  "settings",
  "sites",
  "support",
  "test",
  "tests",
]);

const CUSTOM_SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;
const CUSTOM_SLUG_MIN_LENGTH = 3;
const CUSTOM_SLUG_MAX_LENGTH = 40;

export type CustomSlugValidationCode =
  | "empty"
  | "too_short"
  | "too_long"
  | "invalid_chars"
  | "double_hyphen"
  | "reserved";

export interface CustomSlugValidationResult {
  ok: boolean;
  code: CustomSlugValidationCode | null;
  message: string | null;
  normalized: string;
}

/**
 * Validação pura de slug customizado fornecido pelo operador (sprint
 * B1). NÃO consulta o DB — apenas formato + blacklist. A unicidade é
 * conferida pelo orquestrador `generateLeadSite` em outro passo
 * (`isCustomSlugAvailable`).
 *
 * Regras:
 *  - Comprimento 3..40 chars
 *  - Apenas `[a-z0-9-]` (lowercase + dígitos + hífen)
 *  - Não pode começar nem terminar com `-`
 *  - Sem `--` consecutivos
 *  - Não pode bater com lista de slugs reservados
 *
 * `normalized` retorna o valor lower+trim aplicado, mesmo em falha,
 * pra UI poder mostrar o "que ficou" pro operador.
 */
export function validateCustomSlug(
  input: string,
): CustomSlugValidationResult {
  const normalized = input.trim().toLowerCase();

  if (normalized.length === 0) {
    return {
      ok: false,
      code: "empty",
      message: "Informe um slug pro site.",
      normalized,
    };
  }
  if (normalized.length < CUSTOM_SLUG_MIN_LENGTH) {
    return {
      ok: false,
      code: "too_short",
      message: `O slug precisa ter pelo menos ${CUSTOM_SLUG_MIN_LENGTH} caracteres.`,
      normalized,
    };
  }
  if (normalized.length > CUSTOM_SLUG_MAX_LENGTH) {
    return {
      ok: false,
      code: "too_long",
      message: `O slug não pode passar de ${CUSTOM_SLUG_MAX_LENGTH} caracteres.`,
      normalized,
    };
  }
  if (normalized.includes("--")) {
    return {
      ok: false,
      code: "double_hyphen",
      message: "Use apenas um hífen consecutivo (sem `--`).",
      normalized,
    };
  }
  if (!CUSTOM_SLUG_REGEX.test(normalized)) {
    return {
      ok: false,
      code: "invalid_chars",
      message: "Use só letras minúsculas, números e hífens (sem começar/terminar com hífen).",
      normalized,
    };
  }
  if (RESERVED_SLUGS.has(normalized)) {
    return {
      ok: false,
      code: "reserved",
      message: "Esse slug está reservado pelo app. Escolha outro.",
      normalized,
    };
  }
  return { ok: true, code: null, message: null, normalized };
}

/**
 * Deriva sugestão de slug a partir do nome do negócio. Reuso de
 * `slugify` + clamp em `CUSTOM_SLUG_MAX_LENGTH`. Pode retornar string
 * vazia se `business_name` não tiver letra alguma (caller decide
 * fallback).
 */
export function suggestSlugFromName(business_name: string): string {
  return slugify(business_name).slice(0, CUSTOM_SLUG_MAX_LENGTH);
}

/**
 * Verifica disponibilidade do slug no DB. Pure I/O wrapper —
 * orquestrador chama isto antes do upsert pra dar erro amigável
 * (vs falhar no unique index).
 *
 * Retorna `true` quando livre (count === 0 ou null por permissão).
 * Mesma semântica de `count === null` que `generateUniqueSlug` usa.
 */
export async function isCustomSlugAvailable(
  candidate: string,
  client: SupabaseClient<Database>,
): Promise<boolean> {
  const { count } = await client
    .from("lead_sites")
    .select("id", { count: "exact", head: true })
    .eq("slug", candidate);
  return count === 0 || count == null;
}

export const CUSTOM_SLUG_LIMITS = {
  min: CUSTOM_SLUG_MIN_LENGTH,
  max: CUSTOM_SLUG_MAX_LENGTH,
} as const;

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

export interface SlugifyVehicleInput {
  brand: string;
  model: string;
  year: number;
  id: string;
}

/**
 * Gera slug de detalhe de veículo no formato
 * `{brand}-{model}-{year}-{idShort4}`.
 *
 * `idShort4` usa os 4 primeiros caracteres do id fornecido. Colisão é
 * aceita no MVP conforme refinamento da #232; payloads antigos continuam
 * válidos porque a rota ainda faz lookup por `car.slug` persistido.
 */
export function slugifyVehicle(input: SlugifyVehicleInput): string {
  const base = slugify(`${input.brand} ${input.model} ${input.year}`);
  const idShort4 = slugify(input.id).replace(/-/g, "").slice(0, 4);
  return `${base}-${idShort4 || "0000"}`;
}

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
