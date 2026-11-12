-- =============================================================
-- Migration 015: Check-in QR tokens
--
-- One token per hacker, shown on their dashboard as a QR code for
-- check-in. Tokens are issued outside the portal and imported with
-- scripts/import-qr-tokens.mjs from a CSV that is never committed.
--
-- A hacker can read only their own token; staff can read all. There
-- are no insert/update/delete policies: only the service role writes.
-- =============================================================

create table if not exists checkin_tokens (
  id uuid primary key references auth.users(id) on delete cascade,
  token text not null unique,
  created_at timestamptz default now()
);

alter table checkin_tokens enable row level security;

drop policy if exists "Users can view own checkin token" on checkin_tokens;
create policy "Users can view own checkin token" on checkin_tokens
  for select to authenticated using (auth.uid() = id);

drop policy if exists "Staff can view all checkin tokens" on checkin_tokens;
create policy "Staff can view all checkin tokens" on checkin_tokens
  for select to authenticated using (public.is_staff());
