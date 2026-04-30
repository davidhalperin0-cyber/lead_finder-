-- Lead Finder CRM — הרץ ב-Supabase SQL Editor או עם CLI
-- לאחר מכן: Authentication → הפעל Email provider
-- אם יש שגיאה על execute procedure — החליפי ל: execute function public.set_updated_at()

create table if not exists public.search_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  city text not null,
  business_type text not null,
  limit_n int not null default 20,
  use_ai boolean not null default true,
  export_html boolean not null default false,
  screenshots boolean not null default false,
  workers int not null default 4,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'completed', 'failed')),
  progress_current int not null default 0,
  progress_total int not null default 0,
  error_message text,
  result_summary jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  search_job_id uuid references public.search_jobs (id) on delete set null,
  business_name text,
  website text,
  final_url text,
  score int not null default 0,
  grade text,
  issues jsonb not null default '[]',
  email text,
  phone text,
  whatsapp text,
  facebook text,
  instagram text,
  address text,
  last_copyright text,
  has_https boolean not null default false,
  is_mobile_friendly boolean not null default false,
  cms text,
  lead_error text,
  ai_summary text,
  main_problems jsonb not null default '[]',
  ux_issues jsonb not null default '[]',
  trust_issues jsonb not null default '[]',
  conversion_issues jsonb not null default '[]',
  best_talking_point text,
  suggested_angle text,
  priority_level text,
  ai_notes text,
  screenshot_path text,
  search_city text,
  search_business_type text,
  opportunity_score int not null default 0,
  close_probability int not null default 0,
  strongest_problem text,
  business_impact text,
  opening_line text,
  if_not_interested text,
  what_to_offer text,
  next_action text,
  call_prep text,
  status text not null default 'new'
    check (status in (
      'new', 'contacted', 'interested', 'follow_up', 'closed', 'not_relevant'
    )),
  notes text,
  follow_up_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leads_user_id_idx on public.leads (user_id);
create index if not exists leads_search_job_idx on public.leads (search_job_id);
create index if not exists leads_status_idx on public.leads (status);
create index if not exists leads_city_idx on public.leads (search_city);
create index if not exists leads_score_idx on public.leads (score desc);
create index if not exists search_jobs_user_idx on public.search_jobs (user_id);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists tr_leads_updated on public.leads;
create trigger tr_leads_updated
  before update on public.leads
  for each row execute procedure public.set_updated_at();

drop trigger if exists tr_search_jobs_updated on public.search_jobs;
create trigger tr_search_jobs_updated
  before update on public.search_jobs
  for each row execute procedure public.set_updated_at();

alter table public.search_jobs enable row level security;
alter table public.leads enable row level security;

create policy "users own search_jobs"
  on public.search_jobs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users own leads"
  on public.leads for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
