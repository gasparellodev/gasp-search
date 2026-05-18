# `app/(app)/admin/iara/` — Spec Técnica

## Propósito

Área admin do agente **Iara** (assistente WhatsApp de pré-vendas). Hoje
serve dois fluxos da Fase 1:

1. **Sandbox** (`/admin/iara/sandbox`) — founder conversa com a Iara
   simulando ser o lojista. Cada turno chama `/api/iara/sandbox/conversation`
   (POST) e a UI rerenderiza com mensagens + tool_calls + handoffs.
2. **Review** (`/admin/iara/review`) — dashboard que lista todas as
   conversas simuladas do founder, com filtros (approval, handoff,
   busca) e ações rápidas inline (aprovar/reprovar).

Gate de avanço Fase 1: 30 conversas aprovadas neste dashboard.

## Como adicionar

- **Server Components** carregam o estado inicial via service-role
  (`createServiceSupabase`) + filtro explícito por `user_id`. Client
  Components fazem fetch incremental contra `/api/iara/sandbox/*`.
- Toda interação de escrita passa pelas APIs `/api/iara/sandbox/*`. NÃO
  escreva diretamente nas tabelas pela UI.
- Quando adicionar nova subpágina, registre o link no Topbar/Sidebar
  manualmente (não há nav dinâmica por enquanto). Veja `components/iara/`
  para componentes reusáveis.

## Regras de negócio

1. **Ownership.** As APIs já filtram por `user_id = auth.uid()`. UI nunca
   recebe conversa de outro user. Renderização SSR usa service-role com
   filtro explícito.
2. **Sandbox != produção.** `is_sandbox` default é `true` em
   `whatsapp_conversations` — Fase 2 vira `false` para conversas reais
   do Evolution. UI mostra badge `Iara v1.X` mas não diferencia visual
   ainda (Fase 2: filtro toggle sandbox/real).
3. **Optimistic UI no chat.** A mensagem do lojista aparece
   imediatamente; durante a chamada Anthropic o footer mostra "Iara
   está pensando..." e o botão de envio fica desabilitado.
4. **Reset é destrutivo.** `DELETE /api/iara/sandbox/conversation/[id]`
   dispara CASCADE em mensagens, handoffs, follow-ups, demand signals.
   UI confirma via `window.confirm` (não nativo shadcn dialog porque é
   ação raríssima).
5. **Approval flow.** PATCH `/api/iara/sandbox/conversation/[id]/review`
   aceita `approved`/`rejected`/`pending`. UI dispara via dialog com
   notas opcionais. Voltar para `pending` zera `reviewed_at`/`reviewed_by`.
6. **Acessibilidade.** Botões icon-only têm `aria-label`. Cor não é o
   único indicador de prioridade — handoff P0/P1/P2/P3 também tem
   ícones (🔴🟡🔵⚪).

## Arquivos

| Path | Propósito |
|---|---|
| `sandbox/page.tsx` | Server Component — carrega leads do user, conversas existentes (lite, só `lead_id`) e detalhe da conversa selecionada via `?leadId=...`. Renderiza `<IaraConversationsList>` à esquerda + `<IaraSandboxClient>` no centro/direita. |
| `review/page.tsx` | Server Component — lista conversas com filtros base aplicados no SSR (approval e handoff). Renderiza `<IaraReviewClient>`. |

## Dependências

- `@/lib/supabase/server` (auth + RLS reads)
- `@/lib/supabase/service` (service-role para joins/aggregates)
- `@/components/iara/*` — componentes shared
- `/api/iara/sandbox/*` — backbone

## Próximos passos

- Filtros adicionais no review: período (D-7/D-14), busca por
  `lead_id` específico, export CSV.
- Phase 2: filtro toggle "Sandbox vs Real" (quando o Evolution webhook
  começar a criar conversas com `is_sandbox=false`).
- Phase 2: visualização por conversa de tempo médio de resposta da
  Iara (latência Anthropic) — útil pra detectar drift.
- Phase 2: kill switch `disableIara()` exposto como toggle no header
  do review.
