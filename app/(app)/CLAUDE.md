# `app/(app)/` — Spec Técnica

## Propósito

Route group das páginas autenticadas. Layout aqui faz auth check e monta o shell (Sidebar + Topbar). Todas as rotas dentro são protegidas pelo `proxy.ts` (matcher exclui `api`, `_next`, assets).

## Estrutura

```
(app)/
├── layout.tsx           # Server Component: auth check + shell
├── dashboard/page.tsx   # Cards de métricas + últimas buscas
├── search/page.tsx      # Form de busca (placeholder até #16)
├── leads/page.tsx       # Tabela de leads (placeholder até #18)
├── pipeline/page.tsx    # Kanban (placeholder até #29)
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

## Arquivos

| Path | Tipo | Propósito |
|---|---|---|
| `layout.tsx` | Server | Auth check, lê profile, renderiza Sidebar + Topbar |
| `dashboard/page.tsx` | Server | Cards (placeholder até #35) |
| `search/page.tsx` | Server | Placeholder até #16 |
| `leads/page.tsx` | Server | Placeholder até #18 |
| `pipeline/page.tsx` | Server | Placeholder até #29 |
| `settings/page.tsx` | Server | Placeholder |

## Dependências

- `@/lib/supabase/server`
- `@/components/layout/{sidebar,topbar}`
- `next/navigation` (`redirect`)

## Quando atualizar este `CLAUDE.md`

- Nova rota adicionada ao route group.
- Layout muda (e.g., adicionar Tabs sub-navegação por área).
- Nova convenção de fetch/cache.
