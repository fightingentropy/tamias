create table if not exists inbox_accounts (
  id text primary key,
  team_id text not null,
  email text not null,
  access_token text,
  refresh_token text,
  provider text not null check (provider in ('gmail', 'outlook')),
  external_id text,
  expiry_date text,
  last_accessed text not null,
  schedule_id text,
  status text check (status is null or status in ('connected', 'disconnected')),
  error_message text,
  created_at text not null,
  updated_at text not null
);

create table if not exists inbox_account_team_snapshots (
  team_id text primary key,
  updated_at text not null
);

create index if not exists inbox_accounts_team_id_idx on inbox_accounts (team_id);
create index if not exists inbox_accounts_email_idx on inbox_accounts (email);
create unique index if not exists inbox_accounts_external_id_idx on inbox_accounts (external_id);
create index if not exists inbox_accounts_updated_at_idx on inbox_accounts (updated_at);
