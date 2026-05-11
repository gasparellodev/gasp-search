-- ============================================================
-- 0019_lead_sites_visual_identity.sql
-- Phase 7 — Sprint 2 / #A1 — issue #215
-- Requires: 0010_lead_sites.sql (cria a tabela `lead_sites`)
-- ------------------------------------------------------------
-- Foundation pra Sprint 2 #A2 (#216 — generateVisualIdentity action) e
-- #A3 (#217 — admin regenerate UI). Adiciona:
--
--   1. Coluna `lead_sites.visual_identity jsonb DEFAULT NULL`
--      armazenando o manifest da identidade visual gerada por IA
--      (URLs dos banners + categories + cost estimate). Shape validado
--      em runtime pelo Zod `VisualIdentityManifestSchema` em
--      `types/visual-identity.ts` (não-NOT-NULL — sites legados nascem
--      sem manifest; admin gera sob demanda).
--
--   2. Bucket Storage `visual-identity` (PUBLIC).
--      Hosts os PNG/WebP hero/categories/about/contact gerados por
--      `gpt-image-2`. Anyone pode ler (são banners de marketing dos
--      sites públicos `/sites/[slug]`). Writes apenas via service_role
--      (admin orchestration em #216).
--
--   3. Bucket Storage `tradein-photos` (PRIVADO, LGPD-safe).
--      Hosts fotos de carros enviadas por leads no fluxo "Anuncie
--      conosco" (#O3). Placas visíveis + dados pessoais → privacidade
--      máxima. ZERO policies em `storage.objects` para este bucket =
--      deny-all para anon/authenticated; apenas service_role bypassa.
--      Admin gera signed URLs server-side quando precisa exibir.
--
-- Decisões arquiteturais (validadas pelo PO em #215):
--   * **JSONB column, não tabela dedicada.** Manifest é 1:1 com site,
--     simples (≤ 8 URLs + metadata), e nunca lido fora de admin context.
--     Tabela dedicada adiciona complexidade sem benefício (sem queries
--     analíticas cross-site sobre manifests).
--   * **`tradein-photos` PRIVADO.** Decisão LGPD-safe — fotos de carros
--     pessoais com placas visíveis exigem zero exposure pública. V1:
--     admin gera signed URL via service_role quando precisa exibir.
--     V2 poderá adicionar policy SELECT por auth.uid() quando admin UI
--     dedicada existir.
--   * **`visual-identity` PUBLIC.** Banners de marketing dos sites
--     `/sites/[slug]` (consumidos por `<Image>` em SSR) precisam ser
--     fetchable sem auth. CDN + cache-friendly.
--   * **Idempotente** — `ADD COLUMN IF NOT EXISTS`, `ON CONFLICT DO
--     NOTHING` nos buckets, `DROP POLICY IF EXISTS` antes de `CREATE
--     POLICY`. Migration pode rodar N vezes sem efeito colateral.
--
-- Shape esperado de `visual_identity` (validado em runtime pelo Zod
-- `VisualIdentityManifestSchema` em `types/visual-identity.ts`):
-- ```jsonc
-- {
--   "hero_url": "https://.../hero.webp",
--   "categories_urls": ["https://.../suv.webp", ...],   // até 6 itens
--   "about_url": "https://.../about.webp",
--   "contact_url": "https://.../contact.webp",
--   "generated_at": "2026-05-11T08:42:00.000Z",
--   "model": "gpt-image-2",
--   "cost_estimate_brl": 0.85
-- }
-- ```
--
-- Rollback (manual, se necessário):
-- ```sql
-- BEGIN;
-- -- 1. Remove policies do bucket `visual-identity`.
-- DROP POLICY IF EXISTS visual_identity_public_read ON storage.objects;
-- DROP POLICY IF EXISTS visual_identity_service_role_insert ON storage.objects;
-- DROP POLICY IF EXISTS visual_identity_service_role_update ON storage.objects;
-- DROP POLICY IF EXISTS visual_identity_service_role_delete ON storage.objects;
-- -- 2. Remove buckets (CASCADE em storage.objects esvazia os arquivos).
-- DELETE FROM storage.buckets WHERE id IN ('visual-identity','tradein-photos');
-- -- 3. Remove coluna.
-- ALTER TABLE public.lead_sites DROP COLUMN IF EXISTS visual_identity;
-- COMMIT;
-- ```
-- ============================================================

-- ------------------------------------------------------------
-- 1) Coluna `lead_sites.visual_identity jsonb DEFAULT NULL`
-- ------------------------------------------------------------

alter table public.lead_sites
  add column if not exists visual_identity jsonb default null;

comment on column public.lead_sites.visual_identity is
  'Manifest da identidade visual gerada por IA (gpt-image-2). Shape validado runtime por VisualIdentityManifestSchema em types/visual-identity.ts. Inclui hero_url, categories_urls[], about_url, contact_url, generated_at, model, cost_estimate_brl. NULL até admin gerar via action generateVisualIdentity (#216). Issue #215.';

-- ------------------------------------------------------------
-- 2) Bucket Storage `visual-identity` (PUBLIC — banners de marketing)
-- ------------------------------------------------------------
-- `public: true` permite leitura via CDN sem auth. Writes ainda
-- requerem service_role per policies abaixo (Supabase Storage faz
-- gate em storage.objects independente do flag `public`).

insert into storage.buckets (id, name, public)
values ('visual-identity', 'visual-identity', true)
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- 3) Bucket Storage `tradein-photos` (PRIVADO — LGPD-safe)
-- ------------------------------------------------------------
-- `public: false` + ZERO policies em storage.objects = deny-all para
-- anon/authenticated. Apenas service_role acessa (admin gera signed
-- URLs server-side quando precisa exibir).

insert into storage.buckets (id, name, public)
values ('tradein-photos', 'tradein-photos', false)
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- 4) Policies do bucket `visual-identity` em `storage.objects`
-- ------------------------------------------------------------
-- Pattern `drop policy if exists` + `create policy` é o canônico do
-- projeto (per 0015_lead_sites_rls_repair.sql). Idempotente.
--
-- SELECT: anyone (banners são públicos — consumidos por <Image> em
--         SSR de `/sites/[slug]/*`).
-- INSERT/UPDATE/DELETE: somente service_role (admin orchestration
--         em #216 — `generateVisualIdentity` action server-only).

drop policy if exists visual_identity_public_read on storage.objects;
create policy visual_identity_public_read on storage.objects
  for select
  using (bucket_id = 'visual-identity');

drop policy if exists visual_identity_service_role_insert on storage.objects;
create policy visual_identity_service_role_insert on storage.objects
  for insert
  with check (bucket_id = 'visual-identity' and auth.role() = 'service_role');

drop policy if exists visual_identity_service_role_update on storage.objects;
create policy visual_identity_service_role_update on storage.objects
  for update
  using (bucket_id = 'visual-identity' and auth.role() = 'service_role')
  with check (bucket_id = 'visual-identity' and auth.role() = 'service_role');

drop policy if exists visual_identity_service_role_delete on storage.objects;
create policy visual_identity_service_role_delete on storage.objects
  for delete
  using (bucket_id = 'visual-identity' and auth.role() = 'service_role');

-- ------------------------------------------------------------
-- 5) `tradein-photos` — INTENCIONALMENTE SEM POLICIES (deny-all V1)
-- ------------------------------------------------------------
-- Decisão LGPD-safe: zero policies = qualquer SELECT/INSERT/UPDATE/
-- DELETE de anon/authenticated é negado por default. Apenas
-- service_role acessa (admin gera signed URLs via API server-side).
--
-- V2 poderá adicionar:
--   create policy tradein_photos_owner_read on storage.objects
--     for select using (
--       bucket_id = 'tradein-photos'
--       and auth.uid()::text = (storage.foldername(name))[1]
--     );
-- quando admin UI dedicada existir e precisar listar uploads do user.
-- Test negativo em `tests/unit/supabase/migrations/0019_*.test.ts`
-- valida ausência de policies pra este bucket (defesa contra regressão).
