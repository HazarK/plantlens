-- ============================================================
-- PlantLens core database schema
-- Phase 8 / Version 1
-- ============================================================

-- ------------------------------------------------------------
-- PLANTS: A Plant represents the persistent thing the user owns. It survives across many observations over time.
-- ------------------------------------------------------------

create table public.plants (
  id uuid primary key default gen_random_uuid(),

  -- User-friendly name such as "Living room Monstera".
  nickname text not null,

  -- The species value accepted/confirmed by the human.
  confirmed_species text,

  created_at timestamptz not null default now(),

  -- Avoid empty plant names.
  constraint plants_nickname_not_empty
    check (char_length(btrim(nickname)) > 0)
);

-- ------------------------------------------------------------
-- OBSERVATIONS: An Observation represents one check-in: plant + photograph + AI analysis + optional human review. Relationship between plant x observations: 1 to many
-- ------------------------------------------------------------

create table public.observations (
  id uuid primary key default gen_random_uuid(),

  -- Which plant does this observation belong to?
  plant_id uuid not null
    references public.plants(id)
    on delete cascade,

  -- We store the Storage path, not the image binary itself.
  photo_storage_path text not null,
  created_at timestamptz not null default now(),
  model text not null,
  analysis_version text not null default 'v1',

  -- Complete structured output returned by Groq.
  ai_analysis jsonb not null,

  ai_likely_species text,

  ai_identification_certainty text not null
    check (
      ai_identification_certainty in (
        'low',
        'medium',
        'high'
      )
    ),

  status text not null
    check (
      status in (
        'healthy',
        'watch',
        'needs_attention',
        'uncertain'
      )
    ),

  needs_review boolean not null,

  -- What did the HUMAN do with the AI species prediction?
  human_species_review_decision text not null
    default 'unreviewed'
    check (
      human_species_review_decision in (
        'unreviewed',
        'confirmed',
        'corrected'
      )
    ),

  human_confirmed_species text,

  -- Keep the review fields logically consistent.
  constraint observations_species_review_consistency
    check (
      (
        human_species_review_decision = 'unreviewed'
        and human_confirmed_species is null
      )
      or
      (
        human_species_review_decision in ('confirmed', 'corrected')
        and human_confirmed_species is not null
        and char_length(btrim(human_confirmed_species)) > 0
      )
    )
);


-- ------------------------------------------------------------
-- INDEX
-- for our usage, we need to often query the latest observation for a plant. We will make the query more efficient by indexing 
-- ------------------------------------------------------------

create index observations_plant_created_at_idx
  on public.observations (
    plant_id,
    created_at desc
  );


-- ------------------------------------------------------------
-- SECURITY
--
-- For now PlantLens accesses Supabase only through our
-- Next.js backend using the server-side secret key.
--
-- Browser clients receive no direct table access.
-- ------------------------------------------------------------

alter table public.plants enable row level security;
alter table public.observations enable row level security;


-- Remove direct access for public/browser roles.
revoke all
  on table public.plants
  from anon, authenticated;

revoke all
  on table public.observations
  from anon, authenticated;


-- Our server-side Supabase secret key operates using the service_role Postgres role.
grant select, insert, update, delete
  on table public.plants
  to service_role;

grant select, insert, update, delete
  on table public.observations
  to service_role;