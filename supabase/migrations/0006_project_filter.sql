-- Adds project/provider filtering to the three usage aggregation functions,
-- for the Overview/Usage/Models/Limits/Errors project+provider dropdowns.
-- This is a UX narrowing filter layered on top of RLS, not a security
-- boundary: RLS on usage_records already guarantees a caller only ever sees
-- rows belonging to their own projects, regardless of these params — they
-- just let a user scope *which of their own projects* a page reflects.
--
-- Each function's parameter list is changing (an extra p_project_id is
-- inserted before p_provider_id), and Postgres identifies a function by name
-- *and* parameter types — `create or replace` with a different signature
-- creates a new overload rather than replacing the old one, so the old
-- signatures are dropped explicitly first to avoid leaving both behind.
drop function if exists usage_summary_by_provider(timestamptz, timestamptz);
drop function if exists usage_timeline(timestamptz, timestamptz, uuid);
drop function if exists usage_by_model(timestamptz, timestamptz);

create or replace function usage_summary_by_provider(
  p_start timestamptz,
  p_end timestamptz,
  p_project_id uuid default null,
  p_provider_id uuid default null
)
returns table (
  provider_id uuid,
  input_tokens bigint,
  output_tokens bigint,
  cached_tokens bigint,
  total_tokens bigint,
  credits_used numeric,
  estimated_cost numeric,
  request_count bigint
)
language sql
stable
as $$
  select
    ur.provider_id,
    coalesce(sum(ur.input_tokens), 0) as input_tokens,
    coalesce(sum(ur.output_tokens), 0) as output_tokens,
    coalesce(sum(ur.cached_tokens), 0) as cached_tokens,
    coalesce(sum(ur.total_tokens), 0) as total_tokens,
    coalesce(sum(ur.credits_used), 0) as credits_used,
    sum(ur.estimated_cost) as estimated_cost,
    count(*) as request_count
  from usage_records ur
  join providers p on p.id = ur.provider_id
  where ur.created_at >= p_start and ur.created_at < p_end
    and (p_project_id is null or p.project_id = p_project_id)
    and (p_provider_id is null or ur.provider_id = p_provider_id)
  group by ur.provider_id;
$$;

create or replace function usage_timeline(
  p_start timestamptz,
  p_end timestamptz,
  p_project_id uuid default null,
  p_provider_id uuid default null
)
returns table (
  bucket date,
  provider_id uuid,
  input_tokens bigint,
  output_tokens bigint,
  total_tokens bigint,
  estimated_cost numeric,
  request_count bigint
)
language sql
stable
as $$
  select
    date_trunc('day', ur.created_at)::date as bucket,
    ur.provider_id,
    coalesce(sum(ur.input_tokens), 0) as input_tokens,
    coalesce(sum(ur.output_tokens), 0) as output_tokens,
    coalesce(sum(ur.total_tokens), 0) as total_tokens,
    sum(ur.estimated_cost) as estimated_cost,
    count(*) as request_count
  from usage_records ur
  join providers p on p.id = ur.provider_id
  where ur.created_at >= p_start
    and ur.created_at < p_end
    and (p_project_id is null or p.project_id = p_project_id)
    and (p_provider_id is null or ur.provider_id = p_provider_id)
  group by 1, 2
  order by 1;
$$;

create or replace function usage_by_model(
  p_start timestamptz,
  p_end timestamptz,
  p_project_id uuid default null,
  p_provider_id uuid default null
)
returns table (
  provider_id uuid,
  model_id uuid,
  input_tokens bigint,
  output_tokens bigint,
  total_tokens bigint,
  estimated_cost numeric,
  request_count bigint
)
language sql
stable
as $$
  select
    ur.provider_id,
    ur.model_id,
    coalesce(sum(ur.input_tokens), 0) as input_tokens,
    coalesce(sum(ur.output_tokens), 0) as output_tokens,
    coalesce(sum(ur.total_tokens), 0) as total_tokens,
    sum(ur.estimated_cost) as estimated_cost,
    count(*) as request_count
  from usage_records ur
  join providers p on p.id = ur.provider_id
  where ur.created_at >= p_start and ur.created_at < p_end
    and (p_project_id is null or p.project_id = p_project_id)
    and (p_provider_id is null or ur.provider_id = p_provider_id)
  group by 1, 2;
$$;
