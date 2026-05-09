# `lib/sites/` — Domain helpers para Site Generator (Phase 7)

## Propósito

Lógica server-side do gerador de mini-sites para leads de concessionárias
(Phase 7 — Site Generator). Inclui:

- Geração de slug único (`slug.ts`).
- Erros tipados do domínio (`errors.ts`).
- Futuramente: orquestração `generateLeadSite` (#159), geração de copy
  via Anthropic (#158), pipeline de brand assets (#156), bank de stock
  photos (#157).

## Como adicionar

- 1 responsabilidade por arquivo. Funções compostas vão pra um
  orquestrador dedicado (`generate.ts` na issue #159).
- Erros customizados vão sempre em `errors.ts` (não inline) — facilita
  catch tipado no caller.
- DI explícita pra clients (Supabase, Anthropic): receber como parâmetro,
  **NÃO** importar singleton. Isso garante:
  - Testes sem `vi.mock` global.
  - Suporte a service-role vs sessão de usuário no mesmo helper.
- TDD obrigatório: teste em `tests/unit/lib/sites/<nome>.test.ts` antes
  da implementação.

## Regras de negócio

1. **Slug global único.** `lead_sites.slug` é único em toda a tabela
   (não escopado por `user_id`) porque rotas públicas (`/s/<slug>`) não
   conhecem o usuário. O DB enforça via unique index `lead_sites_slug_uniq`
   (criado na migration de #153).
2. **TOCTOU é responsabilidade do caller.** Funções aqui propõem
   resultados consultando o DB; a garantia final é o constraint do DB.
   `generateUniqueSlug` propõe, mas `INSERT` em `lead_sites` pode falhar
   com `23505` (`unique_violation`) em race condition — caller decide
   retry vs propagar.
3. **Server-only por padrão.** Helpers que tocam Supabase/Anthropic
   importam `server-only` (a pasta como um todo é tratada como server).
   Hoje `slug.ts`/`errors.ts` não precisam (são puros + recebem client
   por DI), mas o padrão vale pra novos arquivos.
4. **Sem `any`.** Use tipos do `Database` (`@/types/database`).

## Arquivos

| Path | Propósito |
|---|---|
| `slug.ts` | `generateUniqueSlug(business_name, client)` — `<nanoid8>-<base>` com retry × 5 contra `lead_sites.slug`. Lança `SlugCollisionError` em exhaustão. Alfabeto sem `0/o/1/i/l`. |
| `errors.ts` | `SlugCollisionError` — carrega `attempts` e `business_name` readonly pra observabilidade. |

## Dependências

- `nanoid@^5` — `customAlphabet` para prefix legível.
- `@supabase/supabase-js` — tipo `SupabaseClient<Database>` (DI).
- `@/lib/utils/slug` — base normalization.
- `@/types/database` — schema dos lead_sites.
