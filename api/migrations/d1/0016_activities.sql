create table if not exists activities (
  id text primary key,
  team_id text not null,
  user_id text,
  type text not null,
  priority integer,
  group_id text,
  source text not null check (source in ('system', 'user')),
  metadata_json text not null,
  status text not null check (status in ('unread', 'read', 'archived')),
  created_at text not null,
  updated_at text not null,
  last_used_at text
);

create index if not exists activities_team_id_idx on activities (team_id);
create index if not exists activities_user_id_idx on activities (user_id);
create index if not exists activities_status_idx on activities (status);
create index if not exists activities_priority_idx on activities (priority);
create index if not exists activities_type_idx on activities (type);
create index if not exists activities_group_id_idx on activities (group_id);
create index if not exists activities_team_status_created_idx on activities (
  team_id,
  status,
  created_at desc
);
create index if not exists activities_team_user_created_idx on activities (
  team_id,
  user_id,
  created_at desc
);
create index if not exists activities_updated_at_idx on activities (updated_at);
