# `components/pipeline/` — Spec Técnica

## Propósito

Kanban interativo da página `/pipeline`. Colunas = estágios em
`LEAD_STAGES`. Cards são leads draggáveis entre colunas via `@dnd-kit`.

## Arquivos

| Path | Tipo | Propósito |
|---|---|---|
| `board.tsx` | Client | `PipelineBoard` — DndContext + colunas droppáveis + cards draggáveis com optimistic move |

## Regras de negócio

1. **Optimistic update**: ao soltar o card, a UI move imediatamente. Em
   seguida dispara `PATCH /api/leads/[id]` com `{ stage }`. Em **falha**,
   `setOptimistic(previous)` reverte e `toast.error` mostra a mensagem.
2. **`router.refresh()` em sucesso** para re-buscar o board do Server
   Component (cobre eventos paralelos como concorrência entre abas).
3. **Viewport fixo**: a página de pipeline deve manter o board inteiro dentro
   da tela disponível. A rolagem vertical acontece dentro da lista de cards de
   cada coluna, não na página inteira.
4. **Scroll horizontal interno**: o Kanban usa um trilho horizontal dentro do
   board, com colunas de largura fixa confortável. Esse scroll é local ao board
   e não deve virar overflow horizontal global da página.
5. **Mobile**: há um seletor `Visualizar estágio` como atalho mobile, mas as
   colunas continuam acessíveis pelo trilho horizontal interno.
6. **Apple SK styling (issue #149)**: colunas usam `bg-card` (alabaster
   `#f5f5f7` light / `#1d1d1f` dark) com `rounded-[var(--sk-card-radius)]`
   (18px) e `shadow-sm` em vez de borda. Trilho horizontal usa `gap-6` entre
   colunas (24px). Cards de lead usam `rounded-xl` (12px) — radius médio,
   menor que o de coluna, para hierarquia visual.
4. **`onMoveCommand` (prop)** existe apenas para testes — permite chamar
   `moveLead` diretamente, sem simular o cycle de pointer events que o
   dnd-kit usa.
5. **Card clicável abre `<LeadDetailDrawer>`** (#137). O click no card
   dispara `GET /api/leads/[id]` (recupera o `LeadListItem` completo,
   incluindo tags via flatten), e o drawer abre com a mesma UX da tabela
   de `/leads`. `PointerSensor` com `activationConstraint: { distance: 4 }`
   garante que cliques curtos **não** disparam drag — sem briga entre
   gestos. Em falha do fetch, `toast.error` é exibido e o drawer não
   abre. A página `/pipeline/page.tsx` carrega `listTags` em paralelo
   ao `listLeadsByStage` e passa `tags={tags}` para o `<PipelineBoard>`,
   que repassa ao drawer.

## Dependências

- `@dnd-kit/core` (`DndContext`, `useDroppable`, `useDraggable`)
- `@/lib/leads/list-by-stage` (tipo `PipelineBoard` + `PipelineCard`)
- `@/lib/leads/list-leads` (tipos `LeadListItem`, `LeadTagSummary`)
- `@/lib/validators/leads` (`LEAD_STAGES`, `LeadStage`)
- `@/components/leads/lead-detail-drawer` (drawer reutilizado em #136/#137)
- `sonner` (toast.error em rollback / falha de fetch)
- `next/navigation` (`useRouter().refresh()` após sucesso)

## Quando atualizar este `CLAUDE.md`

- Novo estágio adicionado em `LEAD_STAGES` → atualizar `STAGE_LABEL`/`STAGE_ACCENT`
  e garantir que o seletor mobile continue cobrindo o estágio.
- Drag entre múltiplos boards / multi-select de cards.
- Substituir `@dnd-kit/core` por outra lib de DnD.
