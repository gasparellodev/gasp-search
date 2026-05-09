# `lib/sites/` — Domain helpers para Site Generator (Phase 7)

## Propósito

Lógica server-side do gerador de mini-sites para leads de concessionárias
(Phase 7 — Site Generator). Inclui:

- Geração de slug único (`slug.ts`).
- Erros tipados do domínio (`errors.ts`).
- Geração de copy via Anthropic (`generate-copy.ts`, #158).
- Futuramente: orquestração `generateLeadSite` (#159), pipeline de brand
  assets (#156), bank de stock photos (#157).

## Como adicionar

- 1 responsabilidade por arquivo. Funções compostas vão pra um
  orquestrador dedicado (`generate.ts` na issue #159).
- Erros customizados vão sempre em `errors.ts` (não inline) — facilita
  catch tipado no caller.
- **DI vs singleton (escolher por client):**
  - **Supabase:** DI explícita — receber `client: SupabaseClient<Database>`
    como parâmetro. Razões: suporte a `service-role` vs sessão de usuário
    no mesmo helper; testes sem `vi.mock` global.
  - **Anthropic:** singleton compartilhado — `import { anthropic } from
    '@/lib/ai/anthropic'`. Razão: o SDK não tem variantes de auth, a chave
    é única, e o caching de cliente economiza handshake. Testes mockam
    `@anthropic-ai/sdk` via `vi.mock` (ver `generate-copy.test.ts`).
- TDD obrigatório: teste em `tests/unit/lib/sites/<nome>.test.ts` antes
  da implementação.
- **Mock Anthropic em CI (BLOQUEANTE).** Nenhum teste em `tests/unit/`
  pode chamar a API real. Padrão: `vi.mock('@anthropic-ai/sdk', () => ({
  Anthropic: class { messages = { create: vi.fn() }; constructor() {} } }))`.
  Ver `tests/unit/lib/sites/generate-copy.test.ts` como referência.

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
| `errors.ts` | `SlugCollisionError` (slug) + `GenerationError` / `GenerationErrorCode` (copy IA) — todos com contexto estruturado pra observabilidade. |
| `generate-copy.ts` | `generateCopy(input)` — 1 call Anthropic Sonnet 4.6 com tool use forçado `emit_site_copy` + system prompt cacheado. Valida output via `SiteCopySchema.parse`. Sem retry interno; orquestrador (#159) decide via `GenerationError.retryable`. Exporta `SYSTEM_PROMPT`, `GENERATION_VERSION='v1.0.0'`, `GENERATION_MODEL='claude-sonnet-4-6'`. |

## Contrato de erro do `generateCopy`

| `code` | `retryable` | Quando |
|---|---|---|
| `no_tool_use` | `true` | Resposta sem block `tool_use` — modelo pode acertar na próxima |
| `api_error` | `true` | SDK lançou (rate-limit / 5xx / network) |
| `schema_validation` | `false` | `tool_use.input` não passa em `SiteCopySchema` (cause = `ZodError`) |
| `max_tokens` | `false` | `stop_reason='max_tokens'` (precisa input menor, não retry) |
| `unknown` | `false` | Fallback defensivo |

`GENERATION_VERSION` é persistido em `lead_sites.variables.generation_version`. Bump SEMVER quando `SiteCopySchema` ou `SYSTEM_PROMPT` mudarem materialmente — permite migração offline de sites antigos.

## Dependências

- `nanoid@^5` — `customAlphabet` para prefix legível.
- `@supabase/supabase-js` — tipo `SupabaseClient<Database>` (DI).
- `@anthropic-ai/sdk` — via `@/lib/ai/anthropic` (singleton).
- `zod-to-json-schema@^3.23` — converte `SiteCopySchema` em JSON Schema pro tool use.
- `@/lib/utils/slug` — base normalization.
- `@/types/lead-site` — `SiteCopySchema` + `SiteCopy` type (issue #154).
- `@/types/database` — schema dos lead_sites.
