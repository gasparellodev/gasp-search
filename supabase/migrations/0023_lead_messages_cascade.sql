-- ============================================================
-- Phase 6 #133 — lead_messages.lead_id ON DELETE CASCADE
-- ============================================================
-- Reconcilia o contrato do FK em `lead_messages.lead_id`. A migration
-- inicial (0001_init.sql) já declara `on delete cascade`, mas a falta
-- de uma migration explícita deixava a constraint vulnerável a drift
-- em ambientes onde o schema foi reconstruído parcialmente ou onde o
-- FK foi alterado fora do versionamento. Esta migration é idempotente
-- e reforça o contrato em todos os ambientes.
--
-- Sem o cascade, deletar um lead deixava `lead_messages` órfãs com FK
-- inválido (ou um erro de constraint dependendo do `confdeltype`).
-- O helper `lib/messages/list-conversations.ts` mascarava essa
-- inconsistência com `.filter(x => x !== null)` na pós-projeção,
-- escondendo o histórico em silêncio. Pós-#133:
--   - DB é fonte da verdade: deletar lead remove mensagens automaticamente.
--   - Inbox (`/messages`) não precisa mais de filtro defensivo.
--   - O caminho de "lead removido mas histórico preservado" passa a ser
--     uma decisão de produto (opção 2 do issue) que viraria placeholder
--     na UI, não comportamento implícito do helper.

alter table public.lead_messages
  drop constraint if exists lead_messages_lead_id_fkey;

alter table public.lead_messages
  add constraint lead_messages_lead_id_fkey
  foreign key (lead_id)
  references public.leads(id)
  on delete cascade;

-- Rollback manual (se necessário):
--   alter table public.lead_messages
--     drop constraint if exists lead_messages_lead_id_fkey;
--   alter table public.lead_messages
--     add constraint lead_messages_lead_id_fkey
--     foreign key (lead_id) references public.leads(id);  -- sem cascade
