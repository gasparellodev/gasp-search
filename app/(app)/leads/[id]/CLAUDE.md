# `app/(app)/leads/[id]/` — Spec Técnica

## Propósito

Página protegida de detalhe de um lead específico. Carrega o lead via
Supabase com RLS e renderiza o componente canônico `<LeadTabs />` em
modo `standalone` (issue #136 — mesma UI usada pelo
`<LeadDetailDrawer />`).

## Como adicionar

- Server Component por default; componentes interativos vão em `components/*`.
- Use `createServerSupabase()` e helpers de `lib/leads` para leitura.
- Retorne `notFound()` quando RLS bloquear ou o lead não existir.
- Mantenha `export const dynamic = "force-dynamic"` para dados por usuário.
- Para a edição inline, **delegue para `<LeadTabs mode="standalone">`**.
  Não duplique a lógica de PATCH aqui.

## Regras de negócio

1. **`<LeadTabs />` é a UI canônica** — esta página passa
   `mode="standalone"` (com hero header), `tags` (para o combobox de
   seleção), `siteCard={<LeadSiteCard />}` (Server Component) e
   `messageHistory={<MessageHistory ... />}` para preservar o histórico
   paginado por URL (`?messagesPage=N`).
2. **`?messagesPage` deeplink** abre direto a tab "Mensagens IA"
   (defaultTab) — comportamento mantido do design pré-#136 (`Tabs.defaultValue`
   `history` quando havia `messagesPage`).
3. **`maxDuration = 90`** — herdado de #217 (regeneração de identidade
   visual). Não remover ao refatorar.

## Arquivos

| Path | Propósito |
|---|---|
| `page.tsx` | Server Component: fetch do lead + tags + mensagens (paginadas) e render do `<LeadTabs mode="standalone">` com slots `siteCard` e `messageHistory`. |

## Dependências

- `@/lib/supabase/server`
- `@/lib/leads/crud` (`getLead`)
- `@/lib/leads/list-tags`
- `@/lib/ai/messages` (`listLeadMessages`)
- `@/components/leads/lead-tabs` (componente canônico)
- `@/components/leads/lead-site-card` (Server Component, slot)
- `@/components/ai/message-history` (slot)

## Quando atualizar este `CLAUDE.md`

- Novo slot ou prop adicionado ao `<LeadTabs />` consumido aqui.
- Mudanças no contrato `?messagesPage` deeplink.
- Mudança em `maxDuration`.
