-- Introduces a top-level "project" a user creates first; providers now live
-- under a project instead of being 3 fixed global rows, so the same slug
-- (e.g. "openai") can exist independently in multiple projects. Projects are
-- per-user (a real departure from every other table's "any authenticated
-- user is an admin" policy) — ownership flows from projects.user_id through
-- providers.project_id to every table that hangs off a provider.

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_updated_at on projects;
create trigger set_updated_at before update on projects for each row execute function set_updated_at();

alter table providers add column if not exists project_id uuid references projects (id) on delete cascade;

-- Backfill: one "Default" project owned by the earliest user, re-parenting
-- any pre-existing (pre-project) provider rows so already-tested data isn't
-- lost. Guarded so this migration is safe to re-run.
insert into projects (name, user_id)
select 'Default', id from auth.users
where not exists (select 1 from projects)
order by created_at asc
limit 1;

update providers set project_id = (select id from projects order by created_at asc limit 1)
where project_id is null;

alter table providers alter column project_id set not null;
alter table providers drop constraint if exists providers_slug_key;
alter table providers add constraint providers_project_slug_key unique (project_id, slug);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table projects enable row level security;

create policy "owner reads own projects" on projects
  for select using (auth.uid() = user_id);
create policy "owner writes own projects" on projects
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "authenticated read providers" on providers;
drop policy if exists "authenticated write providers" on providers;
create policy "owner reads own providers" on providers
  for select using (
    exists (select 1 from projects p where p.id = providers.project_id and p.user_id = auth.uid())
  );
create policy "owner writes own providers" on providers
  for all using (
    exists (select 1 from projects p where p.id = providers.project_id and p.user_id = auth.uid())
  ) with check (
    exists (select 1 from projects p where p.id = providers.project_id and p.user_id = auth.uid())
  );

drop policy if exists "authenticated read models" on models;
drop policy if exists "authenticated write models" on models;
create policy "owner reads own models" on models
  for select using (
    exists (
      select 1 from providers pr join projects p on p.id = pr.project_id
      where pr.id = models.provider_id and p.user_id = auth.uid()
    )
  );
create policy "owner writes own models" on models
  for all using (
    exists (
      select 1 from providers pr join projects p on p.id = pr.project_id
      where pr.id = models.provider_id and p.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from providers pr join projects p on p.id = pr.project_id
      where pr.id = models.provider_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "authenticated read usage_records" on usage_records;
create policy "owner reads own usage_records" on usage_records
  for select using (
    exists (
      select 1 from providers pr join projects p on p.id = pr.project_id
      where pr.id = usage_records.provider_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "authenticated read usage_limits" on usage_limits;
drop policy if exists "authenticated write usage_limits" on usage_limits;
create policy "owner reads own usage_limits" on usage_limits
  for select using (
    exists (
      select 1 from providers pr join projects p on p.id = pr.project_id
      where pr.id = usage_limits.provider_id and p.user_id = auth.uid()
    )
  );
create policy "owner writes own usage_limits" on usage_limits
  for all using (
    exists (
      select 1 from providers pr join projects p on p.id = pr.project_id
      where pr.id = usage_limits.provider_id and p.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from providers pr join projects p on p.id = pr.project_id
      where pr.id = usage_limits.provider_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "authenticated read rate_limits" on rate_limits;
create policy "owner reads own rate_limits" on rate_limits
  for select using (
    exists (
      select 1 from providers pr join projects p on p.id = pr.project_id
      where pr.id = rate_limits.provider_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "authenticated read api_errors" on api_errors;
create policy "owner reads own api_errors" on api_errors
  for select using (
    exists (
      select 1 from providers pr join projects p on p.id = pr.project_id
      where pr.id = api_errors.provider_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "authenticated read alerts" on alerts;
create policy "owner reads own alerts" on alerts
  for select using (
    exists (
      select 1 from providers pr join projects p on p.id = pr.project_id
      where pr.id = alerts.provider_id and p.user_id = auth.uid()
    )
  );

-- provider_credentials keeps its existing "no policy — service role only" —
-- untouched, still never reachable from the anon/authenticated Postgres role.
