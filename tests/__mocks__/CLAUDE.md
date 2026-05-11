# `tests/__mocks__/` — Spec Técnica

## Propósito

Mock factories centralizados para clients externos consumidos pelo
projeto. Substituem `vi.mock(...)` ad-hoc duplicado em ~20 arquivos por
helpers tipados, com defaults sãos e API de override consistente.

Issue #203 (Sprint 0 #F6) introduziu este diretório. Documentação canônica
de uso vive em [`tests/CLAUDE.md` → "Mock factories"](../CLAUDE.md), com
exemplos por mock. Este arquivo mantém apenas a tabela de arquivos.

## Arquivos

| Path | Cliente mockado | Helpers principais |
|---|---|---|
| `supabase.ts` | `@supabase/supabase-js` (via `lib/supabase/*`) | `createMockSupabaseClient({tables})` retorna client chainable. Builders rastreados em `client.builders[table]`. `fromCalls` lista tabelas tocadas. |
| `anthropic.ts` | `@anthropic-ai/sdk` (usado em `lib/ai/anthropic.ts` e `lib/sites/generate-copy.ts`) | `anthropicMock()`, `mockAnthropicToolUse(input)`, `mockAnthropicTextResponse(text)`, `resetAnthropicMock()`, `anthropicState.create` (vi.fn() para `.mockRejectedValueOnce` etc.). |
| `apify.ts` | `apify-client` (usado em `lib/apify/*` e `lib/sites/brand-assets.ts`) | `apifyMock()`, `mockApifyActorRun(items)`, `mockApifyDatasetItems(items)`, `resetApifyMock()`, `apifyState.actorCall` / `.datasetListItems` (vi.fn()s). |

## Regras

1. **API ergonomic deve permanecer estável.** ~30 issues Sprint 1-8 vão
   consumir esses mocks — breaking changes aqui propagam dor. Adicione
   helpers novos quando precisar; não remova existentes.
2. **Defaults sãos.** Cada mock retorna shape "feliz" por default
   (`{data: null, error: null}`, `{items: []}`, tool_use vazio). Tests
   overridam apenas o que importa.
3. **Sem state global compartilhado entre tests.** `resetXMock()` em
   `beforeEach()` é obrigatório para evitar test pollution.
4. **Não mocka código de produção do projeto.** Apenas SDKs/clients
   externos. Para mockar `lib/...` use `vi.mock("@/lib/...")` inline.

## Smoke tests

Cobertura runtime dos mocks vive em `tests/unit/mocks/smoke.test.ts` —
garante que API ergonomic continua funcionando após edits aqui.

## Quando atualizar este `CLAUDE.md`

- Novo mock adicionado.
- Cliente externo mockado mudou de API (e.g., Anthropic SDK major bump).
- Helper público adicionado/removido.
