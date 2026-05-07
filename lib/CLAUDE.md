# `lib/` — Spec Técnica

## Propósito

Código server-side e utilitários compartilhados (não-componentes). Inclui clients (Supabase, Apify, Anthropic), validators (Zod), e helpers puros.

## Como adicionar

- **Client/factory** (Supabase, Apify, Anthropic): pasta com nome do serviço (`supabase/`, `apify/`, `ai/`).
- **Validators**: `lib/validators/<recurso>.ts` exportando schemas Zod.
- **Helpers puros**: `lib/<topico>.ts` (e.g., `lib/utils.ts`, `lib/env.ts`).
- **Sempre** com testes unitários em `tests/unit/lib/<...>.test.ts`. TDD: teste antes da implementação.

## Regras de negócio

1. **Server-only por padrão.** Arquivos em `lib/` que tocam tokens privados (`SUPABASE_SERVICE_ROLE_KEY`, `APIFY_TOKEN`, `ANTHROPIC_API_KEY`) **NÃO** devem ser importados por Client Components. Use marker `import "server-only"` no topo desses arquivos.
2. **`createServerClient` lê cookies do request** — não pode ser usado em código que roda fora de um request handler / Server Component. Não cachear instância.
3. **Validators são fonte da verdade do shape**. API routes e Server Actions sempre validam input via Zod antes de qualquer side effect.
4. **`lib/utils.cn`** é o único helper de classe condicional para Tailwind. Importar dele em todo lugar.
5. **Sem `any`** — preferir `unknown` + narrowing.
6. **Erros de I/O lançam erros tipados** (e.g., `class ApifyRunError extends Error`); o handler de API converte em response amigável.

## Arquivos

| Path | Propósito |
|---|---|
| `utils.ts` | `cn()` = `twMerge(clsx(...))`, default helper de classe |

> A medida que features chegam:
> - `env.ts` — Zod validator das envs (#7)
> - `supabase/server.ts`, `client.ts`, `middleware.ts` (#9)
> - `apify/client.ts`, `run-and-persist.ts`, `google-maps.ts`, `instagram.ts`, `enrich.ts` (#13–#26)
> - `ai/anthropic.ts` (#30)
> - `validators/search.ts`, `validators/lead.ts` (#10, #15)

## Dependências

- `clsx` + `tailwind-merge` (utils)
- `@supabase/supabase-js`, `@supabase/ssr`
- `apify-client`
- `@anthropic-ai/sdk`
- `zod`
