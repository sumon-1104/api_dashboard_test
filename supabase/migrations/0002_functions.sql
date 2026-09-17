-- Aggregation happens in Postgres, not the browser. SECURITY INVOKER (the
-- default) so these still run under the caller's RLS policies.

create or replace function usage_summary_by_provider(p_start timestamptz, p_end timestamptz)
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
    coalesce(sum(ur.estimated_cost), 0) as estimated_cost,
    count(*) as request_count
  from usage_records ur
  where ur.created_at >= p_start and ur.created_at < p_end
  group by ur.provider_id;
$$;

create or replace function usage_timeline(p_start timestamptz, p_end timestamptz, p_provider_id uuid default null)
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
    coalesce(sum(ur.estimated_cost), 0) as estimated_cost,
    count(*) as request_count
  from usage_records ur
  where ur.created_at >= p_start
    and ur.created_at < p_end
    and (p_provider_id is null or ur.provider_id = p_provider_id)
  group by 1, 2
  order by 1;
$$;

create or replace function usage_by_model(p_start timestamptz, p_end timestamptz)
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
    coalesce(sum(ur.estimated_cost), 0) as estimated_cost,
    count(*) as request_count
  from usage_records ur
  where ur.created_at >= p_start and ur.created_at < p_end
  group by 1, 2;
$$;
