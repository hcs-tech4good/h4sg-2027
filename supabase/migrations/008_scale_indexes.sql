-- =============================================================
-- Migration 008: Indexes for scale (thousands of applications)
--   - Fast "submitted applications, newest first" listing + counts
--   - Fast decision/checkin dashboard counts
--   - Trigram indexes so admin search (ILIKE) is index-backed
-- =============================================================

-- Submitted applications listing / counts
create index if not exists applications_submitted_idx
  on applications (submitted);
create index if not exists applications_submitted_at_idx
  on applications (submitted_at desc);

-- Dashboard aggregate counts
create index if not exists decisions_type_idx on decisions (type);
create index if not exists decisions_released_idx on decisions (released);
create index if not exists checkins_checked_in_idx on checkins (checked_in);
create index if not exists profiles_role_idx on profiles (role);

-- Trigram indexes for admin ILIKE search (email / school / major)
create extension if not exists pg_trgm;
create index if not exists applications_email_trgm_idx
  on applications using gin (email gin_trgm_ops);
create index if not exists applications_school_trgm_idx
  on applications using gin (school gin_trgm_ops);
create index if not exists applications_major_trgm_idx
  on applications using gin (major gin_trgm_ops);
