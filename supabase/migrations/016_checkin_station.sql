-- =============================================================
-- Migration 016: Check-in station
--
--  1. A 'checkin' role for the shared check-in station account. It is
--     not staff: it can't read applications, decisions or profiles.
--     Everything it does goes through the service-role functions below.
--  2. ensure_checkin_token / backfill_checkin_tokens: every accepted
--     (released) hacker gets a check-in token, in the same format as
--     the imported ones: "HKP_" + 32 symbols.
--  3. station_check_in: resolves a scanned token (or HHID + last name),
--     checks the hacker is accepted, and checks them in atomically, so
--     two stations scanning the same code can't both succeed.
--  4. station_undo_check_in: reverses a check-in made in the last
--     15 minutes, for a mistaken scan.
--
-- All functions are SECURITY DEFINER, callable only by the service role.
-- =============================================================

-- ---------- 1. 'checkin' role ----------
-- Drop the role check constraint by whatever name it has, then re-add it.
do $$
declare
  c record;
begin
  for c in
    select conname
      from pg_constraint
     where conrelid = 'public.profiles'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%role%'
  loop
    execute format('alter table public.profiles drop constraint %I', c.conname);
  end loop;
end $$;

alter table profiles
  add constraint profiles_role_check
  check (role in ('applicant', 'reviewer', 'admin', 'checkin'));

-- ---------- 2. Check-in tokens ----------
-- 32 symbols from the Crockford alphabet (no I, L, O, U), 5 random bits
-- each = 160 bits. Randomness comes from gen_random_uuid(), which uses the
-- server's strong random source; byte 6 of each UUID carries the version
-- nibble and is skipped, and only the low 5 bits of every byte are used, so
-- each symbol is uniformly random.
create or replace function public.new_checkin_token()
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  alphabet constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  token text := 'HKP_';
  bytes bytea;
  i int;
begin
  while length(token) < 36 loop
    bytes := uuid_send(gen_random_uuid());
    for i in 0..15 loop
      continue when i = 6;
      exit when length(token) = 36;
      token := token || substr(alphabet, (get_byte(bytes, i) & 31) + 1, 1);
    end loop;
  end loop;
  return token;
end;
$$;

revoke execute on function public.new_checkin_token() from public, anon, authenticated;
grant execute on function public.new_checkin_token() to service_role;

-- Returns the hacker's token, creating one if they are accepted and have
-- none. Returns NULL for anyone who isn't accepted. Safe to call repeatedly
-- and concurrently.
create or replace function public.ensure_checkin_token(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
  attempts int := 0;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Unauthorized';
  end if;

  select token into v_token from checkin_tokens where id = p_user_id;
  if found then
    return v_token;
  end if;

  if not exists (
    select 1 from decisions
     where id = p_user_id and released = true and type = 'accepted'
  ) then
    return null;
  end if;

  loop
    begin
      insert into checkin_tokens (id, token)
      values (p_user_id, public.new_checkin_token())
      on conflict (id) do nothing;
      exit;
    exception
      when unique_violation then
        -- A token collision (vanishingly unlikely at 160 bits): try again.
        attempts := attempts + 1;
        if attempts >= 5 then
          raise exception 'Could not generate a unique check-in token';
        end if;
    end;
  end loop;

  select token into v_token from checkin_tokens where id = p_user_id;
  return v_token;
end;
$$;

revoke execute on function public.ensure_checkin_token(uuid) from public, anon, authenticated;
grant execute on function public.ensure_checkin_token(uuid) to service_role;

-- Gives every accepted hacker without a token a new one. Returns how many
-- were created. Existing tokens are never changed.
create or replace function public.backfill_checkin_tokens()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  created int := 0;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Unauthorized';
  end if;

  for r in
    select d.id
      from decisions d
     where d.released = true and d.type = 'accepted'
       and not exists (select 1 from checkin_tokens t where t.id = d.id)
  loop
    perform public.ensure_checkin_token(r.id);
    created := created + 1;
  end loop;

  return created;
end;
$$;

revoke execute on function public.backfill_checkin_tokens() from public, anon, authenticated;
grant execute on function public.backfill_checkin_tokens() to service_role;

-- ---------- 3. Check in ----------
-- Pass either p_token, or p_hhid together with p_last_name.
-- status is one of:
--   checked_in          checked in just now
--   already_checked_in  was already checked in (checked_in_at = when)
--   not_accepted        found, but not an accepted hacker (decision says why)
--   unknown             no hacker matches the token / HHID + last name
create or replace function public.station_check_in(
  p_token text,
  p_hhid text,
  p_last_name text,
  p_by uuid
)
returns table (
  status text,
  user_id uuid,
  first_name text,
  last_name text,
  hhid text,
  shirt_size text,
  registration text,
  decision text,
  checked_in_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_first text;
  v_last text;
  v_hhid text;
  v_shirt text;
  v_registration text;
  v_decision text;
  v_at timestamptz;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Unauthorized';
  end if;

  if p_token is not null then
    select t.id into v_id from checkin_tokens t where t.token = p_token;
  elsif p_hhid is not null and p_last_name is not null then
    select p.id into v_id
      from profiles p
     where p.hhid = p_hhid
       and lower(btrim(p.last_name)) = lower(btrim(p_last_name));
  end if;

  if v_id is null then
    return query select 'unknown'::text, null::uuid, null::text, null::text, null::text,
                        null::text, null::text, null::text, null::timestamptz;
    return;
  end if;

  select p.first_name, p.last_name, p.hhid into v_first, v_last, v_hhid
    from profiles p where p.id = v_id;
  select a.shirt_size into v_shirt from applications a where a.id = v_id;
  select case when c.confirmed ilike 'yes%' then 'coming' else 'not_coming' end
    into v_registration
    from confirmations c where c.id = v_id;
  v_registration := coalesce(v_registration, 'not_registered');

  select case
           when d.released and d.type = 'accepted' then 'accepted'
           when not d.released then 'staged'
           else d.type
         end
    into v_decision
    from decisions d where d.id = v_id;
  v_decision := coalesce(v_decision, 'none');

  if v_decision <> 'accepted' then
    return query select 'not_accepted'::text, v_id, v_first, v_last, v_hhid,
                        v_shirt, v_registration, v_decision, null::timestamptz;
    return;
  end if;

  -- Atomic: whichever station gets here first checks them in; any other
  -- concurrent or later scan sees "already checked in".
  update checkins c
     set checked_in = true, checked_in_at = now(), checked_in_by = p_by
   where c.id = v_id and c.checked_in is not true
  returning c.checked_in_at into v_at;

  if not found then
    insert into checkins (id, checked_in, checked_in_at, checked_in_by)
    values (v_id, true, now(), p_by)
    on conflict (id) do nothing
    returning checkins.checked_in_at into v_at;
  end if;

  if v_at is not null then
    return query select 'checked_in'::text, v_id, v_first, v_last, v_hhid,
                        v_shirt, v_registration, v_decision, v_at;
    return;
  end if;

  select c.checked_in_at into v_at from checkins c where c.id = v_id;
  return query select 'already_checked_in'::text, v_id, v_first, v_last, v_hhid,
                      v_shirt, v_registration, v_decision, v_at;
end;
$$;

revoke execute on function public.station_check_in(text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.station_check_in(text, text, text, uuid) to service_role;

-- ---------- 4. Undo ----------
-- Only reverses a check-in from the last 15 minutes, so the station can fix
-- a mistaken scan but can't wipe out earlier check-ins.
create or replace function public.station_undo_check_in(p_user_id uuid, p_by uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Unauthorized';
  end if;

  update checkins
     set checked_in = false, checked_in_at = null, checked_in_by = p_by
   where id = p_user_id
     and checked_in = true
     and checked_in_at > now() - interval '15 minutes';

  return found;
end;
$$;

revoke execute on function public.station_undo_check_in(uuid, uuid) from public, anon, authenticated;
grant execute on function public.station_undo_check_in(uuid, uuid) to service_role;
