-- ============================================================
-- 0016_site_variables_v2.sql
-- Phase 7 — Site Generator (Concessionárias) — issue #197 PR-C
-- ------------------------------------------------------------
-- Migra `lead_sites.variables` de shape **v1 flat** para
-- **v2 nested** (`brand_assets`, `address` estruturado,
-- `cars[].{category,doors,photos,vin,plates_visible}`,
-- `schema_version: 2`).
--
-- Diagnóstico: PR-A (#205) introduziu o schema `SiteVariablesV2`.
-- PR-B (#210) migrou os consumers via `readSiteVariablesSafe`
-- (lê v1 e v2). PR-C (este) fecha o épico migrando o write path
-- (`merge.ts` emite v2) e o estado existente do DB (esta migration).
--
-- Decisões arquiteturais:
--   * **Função PL/pgSQL `__migrate_site_variables_v1_to_v2(jsonb)
--     RETURNS jsonb`** — espelha a lógica de
--     `lib/sites/migrate-variables.ts:migrateV1ToV2()`. Single
--     source of truth: o UPDATE chama a função, simplificando
--     audit/rollback.
--   * **Idempotent:** WHERE clause filtra rows que ainda não têm
--     `schema_version` setado. Re-run = no-op.
--   * **Address estrito:** quando `address_line` não casa o regex
--     v1 (street, number — neighborhood, city - UF, zip), retorna
--     `address: null`. Evita crash em `SiteVariablesV2.parse`
--     (schema `Address` exige min(1) em 6 campos).
--   * **Backup table:** `lead_sites_v1_backup` criada antes do
--     UPDATE pra rollback sem dump externo.
--
-- Rollback:
-- ```sql
-- -- Desfaz a migration:
-- BEGIN;
-- UPDATE public.lead_sites ls
--   SET variables = backup.variables
--   FROM public.lead_sites_v1_backup backup
--   WHERE ls.id = backup.id;
-- DROP FUNCTION IF EXISTS public.__migrate_site_variables_v1_to_v2(jsonb);
-- DROP TABLE IF EXISTS public.lead_sites_v1_backup;
-- COMMIT;
-- ```
-- ============================================================

-- ------------------------------------------------------------
-- 1) Backup table — snapshot pre-migration (rollback sem dump)
-- ------------------------------------------------------------

create table if not exists public.lead_sites_v1_backup as
  table public.lead_sites with no data;

-- Insere apenas linhas que ainda são v1 (não migradas) — idempotent.
insert into public.lead_sites_v1_backup
  select * from public.lead_sites
  where variables is not null
    and not (variables ? 'schema_version')
    and not exists (
      select 1 from public.lead_sites_v1_backup b where b.id = public.lead_sites.id
    );

-- ------------------------------------------------------------
-- 2) Função PL/pgSQL — espelho de `migrateV1ToV2()` em TS
-- ------------------------------------------------------------
--
-- Recebe um jsonb v1 (flat) e retorna jsonb v2 (nested) com
-- `schema_version: 2`. Pure (sem side-effects, sem I/O externo).
-- Quando o input não bate o shape v1 mínimo, retorna o jsonb
-- inalterado — caller decide se trata isso como erro.

create or replace function public.__migrate_site_variables_v1_to_v2(v1 jsonb)
returns jsonb
language plpgsql
immutable
as $$
declare
  address_line text;
  address_match text[];
  address_jsonb jsonb;
  cars_v2 jsonb;
  brand_assets_v2 jsonb;
begin
  -- Defensive: se já é v2 ou não é objeto, retorna inalterado.
  if v1 is null or jsonb_typeof(v1) <> 'object' then
    return v1;
  end if;
  if v1 ? 'schema_version' then
    return v1;
  end if;

  -- ------------------------------------------------------------
  -- 2.1) Address: parse best-effort do `address_line` v1
  -- ------------------------------------------------------------
  -- Regex idêntico ao TS em `migrate-variables.ts:parseAddressLine`:
  -- Pattern: street, number — neighborhood, city - UF, ZIP.
  -- Aceita travessão "—" ou hífen "-" como separador.
  -- Retorna address: null se não bater (Address é .nullable() em v2).

  address_line := v1->>'address_line';

  if address_line is null or btrim(address_line) = '' then
    address_jsonb := 'null'::jsonb;
  else
    address_match := regexp_match(
      address_line,
      '^(.*?),\s*(\d+|S\/N|s\/n)\s*[—\-]\s*([^,]+?),\s*([^,]+?)\s*-\s*([A-Z]{2})\s*,?\s*(\d{5}-?\d{3})\s*$'
    );

    if address_match is null then
      address_jsonb := 'null'::jsonb;
    else
      address_jsonb := jsonb_build_object(
        'street', btrim(address_match[1]),
        'number', btrim(address_match[2]),
        'neighborhood', btrim(address_match[3]),
        'city', btrim(address_match[4]),
        'state', btrim(address_match[5]),
        'zip', btrim(address_match[6]),
        'country', 'BR'
      );
    end if;
  end if;

  -- ------------------------------------------------------------
  -- 2.2) brand_assets: nested a partir dos campos flat v1
  -- ------------------------------------------------------------
  -- Renomeio: contact_hero_image_url → contact_image_url.
  -- `car_placeholders` default `[]` (v1 não tinha; populado em writes
  -- novos via `mergeSiteVariables`).

  brand_assets_v2 := jsonb_build_object(
    'logo_url', v1->'logo_url',
    'primary_color', v1->'primary_color',
    'text_on_primary', v1->'text_on_primary',
    'hero_image_url', v1->'hero_image_url',
    'about_image_url', v1->'about_image_url',
    'contact_image_url', v1->'contact_hero_image_url',
    'car_placeholders', '[]'::jsonb
  );

  -- ------------------------------------------------------------
  -- 2.3) cars[]: augmenta com defaults v2
  -- ------------------------------------------------------------
  -- `category: 'Sedan'` default (idêntico ao TS `augmentCars`).
  -- `photos`: usa `gallery_urls` se length ≥ 3; senão 3x thumbnail.
  -- `plates_visible: false` literal (compliance).

  with car_input as (
    select value as car, ordinality - 1 as idx
    from jsonb_array_elements(coalesce(v1->'cars', '[]'::jsonb)) with ordinality
  ),
  car_output as (
    select jsonb_build_object(
      'slug', car->'slug',
      'brand', car->'brand',
      'model', car->'model',
      'year', car->'year',
      'km', car->'km',
      'price', car->'price',
      'transmission', car->'transmission',
      'fuel', car->'fuel',
      'color', car->'color',
      'description', car->'description',
      'thumbnail_url', car->'thumbnail_url',
      'gallery_urls', car->'gallery_urls',
      'datasheet', car->'datasheet',
      'featured', car->'featured',
      'category', 'Sedan',
      'plates_visible', false,
      'photos', case
        when jsonb_array_length(coalesce(car->'gallery_urls', '[]'::jsonb)) >= 3
          then car->'gallery_urls'
        else jsonb_build_array(
          car->'thumbnail_url',
          car->'thumbnail_url',
          car->'thumbnail_url'
        )
      end
    ) as car_v2, idx
    from car_input
  )
  select coalesce(jsonb_agg(car_v2 order by idx), '[]'::jsonb) into cars_v2
  from car_output;

  -- ------------------------------------------------------------
  -- 2.4) Compõe v2 final
  -- ------------------------------------------------------------

  return jsonb_build_object(
    -- Identidade
    'business_name', v1->'business_name',
    'business_slug', v1->'business_slug',
    'slogan', v1->'slogan',

    -- Contato
    'phone_display', v1->'phone_display',
    'whatsapp', v1->'whatsapp',
    'email', v1->'email',
    'address', address_jsonb,
    'hours', v1->'hours',

    -- Social
    'instagram_url', v1->'instagram_url',
    'facebook_url', v1->'facebook_url',
    'youtube_url', v1->'youtube_url',

    -- Visual
    'brand_assets', brand_assets_v2,

    -- Conteúdo de página
    'home_categories', v1->'home_categories',
    'emphasis', v1->'emphasis',
    'recent_sales', v1->'recent_sales',

    -- Sobre
    'about_text', v1->'about_text',
    'mission', v1->'mission',
    'vision', v1->'vision',
    'values', v1->'values',

    -- Estoque
    'cars', cars_v2,

    -- Metadata
    'schema_version', 2,
    'generated_by', v1->'generated_by',
    'generation_version', v1->'generation_version'
  );
end;
$$;

-- ------------------------------------------------------------
-- 3) UPDATE — migra rows v1 → v2
-- ------------------------------------------------------------
--
-- Idempotent: filtra rows que ainda não têm `schema_version`. Re-run
-- após primeira execução = 0 rows afetadas.

do $$
declare
  migrated_count int;
begin
  update public.lead_sites
  set variables = public.__migrate_site_variables_v1_to_v2(variables),
      updated_at = now()
  where variables is not null
    and not (variables ? 'schema_version');

  get diagnostics migrated_count = row_count;
  raise notice 'Migrated % row(s) of lead_sites.variables to v2', migrated_count;
end;
$$;
