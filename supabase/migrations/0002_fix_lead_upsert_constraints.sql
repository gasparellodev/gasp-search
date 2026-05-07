-- Drop the partial indexes that are preventing ON CONFLICT from working
drop index if exists public.leads_user_source_website_uniq;
drop index if exists public.leads_user_source_instagram_uniq;

-- Add proper standard UNIQUE constraints
-- These allow ON CONFLICT (user_id, source, website) to work correctly
-- Since NULL != NULL in Postgres, these allow multiple NULL websites/instagram handles,
-- providing the exact same deduplication logic as the previous partial indexes.
alter table public.leads
add constraint leads_user_source_website_uniq unique (user_id, source, website);

alter table public.leads
add constraint leads_user_source_instagram_uniq unique (user_id, source, instagram_handle);
