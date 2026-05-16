create table if not exists bank_connections (
  id text primary key,
  created_at text not null,
  institution_id text not null,
  expires_at text,
  team_id text not null,
  name text not null,
  logo_url text,
  access_token text,
  provider text not null check (provider in ('truelayer')),
  last_accessed text,
  reference_id text,
  status text check (status in ('connected', 'disconnected', 'unknown')),
  error_details text,
  error_retries integer,
  updated_at text not null
);

create table if not exists bank_connection_team_snapshots (
  team_id text primary key,
  updated_at text not null
);

create index if not exists bank_connections_team_id_idx on bank_connections (team_id);
create index if not exists bank_connections_team_status_idx on bank_connections (team_id, status);
create index if not exists bank_connections_team_institution_idx on bank_connections (
  team_id,
  institution_id
);
create index if not exists bank_connections_reference_id_idx on bank_connections (reference_id);
create index if not exists bank_connections_team_reference_idx on bank_connections (
  team_id,
  reference_id
);
create index if not exists bank_connections_updated_at_idx on bank_connections (updated_at);
