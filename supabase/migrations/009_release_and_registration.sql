-- =============================================================
-- Migration 009: Decision release + email notifications + registration
--
--  1. decisions.notified_at / notify_error: track whether the
--     "your application was updated" email went out, so sending is
--     resumable and never double-sends.
--  2. release_decisions(): atomic bulk release + audit record.
--  3. claim_pending_notifications(): atomically claim the next batch
--     of released-but-unemailed decisions and return their auth email.
--  4. confirmations: registration fields (name, email, startup survey).
--  5. Confirmation writes now go through a server action that checks
--     the applicant was accepted + released, so the client-side
--     insert/update policies are dropped.
-- =============================================================

-- ---------- 1. Notification tracking ----------
alter table decisions
  add column if not exists notified_at timestamptz,
  add column if not exists notify_error text;

-- Anything already released before this feature existed is treated as
-- notified so it is never mass-emailed retroactively.
update decisions
   set notified_at = coalesce(released_at, now())
 where released = true and notified_at is null;

create index if not exists decisions_pending_notify_idx
  on decisions (released_at, id)
  where released = true and notified_at is null and notify_error is null;

-- ---------- 2. Atomic bulk release ----------
create or replace function public.release_decisions(p_ids uuid[], p_released_by uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids uuid[];
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Unauthorized';
  end if;

  with updated as (
    update decisions
       set released = true,
           released_at = now(),
           notified_at = null,
           notify_error = null
     where id = any(p_ids)
       and released = false
    returning id
  )
  select coalesce(array_agg(id), '{}'::uuid[]) into v_ids from updated;

  if coalesce(array_length(v_ids, 1), 0) > 0 then
    insert into decision_releases (released_by, decision_ids, released_at)
    values (p_released_by, v_ids, now());
  end if;

  return coalesce(array_length(v_ids, 1), 0);
end;
$$;

revoke execute on function public.release_decisions(uuid[], uuid) from public, anon, authenticated;
grant execute on function public.release_decisions(uuid[], uuid) to service_role;

-- ---------- 3. Claim the next batch of decisions to email ----------
-- Marks rows notified_at = now() up front (skip locked => two admins can
-- never claim the same row). The caller resets notified_at on failure.
create or replace function public.claim_pending_notifications(p_limit int)
returns table (id uuid, email text, first_name text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Unauthorized';
  end if;

  return query
  with claimed as (
    update decisions d
       set notified_at = now()
     where d.id in (
       select x.id
         from decisions x
        where x.released = true
          and x.notified_at is null
          and x.notify_error is null
        order by x.released_at, x.id
        limit greatest(p_limit, 0)
        for update skip locked
     )
    returning d.id
  )
  select c.id, u.email::text, p.first_name::text
    from claimed c
    left join auth.users u on u.id = c.id
    left join profiles p on p.id = c.id;
end;
$$;

revoke execute on function public.claim_pending_notifications(int) from public, anon, authenticated;
grant execute on function public.claim_pending_notifications(int) to service_role;

-- ---------- 4. Registration fields ----------
alter table confirmations
  add column if not exists full_name text,
  add column if not exists email text,
  add column if not exists building_startup boolean,
  add column if not exists startup_stage text;

-- The stage question only applies to people building a startup.
alter table confirmations drop constraint if exists confirmations_startup_stage_requires_startup;
alter table confirmations
  add constraint confirmations_startup_stage_requires_startup
  check (startup_stage is null or building_startup is true);

-- ---------- 5. Confirmation writes are server-only ----------
drop policy if exists "Users can insert own confirmation" on confirmations;
drop policy if exists "Users can update own confirmation" on confirmations;
