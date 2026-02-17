-- Enable UUID generator (Supabase/Postgres)
create extension if not exists pgcrypto;

-- =======================
-- Tables
-- =======================

create table if not exists public.problems (
    id uuid primary key default gen_random_uuid (),
    title text not null,
    description text not null,
    category text not null,
    location text not null,
    country_code text,
    created_at timestamptz not null default now()
);

create index if not exists idx_problems_category on public.problems (category);

create index if not exists idx_problems_location on public.problems (location);

create index if not exists idx_problems_country on public.problems (country_code);

create table if not exists public.users (
    id uuid primary key default gen_random_uuid (),
    display_name text,
    created_at timestamptz not null default now()
);

-- Link user <-> problem with a role
create table if not exists public.problem_matches (
    id uuid primary key default gen_random_uuid (),
    user_id uuid not null references public.users (id) on delete cascade,
    problem_id uuid not null references public.problems (id) on delete cascade,
    role text not null check (
        role in ('SOLVER', 'AFFECTED')
    ),
    created_at timestamptz not null default now(),
    unique (user_id, problem_id)
);

create index if not exists idx_matches_problem on public.problem_matches (problem_id);

create index if not exists idx_matches_user on public.problem_matches (user_id);

-- =======================
-- Optional: RLS (later)
-- =======================
-- alter table public.problems enable row level security;
-- alter table public.users enable row level security;
-- alter table public.problem_matches enable row level security;