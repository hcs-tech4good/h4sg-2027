-- =============================================================
-- Migration 013: Email accepted hackers when an announcement is posted
--
-- announcement_emails is a per-recipient send queue, so sending is
-- resumable and nobody is emailed twice for the same announcement.
-- Recipients are applicants whose decision is released and accepted
-- at the moment the announcement is queued.
--
-- The table has RLS enabled with no policies: only the service role
-- (server actions) can read or write it.
-- =============================================================

create table if not exists announcement_emails (
  announcement_id uuid not null references announcements(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  sent_at timestamptz,
  error text,
  primary key (announcement_id, user_id)
);

alter table announcement_emails enable row level security;

create index if not exists announcement_emails_pending_idx
  on announcement_emails (announcement_id, user_id)
  where sent_at is null and error is null;

-- Queue one email per accepted (released) applicant. Safe to call again:
-- existing rows are left untouched. Returns the number of rows added.
create or replace function public.queue_announcement_emails(p_announcement_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Unauthorized';
  end if;

  if not exists (select 1 from announcements where id = p_announcement_id) then
    raise exception 'Announcement not found';
  end if;

  with inserted as (
    insert into announcement_emails (announcement_id, user_id)
    select p_announcement_id, d.id
      from decisions d
     where d.released = true and d.type = 'accepted'
    on conflict do nothing
    returning 1
  )
  select count(*) into v_count from inserted;

  return v_count;
end;
$$;

revoke execute on function public.queue_announcement_emails(uuid) from public, anon, authenticated;
grant execute on function public.queue_announcement_emails(uuid) to service_role;

-- Claim the next batch to send. Marks rows sent_at = now() up front
-- (skip locked => two admins can never claim the same row). The caller
-- resets sent_at on failure.
create or replace function public.claim_announcement_emails(p_announcement_id uuid, p_limit int)
returns table (user_id uuid, email text, first_name text)
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
    update announcement_emails ae
       set sent_at = now()
     where ae.announcement_id = p_announcement_id
       and ae.user_id in (
         select x.user_id
           from announcement_emails x
          where x.announcement_id = p_announcement_id
            and x.sent_at is null
            and x.error is null
          order by x.user_id
          limit greatest(p_limit, 0)
          for update skip locked
       )
    returning ae.user_id
  )
  select c.user_id, u.email::text, p.first_name::text
    from claimed c
    left join auth.users u on u.id = c.user_id
    left join profiles p on p.id = c.user_id;
end;
$$;

revoke execute on function public.claim_announcement_emails(uuid, int) from public, anon, authenticated;
grant execute on function public.claim_announcement_emails(uuid, int) to service_role;
