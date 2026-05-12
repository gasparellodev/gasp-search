# `types/` — Spec Técnica

## Propósito

Tipos TypeScript globais do projeto:
- **`database.ts`**: shape do schema Supabase (gerado por `supabase gen types`).
- **`domain.ts`** (pendente): tipos específicos do domínio que envolvem joins, agregados ou views — não capturados em `database.ts`. Criado conforme issues posteriores precisarem (#15+).

## Como adicionar

- **Tipos do banco**: `database.ts` é a saída canônica do **Supabase MCP
  `generate_typescript_types`** (Phase 6 / issue #138c). Regenerar sempre que
  uma migration nova entrar — ver "Como regenerar `database.ts`" abaixo.
  Edits manuais permitidos apenas em duas situações:
    1. Tightening de unions onde a tabela usa `text` + check constraint
       (Postgres não tem enum nativo). Hoje aplicado em:
       `campaigns.type`, `consent_logs.action`, `lead_sites.status`.
       Cada tightening tem comentário inline justificando.
    2. Inet columns (`consent_logs.ip`, `lead_form_submissions.consent_ip`):
       o gerador entrega `unknown`; mantemos `string | null` (cliente
       Supabase v2 serializa inet como texto). Comentário inline cobre.
    3. JSONB com default (`lead_sites.variables`): gerador marca como
       obrigatório no `Insert` porque NOT NULL; mantemos `?` porque há
       default `'{}'::jsonb` na migration 0010 (gerador não detecta).
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
| `database.ts` | **Fonte canônica: Supabase MCP `generate_typescript_types`** contra projeto `pvazzozzqwwshgacmafv` (Phase 6 / #138c, 2026-05-12). Inclui `__InternalSupabase.PostgrestVersion`, helpers compositional `Tables<T>`/`TablesInsert<T>`/`TablesUpdate<T>`/`Enums<T>`/`CompositeTypes<>`, suporte `{ schema: ... }` em todos os helpers, runtime export `Constants` com listas literais de enums, `Functions` com `__migrate_site_variables_v1_to_v2`, e `Relationships` por tabela (FKs). Tightening manuais sobre o output do gerador: `campaigns.type`, `consent_logs.action`, `lead_sites.status` mantidos como unions canônicas (text + check no banco); `consent_logs.ip` e `lead_form_submissions.consent_ip` mantidos como `string | null` (inet serializado como texto); `lead_sites.variables` mantido `?` no Insert (default `'{}'::jsonb`). Cada tightening tem comentário inline justificando. Workflow para regenerar: ver "Como regenerar `database.ts`" abaixo. `tests/unit/types/database.test.ts` defende o shape (quebra build em divergência). |
| `lead-site.ts` | Schemas Zod canônicos para `lead_sites.variables` (Phase 7 M1.2). Exporta `SiteVariables` (payload completo persistido), `SiteCar` (estoque), `SiteCopySchema` (subset textual emitido pela IA per §6) e constantes `SITE_STOCK_MIN_CARS=4`, `SITE_STOCK_MAX_CARS=60`, `SITE_COPY_MAX_CARS=6`. Tipos TS via `z.infer<>`: `SiteVariables`, `SiteCar`, `SiteCopy`, `SiteCopyCar`. O gerador/copy inicial continua emitindo 4-6 carros, mas o payload persistido aceita estoque maior desde #225 para suportar paginação pública. Carrega lógica runtime (validação) — entra no coverage do Vitest. |
| `visual-identity.ts` | Phase 7 Sprint 2 #A1 #215 — Schema Zod canônico pro shape persistido em `lead_sites.visual_identity` (JSONB criado em migration 0019). Exporta `VisualIdentityManifestSchema` (7 campos: `hero_url`, `categories_urls[]` 1-6, `about_url`, `contact_url`, `generated_at` ISO+offset, `model` enum, `cost_estimate_brl` >= 0) + `VisualIdentityModelSchema` (`'gpt-image-2-2026-04-21' \| 'gpt-image-1-mini'` — snapshot pinado per spike #216; DALL-E 3 NÃO é suportado, deprecada 2026-05-12). Tipos TS via `z.infer<>`: `VisualIdentityManifest`, `VisualIdentityModel`. URLs aceitam absolute HTTP(S) ou path local `/...` (mesmo pattern de `lead-site.ts:imageUrlOrPath`). Consumido pela action `regenerateVisualIdentity` (#216) e admin UI de regenerate (#217). Carrega lógica runtime (validação) — entra no coverage do Vitest. |

## Como regenerar `database.ts`

Três caminhos equivalentes (Phase 6 / #138c — passamos a tratar o MCP como
fonte canônica; antes era hand-written):

```bash
# 1. Local (após `supabase start` rodando):
npm run gen:types

# 2. Remoto via CLI (requer `SUPABASE_PROJECT_REF` no env):
SUPABASE_PROJECT_REF=<ref> npm run gen:types:remote

# 3. Remoto via MCP (preferido em sessão de agent):
#    Invocar a tool `plugin-supabase-supabase.generate_typescript_types`
#    com `project_id` = `pvazzozzqwwshgacmafv` (produção atual) e colar o
#    output em `types/database.ts`, mantendo as anotações de tightening
#    manual (documentadas na seção "Como adicionar"). Ver workflow em
#    `docs/superpowers/reports/2026-05-12-wave-0-supabase-sync.md`.
```

Os três caminhos equivalem a `supabase gen types typescript`. O método
**MCP é preferido** porque dispensa CLI/secret local e usa o projeto
remoto autoritativo.

**Convenção:** ao adicionar migration nova em `supabase/migrations/`,
regenerar `database.ts` (qualquer caminho) e commitar no mesmo PR.
**NÃO** é step do CI (requer Supabase local ou tokens MCP); a defesa é o
test type-level em `tests/unit/types/database.test.ts` que quebra se
shape divergir do contrato.

> Tightening manual (unions canônicas, inet `string | null`, defaults JSONB)
> aplicado em cima do output do gerador. Sempre que regenerar, comparar o
> diff e reaplicar os comentários inline — ver "Como adicionar" para a
> lista exaustiva. O gerador entrega `string`/`unknown` onde o banco usa
> check constraints/inet, mas o codebase trata o tipo mais restrito como
> contrato.
