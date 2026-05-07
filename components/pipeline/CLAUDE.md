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
3. **Mobile**: o container usa `overflow-x-auto` para scroll horizontal.
4. **`onMoveCommand` (prop)** existe apenas para testes — permite chamar
   `moveLead` diretamente, sem simular o cycle de pointer events que o
   dnd-kit usa.

## Dependências

- `@dnd-kit/core` (`DndContext`, `useDroppable`, `useDraggable`)
- `@/lib/leads/list-by-stage` (tipo `PipelineBoard` + `PipelineCard`)
- `@/lib/validators/leads` (`LEAD_STAGES`, `LeadStage`)
- `sonner` (toast.error em rollback)
- `next/navigation` (`useRouter().refresh()` após sucesso)

## Quando atualizar este `CLAUDE.md`

- Novo estágio adicionado em `LEAD_STAGES` → atualizar `STAGE_LABEL`/`STAGE_ACCENT`.
- Drag entre múltiplos boards / multi-select de cards.
- Substituir `@dnd-kit/core` por outra lib de DnD.
