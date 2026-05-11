# `types/` — Spec Técnica

## Propósito

Tipos TypeScript globais do projeto:
- **`database.ts`**: shape do schema Supabase (gerado por `supabase gen types`).
- **`domain.ts`** (pendente): tipos específicos do domínio que envolvem joins, agregados ou views — não capturados em `database.ts`. Criado conforme issues posteriores precisarem (#15+).

## Como adicionar

- **Tipos do banco**: regenerar `database.ts` via Supabase CLI; nunca editar à mão (a menos que ainda não haja projeto Supabase aplicado, como no MVP inicial).
- **Tipos de domínio**: arquivo novo em `types/<area>.ts`. Exportar interfaces/types nominais. Nada de `any`.
- **Tipos compartilhados de validators**: prefira `z.infer<typeof Schema>` direto no arquivo do schema (em `lib/validators/`); só promova a `types/` quando múltiplas áreas consumirem.

## Regras de negócio

1. **Tipos do banco são contrato.** Mudanças em `database.ts` precisam vir acompanhadas de mudança em `supabase/migrations/`.
2. **`Tables<T>`, `TablesInsert<T>`, `TablesUpdate<T>` helpers** são os pontos de uso preferidos. Evite `Database['public']['Tables']['leads']['Row']` direto em código de feature.
3. **Não importar de `lib/supabase`** dentro de `types/` para evitar cycles.
4. **Strict null safety**: o helper `Tables<>` reflete `null` exatamente como no banco — não trate `null` como "vazio". Use `??` ou narrowing.

## Arquivos

| Path | Propósito |
|---|---|
| `database.ts` | Schema Supabase: 10 tables (Row/Insert/Update) — incluindo `lead_sites` (Phase 7 M1.1, com colunas `signed_at` adicionada em #199 espelhando migration 0018 e `visual_identity: Json \| null` em #215 espelhando migration 0019) — enums (`search_source`, `search_status`, `lead_stage`, `whatsapp_status`, `campaign_*`, `lead_message_*`, `lead_site_status`), helpers `Tables<T>`/`TablesInsert<T>`/`TablesUpdate<T>`/`Enums<T>`. **Convenção:** arquivo é hand-written enquanto não há projeto Supabase remoto pra `gen types`; novas colunas em migrations precisam de edit manual aqui no mesmo PR (test type-level em `tests/unit/types/database.test.ts:keyof LeadSiteRow` garante que divergência vira regression). |
| `lead-site.ts` | Schemas Zod canônicos para `lead_sites.variables` (Phase 7 M1.2). Exporta `SiteVariables` (payload completo persistido), `SiteCar` (estoque), `SiteCopySchema` (subset textual emitido pela IA per §6) e constantes `SITE_STOCK_MIN_CARS=4`, `SITE_STOCK_MAX_CARS=60`, `SITE_COPY_MAX_CARS=6`. Tipos TS via `z.infer<>`: `SiteVariables`, `SiteCar`, `SiteCopy`, `SiteCopyCar`. O gerador/copy inicial continua emitindo 4-6 carros, mas o payload persistido aceita estoque maior desde #225 para suportar paginação pública. Carrega lógica runtime (validação) — entra no coverage do Vitest. |
| `visual-identity.ts` | Phase 7 Sprint 2 #A1 #215 — Schema Zod canônico pro shape persistido em `lead_sites.visual_identity` (JSONB criado em migration 0019). Exporta `VisualIdentityManifestSchema` (7 campos: `hero_url`, `categories_urls[]` 1-6, `about_url`, `contact_url`, `generated_at` ISO+offset, `model` enum, `cost_estimate_brl` >= 0) + `VisualIdentityModelSchema` (`'gpt-image-2-2026-04-21' \| 'gpt-image-1-mini'` — snapshot pinado per spike #216; DALL-E 3 NÃO é suportado, deprecada 2026-05-12). Tipos TS via `z.infer<>`: `VisualIdentityManifest`, `VisualIdentityModel`. URLs aceitam absolute HTTP(S) ou path local `/...` (mesmo pattern de `lead-site.ts:imageUrlOrPath`). Consumido pela action `regenerateVisualIdentity` (#216) e admin UI de regenerate (#217). Carrega lógica runtime (validação) — entra no coverage do Vitest. |

## Como regenerar `database.ts`

Issue #203 (Sprint 0 #F6) adicionou scripts npm para padronizar o fluxo:

```bash
# Local (após `supabase start` rodando):
npm run gen:types

# Remoto (requer `SUPABASE_PROJECT_REF` no env):
SUPABASE_PROJECT_REF=<ref> npm run gen:types:remote
```

Equivalem a `supabase gen types typescript --local` e
`supabase gen types typescript --project-id $SUPABASE_PROJECT_REF`
respectivamente.

**Convenção:** ao adicionar uma migration nova em `supabase/migrations/`,
rodar `gen:types` localmente e commitar `types/database.ts` no mesmo PR.
**NÃO** é um step do CI (requer secret ou Supabase local rodando); a
defesa é o test type-level em `tests/unit/types/database.test.ts` que
quebra se shape divergir do esperado.

> O conteúdo atual foi escrito à mão para refletir a migration, **antes** da aplicação real. Após `gen types`, pode haver pequenas diferenças de formatação ou helpers extras (`Database['public']['CompositeTypes']`, etc.).
