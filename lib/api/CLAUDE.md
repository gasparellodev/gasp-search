# `lib/api/` — Spec Técnica

## Propósito

Helpers compartilhados por route handlers REST em `app/api/*`.

## Regras de negócio

1. API routes devem expor mensagens amigáveis em PT-BR, sem stack trace ou
   detalhes internos de Supabase, Apify ou Anthropic.
2. Falhas inesperadas devem gerar log estruturado com `requestId`, `route`,
   `userId` quando disponível e a mensagem técnica para correlação.
3. Não importar este módulo em Client Components.

## Arquivos

| Path | Propósito |
|---|---|
| `errors.ts` | `apiErrorResponse()` para log estruturado + resposta `{ error }` amigável |

## Dependências

- `next/server`
