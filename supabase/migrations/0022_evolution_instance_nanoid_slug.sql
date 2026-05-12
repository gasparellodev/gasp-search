-- ============================================================
-- 0022_evolution_instance_nanoid_slug.sql
--
-- Phase 6 / #130 — Hardening de autenticação do webhook WhatsApp
--
-- O `evo_instance` legado era derivado como `user_${userId.slice(0, 8)}`
-- (8 hex chars = 32 bits). Atacante remoto pode enumerar todo o
-- keyspace em poucos minutos e descobrir instâncias reais, o que
-- combinado com o fallback de auth via lookup de instância
-- (`/api/whatsapp/webhook`) permite injetar payloads forjados em
-- rotas que escrevem via service_role.
--
-- Estratégia (forward-only):
--   1. Adiciona coluna `evo_instance_v2 text` nullable.
--   2. Backfill com 16 chars hex (`encode(gen_random_bytes(8), 'hex')`)
--      por row. Cada row recebe um valor independente, idempotente em
--      re-runs porque o UPDATE só toca rows com v2 NULL.
--   3. Aplica NOT NULL + UNIQUE em `evo_instance_v2`. O UNIQUE é a
--      garantia anti-enumeração: lookup só é satisfeito pelo slug exato.
--   4. Marca `evo_instance` (legado) como DEPRECATED. Mantemos a coluna
--      enquanto rows antigas têm instâncias ativas no Evolution; o
--      handler em `lib/evolution/webhook.ts` faz lookup por v2 primeiro
--      e cai no legado pra continuidade do par WhatsApp já existente.
--      Próxima migration (após restart cycle do Evolution) deve dropar.
-- ============================================================

alter table public.whatsapp_instances
  add column if not exists evo_instance_v2 text;

-- Backfill idempotente: gera 16 chars hex (8 bytes = 64 bits) por row
-- só quando ainda não há valor.
update public.whatsapp_instances
   set evo_instance_v2 = encode(gen_random_bytes(8), 'hex')
 where evo_instance_v2 is null;

alter table public.whatsapp_instances
  alter column evo_instance_v2 set not null;

create unique index if not exists whatsapp_instances_evo_instance_v2_uniq
  on public.whatsapp_instances (evo_instance_v2);

comment on column public.whatsapp_instances.evo_instance is
  'DEPRECATED: drop after Evolution restart cycle, replaced by evo_instance_v2 (#130)';
comment on column public.whatsapp_instances.evo_instance_v2 is
  'Slug aleatório de 16 chars usado como identificador da instância Evolution. UNIQUE — defende contra enumeração (#130).';
