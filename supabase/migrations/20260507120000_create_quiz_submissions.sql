-- WrenchFlow Auto · paywall onboarding submissions
-- One row per quiz submission. `intent` distinguishes the lifecycle stage:
--   'submit'  → user unlocked their score (email captured)
--   'connect' → user clicked "Connect my shop & build my plan" on the score screen

create extension if not exists "pgcrypto";

create table if not exists public.quiz_submissions (
  id           uuid primary key default gen_random_uuid(),
  session_id   text not null,
  intent       text not null check (intent in ('submit','connect')),
  contact      jsonb not null default '{}'::jsonb,
  answers      jsonb not null default '[]'::jsonb,
  revenue      integer,
  score        integer,
  duration_ms  integer,
  user_agent   text,
  created_at   timestamptz not null default now()
);

create index if not exists quiz_submissions_session_idx
  on public.quiz_submissions (session_id);

create index if not exists quiz_submissions_created_idx
  on public.quiz_submissions (created_at desc);

-- Row-level security: deny by default, allow inserts from the anon key
-- (the Edge Function uses the service role and bypasses RLS, but enabling
-- RLS keeps the table safe if anyone hits PostgREST directly).
alter table public.quiz_submissions enable row level security;

drop policy if exists "anon can insert quiz submissions" on public.quiz_submissions;
create policy "anon can insert quiz submissions"
  on public.quiz_submissions
  for insert
  to anon
  with check (true);

drop policy if exists "service role full access" on public.quiz_submissions;
create policy "service role full access"
  on public.quiz_submissions
  for all
  to service_role
  using (true)
  with check (true);
