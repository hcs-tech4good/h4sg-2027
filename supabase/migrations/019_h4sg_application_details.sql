-- Additional H4SG application questions. Existing answers and submissions are
-- preserved. This column inherits the applications table's RLS policies.
alter table public.applications
  add column if not exists h4sg_details jsonb not null default '{}'::jsonb
  check (jsonb_typeof(h4sg_details) = 'object');

-- Match the reference form's 10 MB limit while keeping resumes private/PDF.
update storage.buckets
set file_size_limit = 10485760
where id = 'resumes';

comment on column public.profiles.hhid is
  'Hacker ID. Legacy column name and HH- prefix retained for compatibility.';
