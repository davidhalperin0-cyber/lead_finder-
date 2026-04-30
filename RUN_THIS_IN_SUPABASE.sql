-- ============================================================
--  הרץ את כל הקובץ הזה פעם אחת ב-Supabase SQL Editor
--  Dashboard → SQL Editor → New Query → הדבק → Run
-- ============================================================

-- 1) הוספת match_score / match_reason ללידים
alter table public.leads
  add column if not exists match_score integer default 0,
  add column if not exists match_reason text;

create index if not exists leads_match_score_idx on public.leads (user_id, match_score desc);

-- 2) פרטים טכניים נוספים — שנת יצירת האתר, גיל דומיין, זמן טעינה, גודל HTML
alter table public.leads
  add column if not exists first_seen_year integer default 0,
  add column if not exists domain_age_years integer default 0,
  add column if not exists load_time_ms integer default 0,
  add column if not exists html_size_kb numeric default 0;

-- 3) עסקים בלי אתר אינטרנט
alter table public.leads
  add column if not exists no_website boolean default false,
  add column if not exists social_url text;

-- 4) תיקון constraint ייחודי (כדי ש-upsert יעבוד)
update public.leads
set site_key = lower(
  regexp_replace(
    coalesce(final_url, website, ''),
    '^https?://(www\.)?([^/]+)(/.*)?$',
    '\2|\3'
  )
)
where site_key is null or site_key = '';

update public.leads
set site_key = 'unknown|' || id::text
where site_key is null or site_key = '';

drop index if exists public.leads_user_site_key_uniq;

create unique index if not exists leads_user_site_key_uniq
  on public.leads (user_id, site_key);

-- ============================================================
-- ✅ אם לא יצאו שגיאות - הכל מוכן
-- ============================================================
