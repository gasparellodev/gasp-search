# `lib/validators/` — Spec Técnica

## Propósito

Schemas Zod que definem o contrato de entrada de forms, server actions e API handlers.

## Como adicionar

- Crie `lib/validators/<area>.ts` com schemas nomeados e tipos `z.infer`.
- Valide antes de qualquer side effect externo (Supabase, Apify, Anthropic).
- Mantenha mensagens em PT-BR quando retornarem para UI/API.
- Cubra em `tests/unit/lib/validators/<area>.test.ts`.

## Arquivos

| Path | Propósito |
|---|---|
| `auth.ts` | Schemas de login e cadastro |
| `search.ts` | Schemas das buscas Apify |
| `ai.ts` | Schemas e opções para geração de mensagens IA |

## Dependências

- `zod`
