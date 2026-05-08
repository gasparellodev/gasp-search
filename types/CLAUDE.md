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
| `database.ts` | Schema Supabase: 10 tables (Row/Insert/Update) — incluindo `lead_sites` (Phase 7 M1.1) — enums (`search_source`, `search_status`, `lead_stage`, `whatsapp_status`, `campaign_*`, `lead_message_*`, `lead_site_status`), helpers `Tables<T>`/`TablesInsert<T>`/`TablesUpdate<T>`/`Enums<T>` |
| `lead-site.ts` | Schemas Zod canônicos para `lead_sites.variables` (Phase 7 M1.2). Exporta `SiteVariables` (payload completo persistido), `SiteCar` (estoque), `SiteCopySchema` (subset textual emitido pela IA per §6 do spec) e `SiteCopyCar`. Tipos TS via `z.infer<>`: `SiteVariables`, `SiteCar`, `SiteCopy`, `SiteCopyCar`. Fonte canônica: §4 do spec mestre em `docs/superpowers/specs/2026-05-08-gerador-sites-concessionarias-design.md` (linhas 106–180). **Reproduzido verbatim** — qualquer mudança vira PR de spec primeiro, depois schema. Carrega lógica runtime (validação) — entra no coverage do Vitest. |

## Como regenerar `database.ts`

Após aplicar a migration `0001_init.sql` no Supabase:

```bash
npx supabase login
npx supabase gen types typescript --project-id <PROJECT_REF> > types/database.ts
```

Ou para projeto local:

```bash
npx supabase start
npx supabase gen types typescript --local > types/database.ts
```

> O conteúdo atual foi escrito à mão para refletir a migration, **antes** da aplicação real. Após `gen types`, pode haver pequenas diferenças de formatação ou helpers extras (`Database['public']['CompositeTypes']`, etc.).
