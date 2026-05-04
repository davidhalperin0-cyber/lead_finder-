-- תסריט שיחה אנושי מורחב לליד - שדות שה-AI ממלא לכל עסק
alter table public.leads
  add column if not exists script_intro text,
  add column if not exists script_discovery jsonb default '[]'::jsonb,
  add column if not exists script_value_pitch text,
  add column if not exists script_offer text,
  add column if not exists script_close text,
  add column if not exists script_objections jsonb default '{}'::jsonb,
  add column if not exists script_dos_and_donts jsonb default '[]'::jsonb;
