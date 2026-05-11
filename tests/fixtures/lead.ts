/**
 * Factory tipada para `Tables<'leads'>` (issue #203 / Sprint 0 #F6).
 *
 * Convenção `make<Entity>(overrides?: Partial<T>): T` — shape derivado de
 * `types/database.ts` para garantir compile-time break se schema mudar.
 *
 * **Geo fields:** o schema atual de `leads` (verificado em
 * `types/database.ts:108-189`) **não** tem `latitude`/`longitude`/
 * `google_place_id`. Apenas `city`/`state`/`country`. Se a observação 9597
 * vier a ser endereçada (adicionar geo no Lead), este fixture precisa
 * ganhar esses campos no mesmo PR da migration — o compile-time error
 * em `Tables<'leads'>` será o sentinel.
 */
import type { Tables } from "@/types/database";

export type Lead = Tables<"leads">;

/**
 * Lead "padrão" — concessionária em São Paulo, source google_maps, stage
 * `new`. Suficiente para a maioria dos tests; customize via `overrides`.
 *
 * ```ts
 * const lead = makeLead({ city: 'Porto Alegre', stage: 'qualified' });
 * ```
 */
export function makeLead(overrides: Partial<Lead> = {}): Lead {
  const base: Lead = {
    id: "11111111-1111-1111-8111-111111111111",
    user_id: "22222222-2222-2222-8222-222222222222",
    source: "google_maps",
    source_search_job_id: null,
    name: "AutoStar Veículos",
    category: "concessionaria",
    city: "São Paulo",
    state: "SP",
    country: "BR",
    phone: "1133334444",
    email: "contato@autostar.com.br",
    website: "autostar.com.br",
    instagram_handle: "autostar",
    whatsapp: "5511999990000",
    has_website: true,
    rating: 4.6,
    reviews_count: 124,
    followers_count: 5600,
    stage: "new",
    score: 78,
    notes: null,
    raw: null,
    enriched_at: null,
    created_at: "2026-05-01T12:00:00.000Z",
    updated_at: "2026-05-01T12:00:00.000Z",
  };
  return { ...base, ...overrides };
}
