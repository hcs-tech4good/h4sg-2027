-- =============================================================
-- Migration 012: Bulk-change already-released decisions
--
-- Moves every selected, released decision to a new type in one
-- transaction (all or nothing), writes a single audit row, and
-- re-queues the affected applicants for the decision update email.
-- Decisions that are unreleased or already of the new type are skipped.
--
-- Returns the number of decisions changed.
-- =============================================================

create or replace function public.change_released_decisions(
  p_ids uuid[],
  p_type text,
  p_changed_by uuid
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids uuid[];
  v_summary text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Unauthorized';
  end if;

  if p_type not in ('accepted', 'waitlisted', 'rejected') then
    raise exception 'Invalid decision type';
  end if;

  -- Lock the affected rows so the summary and the update see the same set.
  perform 1
     from decisions
    where id = any(p_ids) and released = true and type <> p_type
      for update;

  select string_agg(format('%s from %s', c, t), ', ' order by t)
    into v_summary
    from (
      select type as t, count(*) as c
        from decisions
       where id = any(p_ids) and released = true and type <> p_type
       group by type
    ) s;

  with updated as (
    update decisions
       set type = p_type,
           decided_by = p_changed_by,
           decided_at = now(),
           notified_at = null,
           notify_error = null
     where id = any(p_ids) and released = true and type <> p_type
    returning id
  )
  select coalesce(array_agg(id), '{}'::uuid[]) into v_ids from updated;

  if coalesce(array_length(v_ids, 1), 0) > 0 then
    insert into decision_releases (released_by, decision_ids, released_at, notes)
    values (p_changed_by, v_ids, now(), format('Changed to %s (%s)', p_type, v_summary));
  end if;

  return coalesce(array_length(v_ids, 1), 0);
end;
$$;

revoke execute on function public.change_released_decisions(uuid[], text, uuid) from public, anon, authenticated;
grant execute on function public.change_released_decisions(uuid[], text, uuid) to service_role;
