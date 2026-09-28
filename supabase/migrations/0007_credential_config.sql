-- Non-secret per-credential config a provider's key alone doesn't carry —
-- e.g. xAI's Management API requires a team_id copied manually from the
-- console (no endpoint exists to discover it from the key itself). Nullable
-- and unused by every other provider today; never stores secrets — those
-- stay exclusively in encrypted_api_key.
alter table provider_credentials add column if not exists config jsonb;
