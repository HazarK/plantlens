-- ============================================================
-- PlantLens plant growing context + care profile
-- Phase 10A
-- ============================================================


-- ------------------------------------------------------------
-- GROWING CONTEXT
--
-- These describe THIS plant's environment.
-- They are separate from the species' biological preferences.
-- ------------------------------------------------------------

alter table public.plants
add column location_city text;

alter table public.plants
add column location_country text;

alter table public.plants
add column placement text
check (
  placement in (
    'indoor',
    'balcony',
    'outdoor'
  )
);

alter table public.plants
add column light_exposure text
check (
  light_exposure in (
    'low',
    'indirect',
    'morning_sun',
    'afternoon_sun',
    'full_sun',
    'mixed',
    'unknown'
  )
);


-- ------------------------------------------------------------
-- GENERAL CARE PROFILE
--
-- This is species-level care guidance generated after the
-- species has been confirmed by the human.
-- ------------------------------------------------------------

alter table public.plants
add column care_profile jsonb;

-- Preserve which species the profile was generated for.
--
-- This becomes useful if the plant species is corrected later.
alter table public.plants
add column care_profile_species text;

-- Provenance for evaluation/debugging.
alter table public.plants
add column care_profile_model text;

alter table public.plants
add column care_profile_version text;

alter table public.plants
add column care_profile_generated_at timestamptz;