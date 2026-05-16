create table if not exists accounting_sync_records (
  id text primary key,
  transaction_id text not null,
  team_id text not null,
  provider text not null check (provider in ('quickbooks', 'fortnox')),
  provider_tenant_id text not null,
  provider_transaction_id text,
  synced_attachment_mapping_json text not null default '{}',
  synced_at text not null,
  sync_type text check (sync_type in ('manual')),
  status text not null check (status in ('synced', 'partial', 'failed', 'pending')),
  error_message text,
  error_code text,
  provider_entity_type text,
  created_at text not null
);

create unique index if not exists accounting_sync_records_team_provider_transaction_idx
  on accounting_sync_records (team_id, provider, transaction_id);
create index if not exists accounting_sync_records_team_id_idx
  on accounting_sync_records (team_id);
create index if not exists accounting_sync_records_team_transaction_idx
  on accounting_sync_records (team_id, transaction_id);
create index if not exists accounting_sync_records_team_provider_status_idx
  on accounting_sync_records (team_id, provider, status);
create index if not exists accounting_sync_records_synced_at_idx
  on accounting_sync_records (synced_at);
