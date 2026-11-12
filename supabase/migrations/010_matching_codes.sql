-- =============================================================
-- Migration 010: Hacker matching platform codes
--
-- One unique code per accepted hacker, granting access to the
-- external matching platform (matching.hhuh.io). Codes are imported
-- out-of-band (scripts/import-matching-codes.mjs) from a CSV that is
-- never committed to the repo — see .gitignore.
--
-- RLS is intentionally minimal: a user can only ever select their own
-- code. There are no insert/update/delete policies for authenticated
-- users at all — the only writer is the import script, which uses the
-- service role key and bypasses RLS entirely.
-- =============================================================

create table if not exists matching_codes (
  id uuid primary key references auth.users(id) on delete cascade,
  code text not null unique,
  created_at timestamptz default now()
);

alter table matching_codes enable row level security;

drop policy if exists "Users can view own matching code" on matching_codes;
create policy "Users can view own matching code" on matching_codes
  for select using (auth.uid() = id);

drop policy if exists "Staff can view all matching codes" on matching_codes;
create policy "Staff can view all matching codes" on matching_codes
  for select using (public.is_staff());
