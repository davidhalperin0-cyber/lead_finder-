-- Add support for businesses without a website.
-- no_website: דגל שמסמן עסקים בלי אתר אינטרנט (לידים מועדפים לבעלי אתרים)
-- social_url: קישור לדף פייסבוק/אינסטגרם/גוגל אם קיים

alter table public.leads
  add column if not exists no_website boolean default false,
  add column if not exists social_url text;
