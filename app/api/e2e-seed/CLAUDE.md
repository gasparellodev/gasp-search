# `app/api/e2e-seed/` — Spec Técnica

## Propósito

Rotas test-only que **NUNCA** podem rodar em produção. Cada handler
faz `process.env.NODE_ENV === "production"` → 404 antes de qualquer
processamento. Existem para automação E2E (Playwright) sem precisar
invocar cadeias caras (IA, Apify, etc.).

## Como adicionar

1. Criar pasta com nome descritivo (`<feature>/`).
2. `route.ts` com **gate triplo** obrigatório:
   - `NODE_ENV === "production"` → 404.
   - Env de habilitação (e.g., `TEST_*_TOKEN`) ausente → 503.
   - Token na query/header não bate → 401.
3. Surface narrow: 1-2 operações específicas por rota. **Nunca** SQL
   genérico, RPC arbitrária, ou shell.
4. Adicionar unit test em `tests/unit/app/api/e2e-seed/<feature>/route.test.ts`
   cobrindo os 3 paths de gate + happy path.

## Regras

1. **Service role é OK aqui** porque: gate triplo + surface narrow +
   não roda em prod. Documentar trade-off no comment do arquivo.
2. **Token não vai pro repo.** Gerado por dev/CI e injetado via env.
3. **Logs estruturados** sem PII — não logar bodies inteiros, slugs OK.
4. **Sem dependência de outras rotas** — rotas test-only são auto-
   contidas pra evitar surprise side-effects.

## Arquivos

| Path | Propósito |
|---|---|
| `seed-lead-site/route.ts` | Phase 7 #166. POST cria `lead` + `lead_sites` row pro Playwright spec; DELETE limpa após o teste. Gate: `NODE_ENV != production` + `TEST_SEED_TOKEN` + `TEST_SEED_USER_ID`. |

## Dependências

- `@/lib/supabase/service` — service-role client (bypassa RLS).
- `@/types/database` — tipos das tabelas.

## Quando atualizar este `CLAUDE.md`

- Nova rota test-only adicionada.
- Mudança no modelo de gate (e.g., adicionar HMAC).
