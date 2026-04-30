-- Fix: ON CONFLICT (user_id, site_key) needs a non-partial unique index/constraint.
-- The previous partial index (WHERE site_key is not null and <> '') doesn't satisfy
-- supabase-py's upsert(on_conflict="user_id,site_key").
--
-- Strategy: backfill any NULL/empty site_key from final_url/website, then create
-- a regular unique index on (user_id, site_key) and drop the partial one.

-- 1) Backfill missing site_keys from URLs (best-effort: lower(host) + '|' + path)
update public.leads
set site_key = lower(
  regexp_replace(
    coalesce(final_url, website, ''),
    '^https?://(www\.)?([^/]+)(/.*)?$',
    '\2|\3'
  )
)
where site_key is null or site_key = '';

-- 2) For any leftover rows that still have empty site_key (shouldn't happen in practice),
-- give them a guaranteed-unique placeholder so the unique constraint can be added.
update public.leads
set site_key = 'unknown|' || id::text
where site_key is null or site_key = '';

-- 3) Drop the old partial index
drop index if exists public.leads_user_site_key_uniq;

-- 4) Create a regular (non-partial) unique index that ON CONFLICT can target
create unique index if not exists leads_user_site_key_uniq
  on public.leads (user_id, site_key);
