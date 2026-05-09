import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

// ---------------------------------------------------------------------------
// checkDailyInstanceLimit (#173) — guard hard de 50 envios/dia/instância
// (anti-ban WhatsApp).
//
// Decisão V1:
//   - **Janela rolling 24h** (não calendar day) — 50 sends nas últimas 24h.
//   - **Boundary inclusive**: count >= 50 → bloqueado. (49 ainda passa.)
//   - **Fail-open**: erro de DB ou `count: null` retorna `allowed: true`
//     pra não bloquear o user num hiccup transitório. Consistente com o
//     `enforceRateLimit` do `generateLeadSite` (#159) — mesma filosofia.
//
// Modelagem do "instance":
//   `whatsapp_instances` é 1:1 com `user_id` (UNIQUE constraint na migration
//   0003). `lead_messages` não tem `instance_id` — mas como o user só pode
//   ter UMA instância conectada por vez, contar `lead_messages` por
//   `user_id` é equivalente a contar por instância. A API exige `userId`
//   (não `instanceId`) por isso — e a doc da issue trata como sinônimos.
// ---------------------------------------------------------------------------

/**
 * Hard limit V1 de envios outbound por instância WhatsApp em 24h rolling.
 * 50 é a recomendação prática anti-ban — ajustável em V2 caso o produto
 * habilite tiers/profiles diferentes.
 */
export const DAILY_INSTANCE_LIMIT = 50;

/** Janela rolling em milissegundos. 24h. */
const WINDOW_MS = 24 * 60 * 60 * 1_000;

/**
 * Resultado discriminado de `checkDailyInstanceLimit`.
 *
 * - `allowed: true` → caller pode prosseguir com o envio. `current`
 *   reflete quantos sends já estão na janela (use pra logging / UX).
 * - `allowed: false` → caller deve abortar. `limit` é exposto pra
 *   facilitar mensagens amigáveis na UI ("Limite diário de {limit} ...").
 */
export type DailyInstanceLimitResult =
  | { allowed: true; current: number }
  | { allowed: false; current: number; limit: number };

/**
 * Conta envios outbound de um user nas últimas 24h. Bloqueia se atingiu
 * `DAILY_INSTANCE_LIMIT` (default 50).
 *
 * @param userId — id do user no Supabase Auth. Como `whatsapp_instances`
 *   é 1:1 com user, isso identifica unicamente a instância.
 * @param supabase — cliente authenticated (RLS) ou service-role. Em
 *   produção, callers usam o mesmo cliente que vai disparar o send
 *   (RLS isola corretamente).
 *
 * Não lança. Em qualquer falha do Supabase, retorna `allowed: true`
 * (fail-open). Falhas devem ser logadas pelo caller via outro canal
 * (não aqui — esse helper é puro de I/O minimal).
 */
export async function checkDailyInstanceLimit(
  userId: string,
  supabase: SupabaseClient<Database>,
): Promise<DailyInstanceLimitResult> {
  const sinceIso = new Date(Date.now() - WINDOW_MS).toISOString();

  const { count, error } = await supabase
    .from("lead_messages")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("direction", "outbound")
    .gte("created_at", sinceIso);

  // Fail-open: hiccup de DB não bloqueia user. Caller é responsável por
  // observar (`error` vem `null` em sucesso; `count` pode vir null se a
  // contagem falhou silenciosamente).
  if (error) {
    return { allowed: true, current: 0 };
  }

  const current = count ?? 0;
  if (current >= DAILY_INSTANCE_LIMIT) {
    return { allowed: false, current, limit: DAILY_INSTANCE_LIMIT };
  }

  return { allowed: true, current };
}
