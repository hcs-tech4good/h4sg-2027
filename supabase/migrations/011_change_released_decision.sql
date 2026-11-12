-- =============================================================
-- Migration 011: Change the decision of an already-released applicant
--
-- Staff can move a released decision to a different type (e.g.
-- waitlisted -> accepted). The change is recorded in decision_releases
-- and the applicant is re-queued for the decision update email by
-- clearing notified_at/notify_error. released_at is kept so it still
-- reflects when the applicant was first released.
--
-- Returns the previous type, or NULL if nothing changed (same type).
-- =============================================================

create or replace function public.change_released_decision(
  p_id uuid,
  p_type text,
  p_changed_by uuid
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old text;
  v_released boolean;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Unauthorized';
  end if;

  if p_type not in ('accepted', 'waitlisted', 'rejected') then
    raise exception 'Invalid decision type';
  end if;

  select type, released into v_old, v_released
    from decisions
   where id = p_id
     for update;

  if not found then
    raise exception 'No decision for this applicant';
  end if;
  if not v_released then
    raise exception 'Decision is not released; use makeDecision instead';
  end if;
  if v_old = p_type then
    return null;
  end if;

  update decisions
     set type = p_type,
         decided_by = p_changed_by,
         decided_at = now(),
         notified_at = null,
         notify_error = null
   where id = p_id;

  insert into decision_releases (released_by, decision_ids, released_at, notes)
  values (
    p_changed_by,
    array[p_id],
    now(),
    format('Changed from %s to %s', v_old, p_type)
  );

  return v_old;
end;
$$;

revoke execute on function public.change_released_decision(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.change_released_decision(uuid, text, uuid) to service_role;
