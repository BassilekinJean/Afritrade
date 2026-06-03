-- ===========================================================================
--  DataPipe / Afritrade — Schéma Supabase (Postgres)
-- ===========================================================================
--  À exécuter dans Supabase : Dashboard > SQL Editor > New query > Run.
--  Script IDEMPOTENT : il peut être relancé sans danger.
--
--  Architecture :
--    - Les COMPTES sont gérés par Supabase Auth (table `auth.users`).
--    - La table `public.projects` stocke les projets ETL, reliés à `auth.users`.
--    - Le backend accède aux données via l'API Data (PostgREST) avec la clé
--      `service_role` (qui contourne la RLS). Les policies ci-dessous ajoutent
--      une isolation par utilisateur en défense en profondeur (utile si le
--      front interroge un jour Supabase directement avec la clé publique).
-- ===========================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
--  Migration : on repart d'une table `projects` reliée à `auth.users`.
--  (Une version antérieure reliait `projects` à une table `public.users` ;
--   on la remplace. Sans perte de données utiles : tables vides au moment du
--   passage à Supabase Auth.)
-- ---------------------------------------------------------------------------
drop table if exists public.projects cascade;
drop table if exists public.users cascade;  -- ancienne table de comptes, inutile (Supabase Auth)

-- ---------------------------------------------------------------------------
--  Table : projects
-- ---------------------------------------------------------------------------
create table public.projects (
    id         uuid        primary key default gen_random_uuid(),
    user_id    uuid        not null references auth.users (id) on delete cascade,
    title      text        not null,
    graph      jsonb       not null default '{"nodes": [], "edges": []}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists ix_projects_user_id on public.projects (user_id);

-- ---------------------------------------------------------------------------
--  Trigger : maintien automatique de updated_at
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists trg_projects_updated_at on public.projects;
create trigger trg_projects_updated_at
    before update on public.projects
    for each row
    execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
--  Accès : le backend utilise la clé service_role (accès complet, ignore RLS)
-- ---------------------------------------------------------------------------
grant all on public.projects to service_role;

-- ---------------------------------------------------------------------------
--  Row Level Security : chaque utilisateur n'accède qu'à SES projets.
--  (service_role contourne ces règles ; elles protègent un accès direct
--   éventuel depuis le front avec la clé publique `authenticated`.)
-- ---------------------------------------------------------------------------
alter table public.projects enable row level security;

drop policy if exists "projects_select_own" on public.projects;
create policy "projects_select_own" on public.projects
    for select to authenticated
    using ((select auth.uid()) = user_id);

drop policy if exists "projects_insert_own" on public.projects;
create policy "projects_insert_own" on public.projects
    for insert to authenticated
    with check ((select auth.uid()) = user_id);

drop policy if exists "projects_update_own" on public.projects;
create policy "projects_update_own" on public.projects
    for update to authenticated
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);

drop policy if exists "projects_delete_own" on public.projects;
create policy "projects_delete_own" on public.projects
    for delete to authenticated
    using ((select auth.uid()) = user_id);

-- ===========================================================================
--  Stockage des fichiers sources (Supabase Storage)
-- ===========================================================================
--  Le bucket « projets » est créé automatiquement par le backend au démarrage
--  (clé service_role). Uploads/downloads se font côté serveur avec la clé
--  service_role (qui contourne la RLS de storage.objects). Bucket PRIVÉ.
-- ===========================================================================
