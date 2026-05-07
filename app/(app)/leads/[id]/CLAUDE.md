# `app/(app)/leads/[id]/` — Spec Técnica

## Propósito

Página protegida de detalhe de um lead específico. Carrega o lead via Supabase com RLS e compõe ferramentas de CRM para o lead.

## Como adicionar

- Server Component por default; componentes interativos vão em `components/*`.
- Use `createServerSupabase()` e helpers de `lib/leads` para leitura.
- Retorne `notFound()` quando RLS bloquear ou o lead não existir.
- Mantenha `export const dynamic = "force-dynamic"` para dados por usuário.

## Arquivos

| Path | Propósito |
|---|---|
| `page.tsx` | Detalhe do lead e `MessageGenerator` |

## Dependências

- `@/lib/supabase/server`
- `@/lib/leads/crud`
- `@/components/ai/message-generator`
