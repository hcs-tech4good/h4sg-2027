-- =============================================================
-- Migration 007: Allow bootstrapping the first admin
--
-- The role-change guard and promote RPC (migration 002) only trusted
-- the 'service_role'. That also blocked direct DB / Supabase SQL editor
-- access (which runs as postgres, where auth.role() is null), making it
-- impossible to create the first admin.
--
-- These redefinitions block only the untrusted end-user API roles
-- ('anon', 'authenticated'), while allowing:
--   - service_role  (admin server actions)
--   - direct DB / SQL editor access (bootstrap the first admin)
-- =============================================================

create or replace function public.prevent_unauthorized_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role
     and coalesce(auth.role(), '') in ('anon', 'authenticated') then
    raise exception 'Only administrators can change user roles';
  end if;
  return new;
end;
$$;

create or replace function promote_user_by_email(target_email text, new_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_user_id uuid;
begin
  if coalesce(auth.role(), '') in ('anon', 'authenticated') and not public.is_admin() then
    raise exception 'Unauthorized';
  end if;

  if new_role not in ('applicant', 'reviewer', 'admin') then
    raise exception 'Invalid role';
  end if;

  select id into target_user_id
  from auth.users
  where email = target_email
  limit 1;

  if target_user_id is null then
    raise exception 'User not found with email: %', target_email;
  end if;

  update profiles set role = new_role where id = target_user_id;
end;
$$;

revoke execute on function promote_user_by_email(text, text) from anon, public;
