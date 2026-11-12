-- =============================================================
-- Migration 003: Application form parity with the legacy portal
--  - underrepresented: boolean -> text ('Yes' | 'No' | 'Unsure')
--  - add address_country (shipping country, separate from country of residence)
-- =============================================================

alter table applications
  alter column underrepresented type text
  using (
    case
      when underrepresented is true then 'Yes'
      when underrepresented is false then 'No'
      else null
    end
  );

alter table applications
  add column if not exists address_country text;
