-- Stability updates (dedupe, progress, timestamps)
-- Run after 20260228120000_init_lead_crm.sql

-- Leads: data quality + dedupe key + analyzed timestamp
alter table public.leads
  add column if not exists site_key text,
  add column if not exists last_analyzed_at timestamptz,
  add column if not exists error_reason text;

-- Backfill best-effort (existing rows)
update public.leads
set error_reason = lead_error
where error_reason is null and lead_error is not null;

-- Dedupe per user + canonical site key
create unique index if not exists leads_user_site_key_uniq
  on public.leads (user_id, site_key)
  where site_key is not null and site_key <> '';

-- Jobs: richer progress counters
alter table public.search_jobs
  add column if not exists found_count int not null default 0,
  add column if not exists analyzed_count int not null default 0,
  add column if not exists saved_count int not null default 0,
  add column if not exists error_count int not null default 0;

