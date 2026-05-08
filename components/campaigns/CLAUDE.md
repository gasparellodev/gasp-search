# `components/campaigns/` — Spec Técnica

## Propósito

Componentes da feature de campanhas (Phase 5). Tudo Client Component (forms, Realtime).

## Como adicionar

- `'use client'` no topo.
- Validação de form delegada a `lib/validators/campaigns` (não duplicar zod).
- Reusar `lib/evolution/templates` (`renderTemplate`, `validateTemplate`) pro preview.
- Realtime via `@/lib/supabase/client` no canal `campaigns:<id>`.
- Toast `sonner` em mutações.

## Arquivos

| Path | Propósito |
|---|---|
| `campaign-form.tsx` | Form de criação (modo template ou IA por lead), com preview de render usando o primeiro lead selecionado. POST /api/campaigns. |
| `campaign-progress.tsx` | Card com barra de progresso (`sent_count + failed_count` / `total_count`), badge de status, botão Cancelar (PATCH `{action:'cancel'}`). Subscribe Realtime em `campaigns` filtrado por id. |
| `target-status-table.tsx` | Tabela de targets com ícones de status (pending/sent/failed/skipped) e error_message. |

## Dependências

- `@/components/ui/*` (shadcn)
- `@/lib/validators/{ai,campaigns}`
- `@/lib/evolution/templates`
- `@/lib/supabase/client`
- `lucide-react`, `sonner`
