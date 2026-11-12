-- =============================================================
-- Migration 004: Open response additions
--  - financial_aid: opt-in for the separate financial accommodations
--    application (transportation help; no overnight accommodations in 2026)
--  - financial_aid_detail: applicant's explanation of their situation
--  - essay_space: "If you were to go to space..." prompt
-- =============================================================

alter table applications
  add column if not exists financial_aid boolean default false,
  add column if not exists financial_aid_detail text,
  add column if not exists essay_space text;
