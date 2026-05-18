-- ============================================================
-- Iara — Fase 1 Backbone (sandbox)
-- ============================================================
-- Tabelas que sustentam o agente Iara (assistente WhatsApp de
-- pré-vendas para lojistas de seminovos). Esta migration cobre
-- apenas o backbone da Fase 1: persistência de conversas,
-- mensagens, handoffs, follow-ups agendados e sinais de demanda
-- não atendida. UI de revisão + integração Evolution real ficam
-- para Fase 2.
--
-- Convenção: multi-tenant por `user_id` (= owner do lead/founder)
-- com RLS isolando dados. Tabelas conectadas à conversa cascateiam
-- do `whatsapp_conversations.id` (DELETE CASCADE) — quando o
-- founder limpar a conversa, todos os artefatos somem juntos.
-- ============================================================

-- ------------------------------------------------------------
-- Conversations
-- ------------------------------------------------------------
create table public.whatsapp_conversations (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  iara_version text not null,
  is_sandbox boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz
);

create index whatsapp_conversations_user_idx
  on public.whatsapp_conversations (user_id, last_message_at desc nulls last);

create index whatsapp_conversations_lead_idx
  on public.whatsapp_conversations (lead_id);

-- Reusa trigger genérico de updated_at definido em 0001_init.sql.
create trigger whatsapp_conversations_set_updated_at
before update on public.whatsapp_conversations
for each row
execute function public.tg_set_updated_at();

alter table public.whatsapp_conversations enable row level security;

create policy "own whatsapp_conversations"
  on public.whatsapp_conversations
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ------------------------------------------------------------
-- Iara messages — histórico turno-a-turno (LLM source-of-truth)
-- ------------------------------------------------------------
-- Distinto de `lead_messages`: aquela tabela é histórico real de
-- WhatsApp via Evolution (sent/delivered/read). `iara_messages`
-- é o histórico do AGENTE (LLM turns incluindo tool_use/tool_result).
-- Em Fase 2, o webhook do Evolution copia inbound/outbound aqui
-- também para alimentar o contexto da Iara.
create table public.iara_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.whatsapp_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  tool_calls jsonb,
  created_at timestamptz not null default now()
);

create index iara_messages_conversation_idx
  on public.iara_messages (conversation_id, created_at);

alter table public.iara_messages enable row level security;

-- Acesso transitivo via conversation: o usuário só vê mensagens
-- de conversas que ele owna.
create policy "own iara_messages"
  on public.iara_messages
  for all
  using (
    exists (
      select 1
      from public.whatsapp_conversations c
      where c.id = iara_messages.conversation_id
        and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.whatsapp_conversations c
      where c.id = iara_messages.conversation_id
        and c.user_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- Iara handoffs — fila de escalação pro founder
-- ------------------------------------------------------------
create table public.iara_handoffs (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.whatsapp_conversations(id) on delete cascade,
  priority text not null check (priority in ('P0', 'P1', 'P2', 'P3')),
  motivo text not null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

-- Index pra dashboard de revisão: P0 não-resolvidos primeiro,
-- depois P1, etc. `resolved_at NULLS FIRST` garante pendentes
-- no topo independente do P.
create index iara_handoffs_queue_idx
  on public.iara_handoffs (priority, resolved_at nulls first, created_at desc);

alter table public.iara_handoffs enable row level security;

create policy "own iara_handoffs"
  on public.iara_handoffs
  for all
  using (
    exists (
      select 1
      from public.whatsapp_conversations c
      where c.id = iara_handoffs.conversation_id
        and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.whatsapp_conversations c
      where c.id = iara_handoffs.conversation_id
        and c.user_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- Iara scheduled followups — agenda de mensagens automáticas
-- ------------------------------------------------------------
create table public.iara_scheduled_followups (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.whatsapp_conversations(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  mensagem text not null,
  scheduled_for timestamptz not null,
  sent_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now()
);

create index iara_scheduled_followups_due_idx
  on public.iara_scheduled_followups (scheduled_for)
  where sent_at is null and cancelled_at is null;

alter table public.iara_scheduled_followups enable row level security;

create policy "own iara_scheduled_followups"
  on public.iara_scheduled_followups
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ------------------------------------------------------------
-- Iara demand signals — features pedidas fora do escopo
-- ------------------------------------------------------------
-- A Iara chama `marcar_demanda_nao_atendida` quando o cliente
-- pede algo fora do produto (logo, app, CRM). Vira insumo de
-- roadmap — não interrompe a conversa.
create table public.iara_demand_signals (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.whatsapp_conversations(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  feature_solicitada text not null,
  created_at timestamptz not null default now()
);

create index iara_demand_signals_feature_idx
  on public.iara_demand_signals (feature_solicitada, created_at desc);

alter table public.iara_demand_signals enable row level security;

create policy "own iara_demand_signals"
  on public.iara_demand_signals
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
