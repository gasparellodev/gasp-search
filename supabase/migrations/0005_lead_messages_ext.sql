-- ============================================================
-- Phase 5 — Extensão de lead_messages para conversas reais
-- ============================================================
-- Antes da Phase 5, lead_messages só guardava mensagens IA
-- geradas (sem trafegar). Agora a tabela vira fonte da verdade
-- de envio (outbound) e recebimento (inbound) via Evolution API.
--
-- Mensagens existentes (antes desta migration) ficam com
-- direction='outbound', status='sent', ai_generated=false.
-- São histórico — não foram realmente enviadas pra ninguém.

create type public.lead_message_direction as enum (
  'outbound',
  'inbound'
);

create type public.lead_message_status as enum (
  'queued',
  'sent',
  'delivered',
  'read',
  'failed'
);

alter table public.lead_messages
  add column direction public.lead_message_direction not null default 'outbound',
  add column status public.lead_message_status not null default 'sent',
  add column whatsapp_msg_id text unique,
  add column campaign_id uuid references public.campaigns(id) on delete set null,
  add column error_message text,
  add column ai_generated boolean not null default false;

-- Permite query rápida de outbound pendente/falho por user.
create index lead_messages_user_status_idx
  on public.lead_messages (user_id, status)
  where direction = 'outbound';

-- Fecha o ciclo da migration 0004: liga campaign_targets.sent_message_id
-- a lead_messages.id. Não pôde sair em 0004 porque lead_messages.id existia
-- mas a coluna sent_message_id ainda não tinha o constraint.
alter table public.campaign_targets
  add constraint campaign_targets_sent_message_id_fkey
  foreign key (sent_message_id)
  references public.lead_messages(id)
  on delete set null;
