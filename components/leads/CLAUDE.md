# `components/leads/` — Spec Técnica

## Propósito

Components de UI para a área de leads (`/leads`). A tabela principal,
seu drawer de detalhe e helpers locais.

## Como adicionar

- **Component novo**: arquivo PascalCase em kebab no nome (`lead-detail-drawer.tsx`).
  `'use client'` na primeira linha quando precisar de estado/handlers.
- **Tipos compartilhados**: importar `LeadListItem` de `@/lib/leads/list-leads`.
- **Cobrir** com unit em `tests/unit/components/leads/<arquivo>.test.tsx`.
  Página `/leads` em si fica na cobertura E2E (Playwright), não em unit.

## Regras de negócio

1. **Paginação e ordenação são server-side** via search params (`page`, `pageSize`,
   `sortBy`, `sortDir`). A tabela não mantém estado próprio de paginação — só
   atualiza a URL via `router.push`. O Server Component re-fetch.
2. **Page sizes válidos: 25, 50, 100** (mantidos em `LEAD_PAGE_SIZE_OPTIONS`).
3. **Colunas sortable**: `name`, `category`, `city`, `stage`, `score`, `created_at`.
   Outras colunas (Contato, Tags, Ações) não acionam sort.
4. **Linha clicável** abre `LeadDetailDrawer` em estado local. O botão "Abrir"
   na coluna Ações faz a mesma ação com `aria-label` por nome do lead.
5. **`LeadDetailDrawer` é stateful** (issue #20): tabs **Visão geral / Notas /
   Mensagens IA** com edição inline de stage, score, notes e tags via PATCH
   `/api/leads/[id]`. Estado interno é optimistic — em falha, revert + toast.error.
   `router.refresh()` é chamado em sucesso para o Server Component re-buscar.
   A tab **Mensagens IA** renderiza a experiência real de geração via
   `MessageGenerator`; não manter placeholders de issue já entregue.
6. **Bulk select + Enriquecer** (issue #28): cada linha tem checkbox; toolbar
   acima da tabela aparece com contagem quando há seleção. Botão dispara
   POST `/api/apify/enrich` com até `ENRICH_MAX_LEADS` (25). Toasts de loading,
   success e error usam o id `bulk-enrich` para deduplicar. `router.refresh()`
   após sucesso para reler dados do server.
7. **Estado vazio desenhado**: nada de tela em branco quando `leads.length === 0`.
8. **Responsividade**: filtros usam grid responsivo e inputs `w-full` em
   mobile. A tabela deve conter overflow horizontal no próprio bloco
   (`Table`/container), nunca no `body`. Drawer, tabs e popovers usam
   `max-w` baseado em viewport.
9. **Viewport da lista**: `/leads` mantém header, filtros e paginação visíveis
   dentro da tela. A rolagem vertical e horizontal da tabela acontece no
   container interno `leads-table-scroll`, não na página inteira.

## Arquivos

| Path | Tipo | Propósito |
|---|---|---|
| `filters-bar.tsx` | Client | Barra de filtros (q, stage, source, hasWebsite, tags multi) sincronizada com URL |
| `leads-table.tsx` | Client | Tabela TanStack com sort/pageSize/paginação via URL + drawer |
| `lead-detail-drawer.tsx` | Client | Sheet lateral com tabs (Visão geral / Notas / Mensagens IA / Conversa*) e edição inline (stage/score/notes/tags) via PATCH. *Tab Conversa só visível com `NEXT_PUBLIC_WHATSAPP_ENABLED='1'`. |

## Dependências

- `@tanstack/react-table` para a estrutura de colunas/rows
- `@/components/ai/message-generator`
- `@/components/ui/{table,sheet,button,badge,separator}` (shadcn)
- `next/navigation` (`useRouter`, `usePathname`, `useSearchParams`)
- `@/lib/validators/leads` (constantes e tipos)
- `@/lib/leads/list-leads` (tipos `LeadListItem`)

## Quando atualizar este `CLAUDE.md`

- Nova coluna virada sortable → atualizar a lista de colunas + `LEAD_SORTABLE_COLUMNS`.
- Drawer evoluir para versão final em #20.
- Bulk actions / filtros desembarcarem (issues #19, #28).
