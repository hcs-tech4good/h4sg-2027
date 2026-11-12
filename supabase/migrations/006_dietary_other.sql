-- =============================================================
-- Migration 006: Free-form "other allergies / dietary" text
-- =============================================================

alter table applications
  add column if not exists dietary_other text;
