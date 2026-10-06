-- ============================================================
-- PlantLens longitudinal observation support
-- ============================================================

-- The immediately previous observation used as the comparison
-- baseline for this observation.
alter table public.observations
add column previous_observation_id uuid
references public.observations(id)
on delete set null;

-- Structured comparison result.
--
-- For now this stores deterministic comparison information.
-- Later we will extend it with the semantic AI comparison.
alter table public.observations
add column comparison jsonb;

-- Useful when we later change comparison logic.
alter table public.observations
add column comparison_version text;