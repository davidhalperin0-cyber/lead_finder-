-- Add website age + technical detail columns.
-- first_seen_year: השנה הראשונה שהאתר תועד ב-Wayback Machine
-- domain_age_years: כמה שנים עברו מהסנאפשוט הראשון
-- load_time_ms: זמן טעינה במילישניות
-- html_size_kb: גודל ה-HTML ב-KB

alter table public.leads
  add column if not exists first_seen_year integer default 0,
  add column if not exists domain_age_years integer default 0,
  add column if not exists load_time_ms integer default 0,
  add column if not exists html_size_kb numeric default 0;
