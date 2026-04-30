-- ============================================================
--  CRM Pipeline Restructure
--  הופך את ה-CRM למערכת ניהול מכירות אמיתית עם שלבים ברורים.
-- ============================================================

-- 1) הרחבת רשימת הסטטוסים האפשריים + הוספת won/lost/in_progress/not_interested
alter table public.leads drop constraint if exists leads_status_check;

-- מיגרציה מהסטטוסים הישנים לחדשים:
--   contacted        → in_progress  (התחלתי לדבר איתם)
--   not_relevant     → not_interested  (אמרו לא)
--   closed           → won  (נסגר בהצלחה)
update public.leads set status = 'in_progress'   where status = 'contacted';
update public.leads set status = 'not_interested' where status = 'not_relevant';
update public.leads set status = 'won'           where status = 'closed';

alter table public.leads
  add constraint leads_status_check
  check (status in (
    'new',
    'in_progress',
    'interested',
    'follow_up',
    'not_interested',
    'won',
    'lost'
  ));

-- 2) שדות חדשים — סיבות, סכומי עסקה, היסטוריית מגע
alter table public.leads
  add column if not exists not_interested_reason text,
  add column if not exists not_interested_note   text,
  add column if not exists deal_amount           numeric default 0,
  add column if not exists deal_closed_at        date,
  add column if not exists deal_what_sold        text,
  add column if not exists lost_reason           text,
  add column if not exists lost_can_return       boolean default false,
  add column if not exists lost_return_date      date,
  add column if not exists money_potential_score integer default 0,
  add column if not exists last_contacted_at     timestamptz,
  add column if not exists call_count            integer default 0;

create index if not exists leads_status_user_idx       on public.leads (user_id, status);
create index if not exists leads_follow_up_date_idx    on public.leads (user_id, follow_up_date)   where follow_up_date is not null;
create index if not exists leads_lost_return_date_idx  on public.leads (user_id, lost_return_date) where lost_return_date is not null;
create index if not exists leads_money_potential_idx   on public.leads (user_id, money_potential_score desc);

-- 3) טבלת פעילויות (היסטוריית שיחות / וואטסאפ / שינויי סטטוס)
create table if not exists public.lead_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  user_id uuid not null references auth.users(id)   on delete cascade,
  activity_type text not null,
  -- 'call_attempt' | 'call_done' | 'whatsapp' | 'note' | 'status_change' | 'reminder'
  outcome text,
  -- 'no_answer' | 'answered' | 'left_message' | 'hung_up' וכו'
  notes text,
  status_from text,
  status_to text,
  created_at timestamptz not null default now()
);

create index if not exists lead_activities_lead_idx     on public.lead_activities (lead_id, created_at desc);
create index if not exists lead_activities_user_idx     on public.lead_activities (user_id, created_at desc);

alter table public.lead_activities enable row level security;

drop policy if exists lead_activities_owner on public.lead_activities;
create policy lead_activities_owner on public.lead_activities
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 4) trigger שמעדכן last_contacted_at + call_count כשנרשמת פעילות שיחה
create or replace function public.bump_lead_contact_stats()
returns trigger as $$
begin
  if new.activity_type in ('call_attempt', 'call_done', 'whatsapp') then
    update public.leads
    set last_contacted_at = now(),
        call_count = coalesce(call_count, 0) + case when new.activity_type = 'note' then 0 else 1 end
    where id = new.lead_id;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists lead_activities_bump on public.lead_activities;
create trigger lead_activities_bump
  after insert on public.lead_activities
  for each row execute function public.bump_lead_contact_stats();

-- ============================================================
-- ✅ מוכן. הסטטוסים הישנים הומרו אוטומטית.
-- ============================================================
