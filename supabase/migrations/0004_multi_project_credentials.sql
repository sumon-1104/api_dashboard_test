-- provider_credentials already supports multiple named credentials per
-- provider (unique on provider_id, key_type, name) — this migration just
-- lets usage/rate-limit rows say *which* credential produced them, so
-- polling one project's key doesn't clobber another project's same-day rows
-- during the poller's idempotent replace step. Nullable + on delete set
-- null: removing a credential should never delete historical usage.

alter table usage_records add column if not exists credential_id uuid references provider_credentials (id) on delete set null;
alter table rate_limits add column if not exists credential_id uuid references provider_credentials (id) on delete set null;

create index if not exists usage_records_credential_created_idx on usage_records (credential_id, created_at desc);
