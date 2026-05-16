create table if not exists inbox_blocklist (
  id text primary key,
  team_id text not null,
  type text not null check (type in ('email', 'domain')),
  value text not null,
  normalized_value text not null,
  created_at text not null,
  updated_at text not null
);

create table if not exists inbox_blocklist_team_snapshots (
  team_id text primary key,
  updated_at text not null
);

create index if not exists inbox_blocklist_team_id_idx on inbox_blocklist (team_id);
create unique index if not exists inbox_blocklist_team_type_value_idx on inbox_blocklist (
  team_id,
  type,
  normalized_value
);
create index if not exists inbox_blocklist_updated_at_idx on inbox_blocklist (updated_at);
