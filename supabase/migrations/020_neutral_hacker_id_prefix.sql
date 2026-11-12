-- Neutral Hacker ID prefix. Preserve account UUIDs, numeric ID suffixes,
-- foreign keys, and secret check-in tokens. Apply atomically and safely rerun.
begin;

lock table public.profiles in share row exclusive mode;

-- Do not silently change numeric suffixes or create ambiguous legacy aliases.
-- This is only possible if H- IDs were inserted before running this migration.
do $$
begin
  if exists (
    select 1 from public.profiles legacy
    join public.profiles current_id
      on current_id.hhid = 'H-' || substring(legacy.hhid from 4)
    where legacy.hhid ~ '^HH-[0-9]{7}$'
  ) then
    raise exception 'Cannot migrate Hacker IDs: an H- ID already uses an HH- ID numeric suffix. Resolve the duplicate suffix before rerunning migration 020.';
  end if;
end;
$$;

update public.profiles
set hhid = 'H-' || substring(hhid from 4)
where hhid ~ '^HH-[0-9]{7}$';

-- The signup trigger creates profiles independently of the app-side fallback.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_hacker_id text;
  attempts int := 0;
begin
  loop
    new_hacker_id := 'H-' || lpad((floor(random() * 9000000) + 1000000)::int::text, 7, '0');
    begin
      insert into public.profiles (id, first_name, last_name, hhid, role)
      values (
        new.id,
        coalesce(nullif(new.raw_user_meta_data->>'first_name', ''), 'User'),
        coalesce(new.raw_user_meta_data->>'last_name', ''),
        new_hacker_id,
        'applicant'
      );
      exit;
    exception
      when unique_violation then
        -- Could be a duplicate Hacker ID (retry) or the profile already
        -- exists (id conflict) — in the latter case, stop.
        if exists (select 1 from public.profiles where id = new.id) then
          exit;
        end if;
        attempts := attempts + 1;
        if attempts >= 5 then
          raise exception 'Could not generate a unique Hacker ID for %', new.id;
        end if;
    end;
  end loop;
  return new;
end;
$$;


comment on column public.profiles.hhid is
  'Hacker ID in H-1234567 format. Legacy column name retained for API compatibility.';

commit;
