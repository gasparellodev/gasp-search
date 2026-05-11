/**
 * Factory tipada para `Tables<'lead_sites'>` (issue #203 / Sprint 0 #F6).
 *
 * Convenção `make<Entity>(overrides?: Partial<T>): T` — shape derivado de
 * `types/database.ts` (incluindo `signed_at` adicionado em #199).
 *
 * `variables: Json` no schema é fracamente tipado pra acomodar v1+v2 do
 * payload; este fixture usa `validSiteVariablesFixture` por default, mas
 * caller pode passar `{}` ou `null` via override.
 */
import { validSiteVariablesFixture } from "@/tests/fixtures/site-variables";
import type { Tables } from "@/types/database";

export type LeadSite = Tables<"lead_sites">;

/**
 * Site "padrão" — status `draft`, slug previsível, vinculado ao lead +
 * usuário do `makeLead()`. `variables` por default é o
 * `validSiteVariablesFixture` válido para `SiteVariables.parse()`.
 *
 * ```ts
 * const site = makeLeadSite({ status: 'published', published_at: '...' });
 * ```
 */
export function makeLeadSite(overrides: Partial<LeadSite> = {}): LeadSite {
  const base: LeadSite = {
    id: "33333333-3333-3333-8333-333333333333",
    user_id: "22222222-2222-2222-8222-222222222222",
    lead_id: "11111111-1111-1111-8111-111111111111",
    slug: "a1b2c3-autostar-veiculos",
    status: "draft",
    variables: validSiteVariablesFixture as unknown as LeadSite["variables"],
    visual_identity: null,
    generation_error: null,
    generated_at: "2026-05-01T12:30:00.000Z",
    published_at: null,
    sent_at: null,
    signed_at: null,
    archived_at: null,
    view_count: 0,
    last_viewed_at: null,
    created_at: "2026-05-01T12:00:00.000Z",
    updated_at: "2026-05-01T12:30:00.000Z",
  };
  return { ...base, ...overrides };
}
