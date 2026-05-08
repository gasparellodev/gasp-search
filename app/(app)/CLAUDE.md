# `app/(app)/` — Spec Técnica

## Propósito

Route group das páginas autenticadas. Layout aqui faz auth check e monta o shell (Sidebar + Topbar). Todas as rotas dentro são protegidas pelo `proxy.ts` (matcher exclui `api`, `_next`, assets).

## Estrutura

```
(app)/
├── layout.tsx           # Server Component: auth check + shell
├── dashboard/page.tsx   # Cards de métricas + últimas buscas
├── dashboard/loading.tsx # Skeleton da rota dashboard
├── search/page.tsx      # Form de busca Google Maps
├── leads/page.tsx       # Tabela de leads (placeholder até #18)
├── leads/loading.tsx    # Skeleton da rota leads
├── leads/[id]/page.tsx  # Detalhe do lead + ferramentas CRM
├── pipeline/page.tsx    # Kanban (placeholder até #29)
├── pipeline/loading.tsx # Skeleton da rota pipeline
└── settings/page.tsx    # Preferências da conta (placeholder)
```

## Como adicionar

- **Nova rota protegida**: pasta `(app)/<rota>/page.tsx`. Sem precisa de auth check próprio — o layout já fez.
- **Layout aninhado**: `(app)/<area>/layout.tsx` se um conjunto de rotas precisar do mesmo sub-layout.
- **API route protegida**: criar em `app/api/<recurso>/route.ts`. O `proxy.ts` NÃO cobre `/api/*`; cada handler valida sessão lendo cookies via `createServerSupabase`.

## Regras de negócio

1. **Auth check no layout** é defesa em profundidade — `proxy.ts` redireciona antes, mas o layout precisa do `user` para passar dados ao Topbar e Server Components descendentes.
2. **`profile` é fonte de display** (full_name, avatar_url) — não dependa de `user.user_metadata` no UI (pode estar dessincronizado).
3. **Nenhuma rota aqui pode ser SSG**. Todas dependem da sessão → dynamic rendering.
4. **Server Components fazem fetch** com `cache: 'no-store'` para dados específicos do user (RLS aplicada via Supabase client com cookies).
5. **Estados vazios desenhados** em todas as páginas: nada de tela em branco.
6. **Responsividade do shell**: wrappers de página usam `min-w-0`; scroll
   horizontal deve ficar contido no componente que precisa dele, não no `body`.

## Arquivos

| Path | Tipo | Propósito |
|---|---|---|
| `layout.tsx` | Server | Auth check, lê profile, renderiza Sidebar + Topbar |
| `dashboard/page.tsx` | Server | Página do dashboard; renderiza `DashboardView` |
| `dashboard/loading.tsx` | Server | Skeleton de rota do dashboard |
| `search/page.tsx` | Server | Página de busca com `SearchForm` |
| `leads/page.tsx` | Server | Placeholder até #18 |
| `leads/loading.tsx` | Server | Skeleton de rota da tabela de leads |
| `leads/[id]/page.tsx` | Server | Detalhe do lead com `MessageGenerator` |
| `pipeline/page.tsx` | Server | Placeholder até #29 |
| `pipeline/loading.tsx` | Server | Skeleton de rota do Kanban |
| `settings/page.tsx` | Server | Placeholder + `<InstanceCard />` (WhatsApp) condicional |
| `messages/page.tsx` | Server | Inbox WhatsApp Web style — `<ConversationList />` + placeholder de seleção. Redireciona se feature flag desligada. |
| `messages/[leadId]/page.tsx` | Server | Thread específica — list + thread + composer + banner. |

## Dependências

- `@/lib/supabase/server`
- `@/components/layout/{sidebar,topbar}`
- `@/components/dashboard/dashboard-view`
- `next/navigation` (`redirect`)

## Quando atualizar este `CLAUDE.md`

- Nova rota adicionada ao route group.
- Layout muda (e.g., adicionar Tabs sub-navegação por área).
- Nova convenção de fetch/cache.
