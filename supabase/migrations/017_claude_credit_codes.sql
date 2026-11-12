-- =============================================================
-- Migration 017: Claude API credit codes
--
-- A pool of single-use Claude Platform signup codes, imported with
-- scripts/import-credit-codes.mjs from a CSV that is never committed.
-- Each accepted hacker who has checked in gets one code, claimed the
-- first time they open their dashboard.
--
-- RLS is on with no policies, so only the service role can read or
-- write the pool. A code that has been handed out is never handed out
-- again, even if its hacker's account is later deleted.
-- =============================================================

create table if not exists claude_credit_codes (
  code text primary key check (code ~ '^[0-9a-f]{32}$'),
  signup_link text not null check (signup_link like 'https://platform.claude.com/%'),
  assigned_to uuid unique references auth.users(id) on delete set null,
  assigned_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists claude_credit_codes_unclaimed_idx
  on claude_credit_codes (created_at, code) where assigned_at is null;

alter table claude_credit_codes enable row level security;

-- Returns the hacker's code, claiming a free one if they are an accepted
-- hacker who has checked in and don't have one yet. Returns no row if
-- they aren't eligible or the pool is empty. Safe to call concurrently.
create or replace function public.claim_credit_code(p_user_id uuid)
returns table (code text, signup_link text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Unauthorized';
  end if;

  return query
    select c.code, c.signup_link from claude_credit_codes c where c.assigned_to = p_user_id;
  if found then
    return;
  end if;

  if not exists (
    select 1 from decisions d
     where d.id = p_user_id and d.released = true and d.type = 'accepted'
  ) or not exists (
    select 1 from checkins k where k.id = p_user_id and k.checked_in = true
  ) then
    return;
  end if;

  begin
    return query
      update claude_credit_codes c
         set assigned_to = p_user_id, assigned_at = now()
       where c.code = (
         select f.code from claude_credit_codes f
          where f.assigned_at is null
          order by f.created_at, f.code
          limit 1
          for update skip locked
       )
      returning c.code, c.signup_link;
  exception
    when unique_violation then
      -- A concurrent call for the same hacker claimed one first: use it.
      return query
        select c.code, c.signup_link from claude_credit_codes c where c.assigned_to = p_user_id;
  end;
end;
$$;

revoke execute on function public.claim_credit_code(uuid) from public, anon, authenticated;
grant execute on function public.claim_credit_code(uuid) to service_role;
