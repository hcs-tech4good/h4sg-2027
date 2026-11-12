-- =============================================================
-- Migration 005: Auto-create profile on signup (race-free)
--
-- Creates the profile row inside the same transaction as the
-- auth.users insert, so the profiles.id -> auth.users(id) FK is
-- always satisfied. Removes the client-side race that produced
-- "unexpected response from the server" on signup.
--
-- The client createProfile() call becomes a harmless no-op
-- (hits the unique constraint, which it already tolerates).
-- =============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_hhid text;
  attempts int := 0;
begin
  loop
    new_hhid := 'HH-' || lpad((floor(random() * 9000000) + 1000000)::int::text, 7, '0');
    begin
      insert into public.profiles (id, first_name, last_name, hhid, role)
      values (
        new.id,
        coalesce(nullif(new.raw_user_meta_data->>'first_name', ''), 'User'),
        coalesce(new.raw_user_meta_data->>'last_name', ''),
        new_hhid,
        'applicant'
      );
      exit;
    exception
      when unique_violation then
        -- Could be a duplicate HHID (retry) or the profile already
        -- exists (id conflict) — in the latter case, stop.
        if exists (select 1 from public.profiles where id = new.id) then
          exit;
        end if;
        attempts := attempts + 1;
        if attempts >= 5 then
          raise exception 'Could not generate a unique HHID for %', new.id;
        end if;
    end;
  end loop;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
