-- אותות איכות מ-Google Places + סיווג נוכחות דיגיטלית.
-- עד עכשיו הדירוג ומספר הביקורות נשלפו מגוגל (ושולם עליהם ב-FieldMask)
-- ואז נזרקו. הם אות החיוּת האמין היחיד שיש לנו — אינסטגרם ופייסבוק
-- לא ניתנים לקריאה בלי אימות.

alter table public.leads
  add column if not exists web_category text,
  add column if not exists google_rating numeric(2,1),
  add column if not exists google_review_count integer,
  add column if not exists liveness text,
  add column if not exists call_priority_score integer;

comment on column public.leads.web_category is
  'none | social_only | aggregator | chain_corporate | own_site';
comment on column public.leads.liveness is
  'strong | ok | weak | unknown — לפי מספר ביקורות בגוגל';
comment on column public.leads.call_priority_score is
  '0-100, גבוה = לחייג קודם';

-- סדר החיוג של אשת המכירות
create index if not exists idx_leads_call_priority
  on public.leads (user_id, call_priority_score desc nulls last);
