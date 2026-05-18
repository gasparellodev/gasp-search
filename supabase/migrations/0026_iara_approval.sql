-- ============================================================
-- Iara — Fase 1 UI: aprovação de conversas
-- ============================================================
-- Acrescenta colunas em whatsapp_conversations para que o founder
-- possa marcar uma conversa como aprovada / reprovada durante a
-- calibração da Iara em sandbox (gate da Fase 1: 30 conversas
-- aprovadas).
--
-- Decisão arquitetural: ficar em whatsapp_conversations (em vez de
-- criar tabela `iara_conversation_reviews`) porque:
--   1. A aprovação é 1:1 com a conversa (mesma cardinalidade).
--   2. Filtrar / ordenar / paginar no dashboard fica trivial sem
--      precisar de join na query principal.
--   3. Em Fase 2 (Evolution real) o mesmo campo serve para marcar
--      conversas reais que viraram benchmark / training set.
-- ============================================================

alter table public.whatsapp_conversations
  add column approval_status text not null default 'pending'
    check (approval_status in ('pending', 'approved', 'rejected')),
  add column approval_notes text,
  add column reviewed_at timestamptz,
  add column reviewed_by uuid references auth.users(id) on delete set null;

-- Index para dashboard de revisão (filtro por status + ordenação por
-- atualização). Cobre o caso comum: "todas as pending desta semana".
create index whatsapp_conversations_approval_idx
  on public.whatsapp_conversations (user_id, approval_status, last_message_at desc nulls last);

comment on column public.whatsapp_conversations.approval_status is
  'Status de revisão da conversa pela founder: pending|approved|rejected. Fase 1: gate de calibração da Iara.';

comment on column public.whatsapp_conversations.approval_notes is
  'Notas livres do revisor explicando o veredito. Opcional.';

comment on column public.whatsapp_conversations.reviewed_at is
  'Timestamp em que o veredito foi registrado. Null enquanto status=pending.';

comment on column public.whatsapp_conversations.reviewed_by is
  'Usuário que registrou o veredito. Pode ser diferente do owner em multi-user (futuro).';
