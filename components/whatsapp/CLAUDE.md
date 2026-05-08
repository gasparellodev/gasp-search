# `components/whatsapp/` — Spec Técnica

## Propósito

Componentes da UI relacionados à integração WhatsApp/Evolution (Phase 5). Todos são Client Components (precisam de polling, Realtime, fetch).

## Como adicionar

- Marcar `'use client'` no topo.
- Toda mutation dispara `toast` via `sonner` (sucesso e erro).
- Para reagir a mudanças server-side, usar Supabase Realtime no canal `whatsapp_instances` ou `lead_messages` filtrado por `user_id`.
- Esconder o componente atrás da feature flag `publicEnv.NEXT_PUBLIC_WHATSAPP_ENABLED === '1'` quando renderizado em rotas estáveis.
- Tests em `tests/unit/components/whatsapp/...` com mocks de `fetch`, `sonner`, `@/lib/supabase/client`.

## Arquivos

| Path | Propósito |
|---|---|
| `instance-card.tsx` | Card em `/settings` com 4 estados (disconnected/qr_pending/connecting/connected/error), QR Code dinâmico via polling em `/api/whatsapp/instance/qr`, botão Conectar/Desconectar. Subscribe Realtime para reagir ao webhook que promove `connected`. |

## Dependências

- `@/components/ui/*` (shadcn primitives)
- `@/lib/supabase/client`
- `lucide-react`
- `sonner`

## Testes

- Cobrir os 4 estados visuais
- Cobrir polling enquanto qr_pending (com cleanup no unmount)
- Cobrir cliques em Conectar/Desconectar com mock de fetch
