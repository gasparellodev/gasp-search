# `lib/validators/` — Spec Técnica

## Propósito

Schemas Zod que definem o contrato de entrada de forms, server actions e API handlers.

## Como adicionar

- Crie `lib/validators/<area>.ts` com schemas nomeados e tipos `z.infer`.
- Valide antes de qualquer side effect externo (Supabase, Apify, Anthropic).
- Mantenha mensagens em PT-BR quando retornarem para UI/API.
- Cubra em `tests/unit/lib/validators/<area>.test.ts`.

## Invariantes de segurança

1. **SSRF guard em URLs externas** (issue #138). Schemas que aceitam URL
   externa controlada pelo usuário (`leads.website` no `create`/`update`)
   precisam aplicar `isPublicHttpUrl(...)` antes do INSERT/UPDATE. O guard:
   - Aceita apenas `http://` e `https://`.
   - Bloqueia hosts privados/reservados via `isPrivateOrReservedHost(...)`:
     `localhost`, loopback IPv4/IPv6, RFC1918 (`10/8`, `172.16/12`,
     `192.168/16`), link-local IPv4 (`169.254/16`, AWS metadata),
     CGNAT (`100.64/10`), multicast/reservados (`224+/4`), `fc00::/7` ULA,
     `fe80::/10` link-local IPv6 e `0.0.0.0`.
   - Defense-in-depth: parse-time. **Não cobre DNS rebinding** — caso o
     consumo evolua para `fetch` server-side com a URL, exigir resolução
     DNS + revalidação por request.
   - Helpers exportados de `lib/validators/leads.ts`:
     `isPrivateOrReservedHost`, além do schema interno `websiteSchema`.
   - Mensagem PT-BR padrão: `"URL inválida ou aponta para host privado"`.

## Arquivos

| Path | Propósito |
|---|---|
| `auth.ts` | Schemas de login e cadastro |
| `search.ts` | Schemas das buscas Apify |
| `ai.ts` | Schemas e opções para geração de mensagens IA |
| `leads.ts` | Schemas de listagem/filtros, `createLeadSchema`, `updateLeadSchema`, helper `isPrivateOrReservedHost` e SSRF guard em `website`. |

## Dependências

- `zod`
