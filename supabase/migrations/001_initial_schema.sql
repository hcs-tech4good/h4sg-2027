-- Profiles (extends Supabase auth.users)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  hhid text unique not null,
  role text not null default 'applicant' check (role in ('applicant', 'reviewer', 'admin')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Applications
create table if not exists applications (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  age int,
  gender text,
  race text[] default '{}',
  underrepresented boolean,
  phone text,
  country text,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  zip text,
  dietary_restrictions text[] default '{}',
  enrolled boolean,
  school text,
  graduation_year int,
  major text,
  level_of_study text,
  harvard_affiliated boolean,
  shirt_size text,
  first_hackathon boolean,
  previously_participated boolean,
  able_to_attend boolean,
  referral_source text,
  team_roles text[] default '{}',
  other_role text,
  programming_languages text[] default '{}',
  other_language text,
  experience text,
  essay_why_hh text,
  essay_project text,
  essay_unlimited_resource text,
  resume_url text,
  resume_name text,
  resume_share boolean,
  code_of_conduct boolean default false,
  data_sharing boolean default false,
  mlh_emails boolean default false,
  submitted boolean default false,
  submitted_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Decisions (staged - not visible to hackers until released)
create table if not exists decisions (
  id uuid primary key references auth.users(id) on delete cascade,
  type text not null check (type in ('accepted', 'waitlisted', 'rejected')),
  released boolean default false,
  decided_by uuid references auth.users(id),
  decided_at timestamptz default now(),
  released_at timestamptz
);

-- Decision Releases (batch release tracking)
create table if not exists decision_releases (
  id uuid primary key default gen_random_uuid(),
  released_by uuid references auth.users(id),
  decision_ids uuid[] not null,
  released_at timestamptz default now(),
  notes text
);

-- Confirmations
create table if not exists confirmations (
  id uuid primary key references auth.users(id) on delete cascade,
  confirmed text not null,
  travel_plans text,
  waiver boolean default false,
  photo_release boolean default false,
  submitted_at timestamptz default now()
);

-- Announcements
create table if not exists announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

-- Invite Tokens (for staff onboarding)
create table if not exists invite_tokens (
  id uuid primary key default gen_random_uuid(),
  role text not null check (role in ('reviewer', 'admin')),
  expires_at timestamptz not null,
  consumable boolean default true,
  consumers uuid[] default '{}',
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

-- Check-ins (event day)
create table if not exists checkins (
  id uuid primary key references auth.users(id) on delete cascade,
  checked_in boolean default false,
  checked_in_at timestamptz,
  checked_in_by uuid references auth.users(id)
);

-- Full-text search index on applications
create index if not exists applications_search_idx on applications
  using gin (to_tsvector('english', coalesce(email, '') || ' ' || coalesce(school, '') || ' ' || coalesce(major, '')));

-- RLS Policies
alter table profiles enable row level security;
alter table applications enable row level security;
alter table decisions enable row level security;
alter table decision_releases enable row level security;
alter table confirmations enable row level security;
alter table announcements enable row level security;
alter table invite_tokens enable row level security;
alter table checkins enable row level security;

-- Profiles: users can read/update their own, staff can read all
create policy "Users can view own profile" on profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on profiles for insert with check (auth.uid() = id);
create policy "Staff can view all profiles" on profiles for select using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'reviewer'))
);

-- Applications: users can manage their own, staff can read all
create policy "Users can view own application" on applications for select using (auth.uid() = id);
create policy "Users can insert own application" on applications for insert with check (auth.uid() = id);
create policy "Users can update own application" on applications for update using (auth.uid() = id);
create policy "Staff can view all applications" on applications for select using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'reviewer'))
);
create policy "Staff can update applications" on applications for update using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'reviewer'))
);

-- Decisions: hackers can only see released decisions for themselves, staff can manage all
create policy "Users can view own released decision" on decisions for select using (
  auth.uid() = id and released = true
);
create policy "Staff can view all decisions" on decisions for select using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'reviewer'))
);
create policy "Staff can insert decisions" on decisions for insert with check (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'reviewer'))
);
create policy "Staff can update decisions" on decisions for update using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'reviewer'))
);
create policy "Staff can delete decisions" on decisions for delete using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'reviewer'))
);

-- Decision Releases: staff only
create policy "Staff can view releases" on decision_releases for select using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'reviewer'))
);
create policy "Staff can insert releases" on decision_releases for insert with check (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'reviewer'))
);

-- Confirmations: users can manage their own, staff can read all
create policy "Users can view own confirmation" on confirmations for select using (auth.uid() = id);
create policy "Users can insert own confirmation" on confirmations for insert with check (auth.uid() = id);
create policy "Users can update own confirmation" on confirmations for update using (auth.uid() = id);
create policy "Staff can view all confirmations" on confirmations for select using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'reviewer'))
);

-- Announcements: everyone can read, admin can create
create policy "Anyone can view announcements" on announcements for select using (true);
create policy "Admin can insert announcements" on announcements for insert with check (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);
create policy "Admin can update announcements" on announcements for update using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);
create policy "Admin can delete announcements" on announcements for delete using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- Invite Tokens: admin only
create policy "Admin can view tokens" on invite_tokens for select using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);
create policy "Admin can insert tokens" on invite_tokens for insert with check (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);
create policy "Admin can delete tokens" on invite_tokens for delete using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);
create policy "Admin can update tokens" on invite_tokens for update using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- Check-ins: staff can manage all
create policy "Staff can view checkins" on checkins for select using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'reviewer'))
);
create policy "Staff can insert checkins" on checkins for insert with check (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'reviewer'))
);
create policy "Staff can update checkins" on checkins for update using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'reviewer'))
);

-- Updated_at trigger function
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at before update on profiles
  for each row execute function update_updated_at();

create trigger applications_updated_at before update on applications
  for each row execute function update_updated_at();

-- RPC: Promote a user by email (admin use)
create or replace function promote_user_by_email(target_email text, new_role text)
returns void as $$
declare
  target_user_id uuid;
begin
  select id into target_user_id
  from auth.users
  where email = target_email
  limit 1;

  if target_user_id is null then
    raise exception 'User not found with email: %', target_email;
  end if;

  update profiles set role = new_role where id = target_user_id;
end;
$$ language plpgsql security definer;

-- Storage bucket for resumes
insert into storage.buckets (id, name, public)
values ('resumes', 'resumes', true)
on conflict (id) do nothing;

-- Storage policy: users can upload their own resume
create policy "Users can upload own resume" on storage.objects
  for insert with check (
    bucket_id = 'resumes' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can update own resume" on storage.objects
  for update using (
    bucket_id = 'resumes' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Anyone can read resumes" on storage.objects
  for select using (bucket_id = 'resumes');
