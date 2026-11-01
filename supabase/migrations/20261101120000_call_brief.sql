-- כרטיס הכנה לשיחה: נבנה לכל ליד כשהמוכרת פותחת אותו (call_brief.py)
alter table public.leads
  add column if not exists call_brief jsonb,
  add column if not exists call_brief_at timestamptz;

create index if not exists leads_call_brief_at_idx on public.leads (call_brief_at);
