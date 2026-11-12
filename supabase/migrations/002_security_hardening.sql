-- =============================================================
-- Migration 002: Security hardening
--
-- Fixes:
--  1. Privilege escalation: users could UPDATE their own profile
--     role column and become admin/reviewer.
--  2. Infinite recursion (42P17) in the profiles "Staff can view
--     all profiles" policy (self-referential subquery).
--  3. promote_user_by_email SECURITY DEFINER RPC was directly
--     callable by any authenticated user -> self-promotion.
--  4. Resumes bucket was public -> applicant PII world-readable.
-- =============================================================

-- ---------- 1. SECURITY DEFINER role helpers (no RLS recursion) ----------
-- These run as the function owner and bypass RLS, so referencing
-- profiles inside a profiles policy no longer recurses.

create or replace function public.is_staff()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'reviewer')
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

revoke execute on function public.is_staff() from anon;
revoke execute on function public.is_admin() from anon;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.is_admin() to authenticated;

-- ---------- 2. Rebuild profiles policies without recursion ----------
drop policy if exists "Users can view own profile" on profiles;
drop policy if exists "Users can update own profile" on profiles;
drop policy if exists "Users can insert own profile" on profiles;
drop policy if exists "Staff can view all profiles" on profiles;

create policy "Users can view own profile" on profiles
  for select using (auth.uid() = id);

create policy "Staff can view all profiles" on profiles
  for select using (public.is_staff());

create policy "Users can insert own profile" on profiles
  for insert with check (auth.uid() = id);

create policy "Users can update own profile" on profiles
  for update using (auth.uid() = id);

-- ---------- 3. Block role changes except via service role ----------
-- Legitimate role changes only happen through the admin (service_role)
-- client after an admin authorization check in the server action.
-- Everyone else (a user editing their own row) is blocked here even
-- though the RLS UPDATE policy allows editing other columns.

create or replace function public.prevent_unauthorized_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role
     and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Only administrators can change user roles';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_prevent_role_change on profiles;
create trigger profiles_prevent_role_change
  before update on profiles
  for each row execute function public.prevent_unauthorized_role_change();

-- ---------- 4. Harden promote_user_by_email ----------
create or replace function promote_user_by_email(target_email text, new_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_user_id uuid;
begin
  -- Only the service role (server action after admin check) or an
  -- authenticated admin may promote users.
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_admin() then
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

-- ---------- 5. Optional: centralize other tables on helpers ----------
-- (Rebuild staff/admin policies to use the helper functions for clarity
--  and consistency. Behaviour is unchanged.)

drop policy if exists "Staff can view all applications" on applications;
create policy "Staff can view all applications" on applications
  for select using (public.is_staff());
drop policy if exists "Staff can update applications" on applications;
create policy "Staff can update applications" on applications
  for update using (public.is_staff());

drop policy if exists "Staff can view all decisions" on decisions;
create policy "Staff can view all decisions" on decisions
  for select using (public.is_staff());
drop policy if exists "Staff can insert decisions" on decisions;
create policy "Staff can insert decisions" on decisions
  for insert with check (public.is_staff());
drop policy if exists "Staff can update decisions" on decisions;
create policy "Staff can update decisions" on decisions
  for update using (public.is_staff());
drop policy if exists "Staff can delete decisions" on decisions;
create policy "Staff can delete decisions" on decisions
  for delete using (public.is_staff());

drop policy if exists "Staff can view releases" on decision_releases;
create policy "Staff can view releases" on decision_releases
  for select using (public.is_staff());
drop policy if exists "Staff can insert releases" on decision_releases;
create policy "Staff can insert releases" on decision_releases
  for insert with check (public.is_staff());

drop policy if exists "Staff can view all confirmations" on confirmations;
create policy "Staff can view all confirmations" on confirmations
  for select using (public.is_staff());

drop policy if exists "Admin can insert announcements" on announcements;
create policy "Admin can insert announcements" on announcements
  for insert with check (public.is_admin());
drop policy if exists "Admin can update announcements" on announcements;
create policy "Admin can update announcements" on announcements
  for update using (public.is_admin());
drop policy if exists "Admin can delete announcements" on announcements;
create policy "Admin can delete announcements" on announcements
  for delete using (public.is_admin());

drop policy if exists "Admin can view tokens" on invite_tokens;
create policy "Admin can view tokens" on invite_tokens
  for select using (public.is_admin());
drop policy if exists "Admin can insert tokens" on invite_tokens;
create policy "Admin can insert tokens" on invite_tokens
  for insert with check (public.is_admin());
drop policy if exists "Admin can delete tokens" on invite_tokens;
create policy "Admin can delete tokens" on invite_tokens
  for delete using (public.is_admin());
drop policy if exists "Admin can update tokens" on invite_tokens;
create policy "Admin can update tokens" on invite_tokens
  for update using (public.is_admin());

drop policy if exists "Staff can view checkins" on checkins;
create policy "Staff can view checkins" on checkins
  for select using (public.is_staff());
drop policy if exists "Staff can insert checkins" on checkins;
create policy "Staff can insert checkins" on checkins
  for insert with check (public.is_staff());
drop policy if exists "Staff can update checkins" on checkins;
create policy "Staff can update checkins" on checkins
  for update using (public.is_staff());

-- ---------- 6. Make resumes private ----------
update storage.buckets set public = false where id = 'resumes';

drop policy if exists "Anyone can read resumes" on storage.objects;

create policy "Owners can read own resume" on storage.objects
  for select using (
    bucket_id = 'resumes'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Staff can read resumes" on storage.objects
  for select using (
    bucket_id = 'resumes' and public.is_staff()
  );
