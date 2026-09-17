-- AI API Usage Monitoring Dashboard — initial schema
-- Every table is designed so that adding a new provider (Tavily, xAI, DeepSeek, Mistral, ...)
-- never requires a migration: provider_kind and key_type are plain text (not enums), and
-- usage_records already carries the nullable columns a credit-based / non-token provider needs.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  role text not null default 'admin',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-create a profile row whenever a new auth user signs up.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------------
-- providers
-- ---------------------------------------------------------------------------
create table if not exists providers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  provider_kind text not null default 'llm', -- 'llm' | 'search' | ... (extensible, not an enum)
  enabled boolean not null default true,
  status text not null default 'disconnected', -- 'connected' | 'disconnected' | 'error'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- provider_credentials
-- ---------------------------------------------------------------------------
create table if not exists provider_credentials (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references providers (id) on delete cascade,
  key_type text not null default 'standard', -- 'standard' | 'admin' | 'management' ... convention documented per provider
  name text not null default 'default',
  encrypted_api_key text not null, -- AES-256-GCM ciphertext, app-encrypted (never pgcrypto)
  status text not null default 'untested', -- 'untested' | 'valid' | 'invalid'
  last_tested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider_id, key_type, name)
);

-- ---------------------------------------------------------------------------
-- models
-- ---------------------------------------------------------------------------
create table if not exists models (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references providers (id) on delete cascade,
  model_name text not null,
  display_name text not null,
  input_price_per_million numeric,
  output_price_per_million numeric,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider_id, model_name)
);

-- ---------------------------------------------------------------------------
-- usage_records
-- ---------------------------------------------------------------------------
create table if not exists usage_records (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references providers (id) on delete cascade,
  model_id uuid references models (id) on delete set null, -- nullable: search-kind providers have no model
  source text not null default 'provider_polled', -- 'provider_polled' | 'self_logged'
  request_id text,
  input_tokens bigint,
  output_tokens bigint,
  cached_tokens bigint,
  reasoning_tokens bigint,
  total_tokens bigint,
  credits_used numeric, -- for credit-based providers (e.g. Tavily) — null for token-based providers
  estimated_cost numeric,
  metadata jsonb, -- provider-specific breakdowns (e.g. Tavily per-endpoint credit split)
  status text not null default 'success', -- 'success' | 'error'
  error_code text,
  response_time_ms integer,
  created_at timestamptz not null default now()
);

create index if not exists usage_records_provider_created_idx on usage_records (provider_id, created_at desc);
create index if not exists usage_records_model_idx on usage_records (model_id);
create index if not exists usage_records_created_idx on usage_records (created_at desc);

-- ---------------------------------------------------------------------------
-- usage_limits (admin-configured application limits)
-- ---------------------------------------------------------------------------
create table if not exists usage_limits (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references providers (id) on delete cascade,
  model_id uuid references models (id) on delete cascade,
  limit_type text not null, -- 'monthly_tokens' | 'daily_tokens' | 'monthly_spend' | 'requests'
  limit_value numeric not null,
  period text not null default 'monthly', -- 'daily' | 'monthly'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- rate_limits (provider-reported, never fabricated)
-- ---------------------------------------------------------------------------
create table if not exists rate_limits (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references providers (id) on delete cascade,
  model_id uuid references models (id) on delete cascade,
  limit_type text not null, -- 'rpm' | 'tpm' | 'rpd' ...
  current_usage numeric,
  limit_value numeric,
  reset_at timestamptz,
  source text not null default 'provider_reported', -- 'provider_reported' | 'response_headers'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- api_errors
-- ---------------------------------------------------------------------------
create table if not exists api_errors (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references providers (id) on delete cascade,
  model_id uuid references models (id) on delete set null,
  request_id text,
  status_code integer,
  error_code text,
  message text,
  created_at timestamptz not null default now()
);

create index if not exists api_errors_provider_created_idx on api_errors (provider_id, created_at desc);

-- ---------------------------------------------------------------------------
-- alerts (de-duplication for threshold-crossing notifications)
-- ---------------------------------------------------------------------------
create table if not exists alerts (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references providers (id) on delete cascade,
  limit_type text not null, -- 'usage_limit' | 'balance'
  threshold_pct integer not null, -- 50 | 75 | 90 | 100
  period_key text not null, -- e.g. '2026-09' for a monthly cap, or a date for daily
  triggered_at timestamptz not null default now(),
  channel text not null default 'dashboard', -- 'dashboard' | 'slack'
  delivered boolean not null default false,
  created_at timestamptz not null default now(),
  unique (provider_id, limit_type, threshold_pct, period_key)
);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_updated_at on profiles;
create trigger set_updated_at before update on profiles for each row execute function set_updated_at();

drop trigger if exists set_updated_at on providers;
create trigger set_updated_at before update on providers for each row execute function set_updated_at();

drop trigger if exists set_updated_at on provider_credentials;
create trigger set_updated_at before update on provider_credentials for each row execute function set_updated_at();

drop trigger if exists set_updated_at on models;
create trigger set_updated_at before update on models for each row execute function set_updated_at();

drop trigger if exists set_updated_at on usage_limits;
create trigger set_updated_at before update on usage_limits for each row execute function set_updated_at();

drop trigger if exists set_updated_at on rate_limits;
create trigger set_updated_at before update on rate_limits for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS — v1 policy: any authenticated user is treated as an admin.
-- provider_credentials.encrypted_api_key is still only ever read by server-side
-- code using the service-role client; the anon/client Supabase client is never
-- given a policy that lets it select provider_credentials at all.
-- ---------------------------------------------------------------------------
alter table profiles enable row level security;
alter table providers enable row level security;
alter table provider_credentials enable row level security;
alter table models enable row level security;
alter table usage_records enable row level security;
alter table usage_limits enable row level security;
alter table rate_limits enable row level security;
alter table api_errors enable row level security;
alter table alerts enable row level security;

create policy "authenticated read own profile" on profiles
  for select using (auth.uid() = id);
create policy "authenticated update own profile" on profiles
  for update using (auth.uid() = id);

create policy "authenticated read providers" on providers
  for select using (auth.uid() is not null);
create policy "authenticated write providers" on providers
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- No policy is created for provider_credentials for the authenticated/anon role:
-- it is intentionally only reachable via the service-role client on the server.

create policy "authenticated read models" on models
  for select using (auth.uid() is not null);
create policy "authenticated write models" on models
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "authenticated read usage_records" on usage_records
  for select using (auth.uid() is not null);

create policy "authenticated read usage_limits" on usage_limits
  for select using (auth.uid() is not null);
create policy "authenticated write usage_limits" on usage_limits
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "authenticated read rate_limits" on rate_limits
  for select using (auth.uid() is not null);

create policy "authenticated read api_errors" on api_errors
  for select using (auth.uid() is not null);

create policy "authenticated read alerts" on alerts
  for select using (auth.uid() is not null);
