-- =============================================================
-- Migration 014: Announcements are visible only to accepted hackers
--
-- Previously "Anyone can view announcements" used (true), so every
-- applicant, and even callers who were not signed in, could read them.
-- Now a row is readable only by staff or by an applicant whose
-- decision is released and accepted.
-- =============================================================

-- SECURITY DEFINER so the check doesn't depend on the caller's own
-- access to the decisions table.
create or replace function public.is_accepted_hacker()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.decisions
    where id = auth.uid() and released = true and type = 'accepted'
  );
$$;

revoke execute on function public.is_accepted_hacker() from public, anon;
grant execute on function public.is_accepted_hacker() to authenticated;

-- Remove every existing read policy by whatever name it has, so no older
-- permissive policy can survive alongside the new one.
do $$
declare
  p record;
begin
  for p in
    select policyname
      from pg_policies
     where schemaname = 'public' and tablename = 'announcements' and cmd = 'SELECT'
  loop
    execute format('drop policy %I on public.announcements', p.policyname);
  end loop;
end $$;

create policy "Accepted hackers and staff can view announcements" on announcements
  for select to authenticated
  using (public.is_staff() or public.is_accepted_hacker());
