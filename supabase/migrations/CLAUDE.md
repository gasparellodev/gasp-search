# `supabase/migrations/` — Spec Técnica

## Propósito

Migrations SQL aplicadas em ordem numérica.

## Convenções

- Nome: `NNNN_<descricao>.sql` (ex.: `0001_init.sql`, `0002_add_lead_archived.sql`).
- Cada arquivo é **forward-only**. Nunca edite uma migration já aplicada em produção. Para reverter, crie nova migration que desfaz.
- Comentários no SQL devem explicar o **porquê**, não o quê (`SELECT` se explica sozinho).

## Arquivos

| Path | Propósito |
|---|---|
| `0001_init.sql` | Schema inicial: profiles, tags, search_jobs, leads, lead_tags, lead_messages + RLS + triggers |
| `0002_fix_lead_upsert_constraints.sql` | Substitui dedup de leads por índices únicos parciais (website / instagram_handle) |
| `0003_whatsapp_instances.sql` | Phase 5 — tabela `whatsapp_instances` (1:1 user) + enum `whatsapp_status` + RLS por user_id |
| `0004_campaigns.sql` | Phase 5 — tabelas `campaigns` + `campaign_targets` + 3 enums (campaign_mode, campaign_status, campaign_target_status) + RLS |
| `0005_lead_messages_ext.sql` | Phase 5 — estende `lead_messages` (direction, status, whatsapp_msg_id, campaign_id, error_message, ai_generated) + FK `campaign_targets.sent_message_id → lead_messages.id` |
| `0010_lead_sites.sql` | Phase 7 M1.1 — tabela `lead_sites` + índices + RLS + trigger `set_updated_at` |
| `0011_generation_throttle.sql` | Phase 7 M1.7 — tabela `generation_throttle` (rate-limit DB-backed) |
| `0012_lead_sites_archived_at.sql` | Phase 7 M3.3 (#169) — coluna `archived_at timestamptz` em `lead_sites` |
| `0013_campaigns_type.sql` | Phase 7 M4.3 (#172) — coluna `type` em campaigns (`'message' \| 'site_preview'`) + index parcial |
| `0014_lead_sites_generation_error_backfill.sql` | Phase 7 hotfix — backfill de `generation_error` em rows legadas |
| `0015_lead_sites_rls_repair.sql` | Phase 7 hotfix 2026-05-09 — re-aplica RLS policies de `lead_sites` (idempotent) |
| `0016_site_variables_v2.sql` | Phase 7 #197 PR-C — migra `lead_sites.variables` shape v1 flat → v2 nested. Cria tabela backup `lead_sites_v1_backup` (rollback sem dump externo), declara função PL/pgSQL `__migrate_site_variables_v1_to_v2(jsonb) RETURNS jsonb` IMMUTABLE como single source of truth (espelha `lib/sites/migrate-variables.ts:migrateV1ToV2`), e roda UPDATE idempotent filtrado por `not (variables ? 'schema_version')`. Renomeia `contact_hero_image_url` → `contact_image_url` em `brand_assets`. Address parse best-effort; retorna `null` quando regex v1 não casa (Address é nullable em v2). Cars[] ganha `category: 'Sedan'`, `plates_visible: false`, `photos` derivado de `gallery_urls`. Rollback documentado em comentário SQL (UPDATE de backup + DROP function + DROP table). |
| `0017_lead_sites_v1_backup_rls.sql` | Phase 7 Sprint 0 follow-up #236 — hardening de `lead_sites_v1_backup` (criada em 0016 via `CREATE TABLE ... AS` que NÃO herda RLS). Aplica defense-in-depth: REVOKE ALL FROM public/anon/authenticated, ENABLE ROW LEVEL SECURITY (sem CREATE POLICY = deny-all deliberado), GRANT SELECT apenas para `service_role` (server-only rollback path), COMMENT ON TABLE documentando intenção. Idempotente (REVOKE/GRANT/ENABLE são no-op em re-run). Rollback manual em comentário SQL (DISABLE RLS + restore grants). |
| `0018_lead_sites_signed_at.sql` | Phase 7 Sprint 0 #F2 SEO foundation #199 — adiciona coluna `signed_at timestamptz` em `lead_sites` (nullable, sem default; admin marca manualmente após cliente assinar contrato). Cria index parcial `lead_sites_signed_at_idx ON (signed_at) WHERE signed_at IS NOT NULL` (otimiza queries do sitemap em #212 sem custo de indexar a maioria das rows NULL). COMMENT ON COLUMN documenta semântica (distinto de `published_at`/`sent_at`). Idempotente (`ADD COLUMN IF NOT EXISTS` + `CREATE INDEX IF NOT EXISTS`). Habilita o gate `isIndexable(site)` em `lib/sites/metadata.ts` que controla `robots.index/follow` nas 6 rotas `/sites/[slug]/*`. Rollback documentado em comentário SQL (DROP INDEX + DROP COLUMN). |
| `0019_lead_sites_visual_identity.sql` | Phase 7 Sprint 2 #A1 #215 — adiciona coluna `lead_sites.visual_identity jsonb DEFAULT NULL` (manifest da identidade visual gerada por IA — `hero_url`, `categories_urls[]`, `about_url`, `contact_url`, `generated_at`, `model`, `cost_estimate_brl`; shape validado runtime via `VisualIdentityManifestSchema` em `types/visual-identity.ts`). Cria 2 buckets Storage: `visual-identity` (PUBLIC — banners de marketing consumidos por `<Image>` em SSR dos sites; policies SELECT public + INSERT/UPDATE/DELETE gated em `auth.role() = 'service_role'`) e `tradein-photos` (PRIVADO LGPD-safe — fotos de carros pessoais com placas visíveis; ZERO policies em `storage.objects` = deny-all deliberado pra anon/authenticated, apenas service_role acessa via signed URLs server-side). Idempotente (`ADD COLUMN IF NOT EXISTS`, `ON CONFLICT DO NOTHING`, `DROP POLICY IF EXISTS`). Foundation pra Sprint 2 #A2 (#216 — generateVisualIdentity action) e #A3 (#217 — admin regenerate UI). Rollback documentado em comentário SQL (DROP policies + DELETE buckets + DROP COLUMN). |
| `0020_lead_form_submissions.sql` | Phase 7 Sprint 4 / #H3 — persiste submissions de forms públicos em `lead_form_submissions` com audit LGPD por submission, rate-limit por IP e leitura futura restrita ao dono via RLS. |
| `0021_consent_logs.sql` | Phase 7 #234 — cria `consent_logs` para decisões granulares do banner de cookies (`necessary`, `analytics`, `marketing`) com `action` (`accept_all`, `accept_selected`, `reject`), IP/UA opcionais, RLS habilitado e leitura futura pelo owner quando `user_id` existir. Escrita via service-role em Server Action. |
| `0022_evolution_instance_nanoid_slug.sql` | Phase 6 #130 — hardening do `evo_instance` legado, que era derivado de `user_${userId.slice(0,8)}` (32 bits → enumerável em poucos minutos via webhook público). Adiciona `whatsapp_instances.evo_instance_v2 text` nullable, backfilla com 16 chars hex via `encode(gen_random_bytes(8), 'hex')` (idempotente — só toca rows com v2 NULL), aplica NOT NULL + UNIQUE no novo column, e marca `evo_instance` como DEPRECATED via `COMMENT ON COLUMN`. Próxima migration (após restart cycle do Evolution) deve dropar `evo_instance`. Aplicação roda via Supabase MCP no projeto `pvazzozzqwwshgacmafv`. |
| `0023_lead_messages_cascade.sql` | Phase 6 #133 — reforça `ON DELETE CASCADE` no FK `lead_messages.lead_id → leads(id)`. A migration `0001_init.sql` já declarava cascade, mas a ausência de uma migration explícita deixava o contrato vulnerável a drift (rebuilds parciais, alteração fora de versionamento). É idempotente via `drop constraint if exists` + `add constraint`. Resolve o silenciamento de histórico apontado em #128 (multi-agent review): antes, `lib/messages/list-conversations.ts` precisava de `.filter(x => x !== null)` pra esconder mensagens cujo lead havia sumido. Pós-0023, mensagens são deletadas junto com o lead no DB. Aplicação roda via Supabase MCP no projeto `pvazzozzqwwshgacmafv`. |
