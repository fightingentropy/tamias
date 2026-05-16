create table if not exists bank_accounts (
  id text primary key,
  created_at text not null,
  created_by text,
  team_id text not null,
  name text,
  currency text,
  bank_connection_id text,
  enabled integer not null check (enabled in (0, 1)),
  account_id text not null,
  balance real,
  manual integer not null check (manual in (0, 1)),
  type text check (type in ('depository', 'credit', 'other_asset', 'loan', 'other_liability')),
  base_currency text,
  base_balance real,
  error_details text,
  error_retries integer,
  account_reference text,
  iban text,
  subtype text,
  bic text,
  routing_number text,
  wire_routing_number text,
  account_number text,
  sort_code text,
  available_balance real,
  credit_limit real,
  bank_connection_json text,
  updated_at text not null
);

create index if not exists bank_accounts_team_id_idx on bank_accounts (team_id);
create index if not exists bank_accounts_team_enabled_idx on bank_accounts (team_id, enabled);
create index if not exists bank_accounts_team_manual_idx on bank_accounts (team_id, manual);
create index if not exists bank_accounts_team_account_id_idx on bank_accounts (team_id, account_id);
create index if not exists bank_accounts_bank_connection_idx on bank_accounts (bank_connection_id);
create index if not exists bank_accounts_team_bank_connection_idx on bank_accounts (
  team_id,
  bank_connection_id
);
create index if not exists bank_accounts_updated_at_idx on bank_accounts (updated_at);
