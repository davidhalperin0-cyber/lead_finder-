-- רשימת השתקה: ליד שנמחק לא חוזר בחיפוש הבא.
--
-- עד היום המחיקה הסירה את השורה בלבד, והחיפוש הבא מצא את אותו עסק מחדש.
-- ה-docstring של delete_lead הבטיח שמירה בטבלת `searched_domains` — טבלה
-- כזו מעולם לא נוצרה.
--
-- ההשתקה עובדת בשלוש רמות, כי לעסק אין מזהה יחיד אמין:
--   site_key   — דומיין/מפתח אתר
--   phone_norm — טלפון מנורמל (+972...), תופס עסק שהחליף אתר
--   brand_key  — שם מותג מנורמל. מחיקת סניף ארומה אחד מוחקת את כל הרשת.

create table if not exists public.suppressed_leads (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  site_key    text,
  phone_norm  text,
  brand_key   text,
  scope       text not null default 'lead',   -- lead | brand
  reason      text,
  business_name text,
  created_at  timestamptz not null default now(),
  constraint suppressed_leads_needs_identifier
    check (site_key is not null or phone_norm is not null or brand_key is not null)
);

alter table public.suppressed_leads enable row level security;

drop policy if exists suppressed_leads_owner on public.suppressed_leads;
create policy suppressed_leads_owner on public.suppressed_leads
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_suppressed_user_site
  on public.suppressed_leads (user_id, site_key);
create index if not exists idx_suppressed_user_phone
  on public.suppressed_leads (user_id, phone_norm);
create index if not exists idx_suppressed_user_brand
  on public.suppressed_leads (user_id, brand_key);

-- מונע כפילויות כשמוחקים את אותו עסק פעמיים
create unique index if not exists uq_suppressed_identity
  on public.suppressed_leads (
    user_id,
    coalesce(site_key, ''),
    coalesce(phone_norm, ''),
    coalesce(brand_key, '')
  );
