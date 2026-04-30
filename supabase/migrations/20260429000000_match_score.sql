-- Add match_score / match_reason to leads.
-- These fields store how well a lead matches the user's free-text "description"
-- given at search time. AI-driven, 0-100 scale.

alter table public.leads
  add column if not exists match_score integer default 0,
  add column if not exists match_reason text;

-- Optional index to sort by match_score quickly
create index if not exists leads_match_score_idx on public.leads (user_id, match_score desc);
