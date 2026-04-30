-- Storage + screenshot URL
-- Note: bucket creation is typically done via Supabase Dashboard (Storage).
-- This migration just adds the DB column used by the app.

alter table public.leads
  add column if not exists screenshot_url text;

