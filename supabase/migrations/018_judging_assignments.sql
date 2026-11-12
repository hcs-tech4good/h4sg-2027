-- =============================================================
-- Migration 018: Judging assignments
--
-- Where each team is judged: project name, table, track, time slot
-- and (once assigned) the judges. One row per team member email,
-- imported with scripts/import-judging.mjs from the judging plan and
-- the Devpost export, neither of which is committed. A hacker sees the
-- row for their login or application email.
--
-- RLS is on with no policies, so only the service role can read or
-- write it. Hackers see their own row through the dashboard server.
-- =============================================================

create table if not exists judging_assignments (
  email text primary key check (email = lower(btrim(email)) and email like '%@%'),
  project_name text not null,
  table_location text not null,
  track text,
  time_slot text,
  judges text[] not null default '{}',
  updated_at timestamptz default now()
);

alter table judging_assignments enable row level security;
