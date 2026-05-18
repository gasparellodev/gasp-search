# `components/iara/` — Spec Técnica

## Propósito

Componentes da área admin do agente **Iara** (Fase 1 UI):
- Sandbox de chat com a Iara em modo simulado.
- Dashboard de revisão (auditoria + aprovação/reprovação).

Compartilham tipos via `components/iara/types.ts` (sem `server-only`,
podem ser importados de Client Components).

## Como adicionar

- TypeScript strict + `noUncheckedIndexedAccess` (sem `any`).
- Client Components têm `"use client"` na primeira linha. Componentes
  "view" sem estado podem ficar server-renderable, mas hoje toda peça
  precisa de estado/handlers ⇒ todos são client.
- Props sempre tipadas explicitamente (interface dedicada).
- Sempre exportar **default** + **named** (consistente com padrão do
  projeto — `components/leads/`, `components/sites/`).
- Estilização via Tailwind v4 + `cn()` de `@/lib/utils`. Usar variants
  pré-existentes (`Badge`, `Button`) em vez de classes ad-hoc.
- Cor não é o único indicador. Handoff P0/P1/P2/P3 mostra ícone
  (🔴🟡🔵⚪) além da cor.

## Regras de negócio

1. **Tipos canônicos em `types.ts`.** Não duplicar enums de
   approval/handoff em cada componente — importar de `@/components/iara/types`.
2. **Persistência da config Iara** (`founderName`/`founderDescricao`)
   fica em `localStorage` sob `iara:founder-config:v1`. Versão no key
   facilita migração.
3. **Optimistic UI** no chat: a mensagem do lojista aparece antes da
   resposta da Iara. Se a request falhar, mostramos toast de erro e a
   mensagem otimista permanece no histórico (vai sair depois do
   `refreshDetail`).
4. **Filtros da review** são URL-driven (`?approvalStatus=...&handoffPriority=...`).
   Re-fetch contra `/api/iara/sandbox/conversations` ao mudar.
5. **Acessibilidade.** Botões icon-only têm `aria-label`. Textareas
   têm `<Label>` linkado via `htmlFor`. Modais usam shadcn `Dialog`
   (focus trap built-in).

## Arquivos

| Path | Propósito |
|---|---|
| `types.ts` | Tipos compartilhados client-safe: `IaraApprovalStatus`, `IaraHandoffPriority`, `IaraChatMessage`, `IaraConversationDetail`, `IaraConversationListItem`. Constantes `HANDOFF_LABEL`, `HANDOFF_ICON`, `APPROVAL_LABEL`. |
| `iara-chat-bubble.tsx` | Renderiza 1 mensagem (user OU assistant) com chips colapsáveis para tool_calls e banner inline de handoff. |
| `iara-conversations-list.tsx` | Lista esquerda da sandbox — autocomplete por business_name/cidade, indicador "•" para leads que já têm conversa. |
| `iara-conversation-meta.tsx` | Painel direito da sandbox — dados do lead, stats, handoffs históricos, config Iara (localStorage), botões Aprovar/Reprovar/Resetar. |
| `iara-approval-dialog.tsx` | Modal `<Dialog>` para confirmar aprovação/reprovação com notas opcionais. |
| `iara-review-table.tsx` | Tabela `@tanstack/react-table` v8 — colunas: Lead, Iara v, Msg count, Handoff, Status, Atualização, Ações. Botões inline disparam PATCH /review. |
| `iara-metrics-cards.tsx` | 4 cards no topo do review — Total, %P0, %Aprovadas, %Reprovadas. |
| `iara-sandbox-client.tsx` | Client wrapper principal do sandbox — gerencia estado do chat, envia POST /conversation, refresh GET /conversation/[id], reset DELETE, abre IaraApprovalDialog. |
| `iara-review-client.tsx` | Client wrapper do review — filtros (Select + Input) sincronizados com URL, fetcher contra GET /conversations, render `<IaraReviewTable>` + `<IaraMetricsCards>`. |

## Dependências

- `@/components/ui/*` (shadcn primitives — Badge, Button, Card, Dialog, Input, Label, Select, Table, Textarea)
- `@/lib/utils.cn`
- `@tanstack/react-table` v8
- `sonner` (toasts)
- `lucide-react` (ícones)

## Convenções

- **`data-testid` nos elementos críticos** para os testes RTL:
  `iara-bubble-user`, `iara-bubble-assistant`, `iara-review-row-<id>`,
  `lead-list-item-<id>`.
- Sem dependência de `server-only` em nenhum arquivo — tudo pode ser
  importado de Client Components.
- Quando o backend trocar de service-role para fetch autenticado
  (Fase 2 multi-user), nada nesta pasta precisa mudar — a fetcher já
  passa por API routes.
