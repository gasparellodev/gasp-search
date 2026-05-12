# `components/messages/` — Spec Técnica

## Propósito

Componentes da inbox `/messages` (Phase 5). Layout 2 colunas (lista + thread + composer), tudo Client Components com Realtime.

## Como adicionar

- `'use client'` no topo.
- Subscribe Realtime no canal `lead_messages` (filtrado por user via RLS, ou por `lead_id` para a thread).
- Presença (#123) usa canal broadcast `whatsapp-presence:<leadId>` + fallback inicial em `GET /api/whatsapp/presence/[leadId]`; não persistir em estado global.
- Toda mutation dispara `toast` via `sonner`.

## Arquivos

| Path | Propósito |
|---|---|
| `conversation-list.tsx` | Lista lateral de conversas com busca, status visual da última msg, link pra `/messages/[leadId]` |
| `conversation-thread.tsx` | Painel de chat com bubbles iMessage-style (Apple SK): outbound azul `--primary`, inbound alabaster `--card`, radius 18px via `--sk-card-radius`. Status (✓/✓✓/✓✓ azul/⚠️) e auto-scroll. #123: carrega presença inicial por API e escuta broadcast `presence` para mostrar `digitando...`, `Online agora` ou `Visto há Xmin`. |
| `message-composer.tsx` | Textarea + botão Enviar dentro de Card alabaster (`--sk-card-radius` 18px). Textarea sem borda própria — Card é a moldura visual. Atalho Ctrl+Enter; disabled se WhatsApp desconectado. #123: quando conectado e `leadId` é UUID, emite `typing` ao digitar e `paused` após 2s sem input via `/api/whatsapp/typing` (best-effort, sem toast). |
| `instance-banner.tsx` | Banner de aviso quando instância não está connected, com link pra /settings |

## Dependências

- `@/components/ui/*` (shadcn)
- `@/lib/supabase/client` (Realtime)
- `@/lib/ai/messages` (LeadMessage type)
- `@/lib/messages/list-conversations` (ConversationItem type)
- `lucide-react`, `sonner`

## Reutilização

- `conversation-thread.tsx` e `message-composer.tsx` são reusados na tab "Conversa" do `LeadDetailDrawer` (#100).
