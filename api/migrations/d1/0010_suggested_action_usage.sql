create table if not exists suggested_action_usage (
  user_id text not null,
  team_id text not null,
  action_id text not null,
  count integer not null check (count >= 0),
  last_used_at text not null,
  created_at text not null,
  updated_at text not null,
  primary key (user_id, team_id, action_id)
);

create table if not exists suggested_action_usage_user_snapshots (
  user_id text not null,
  team_id text not null,
  updated_at text not null,
  primary key (user_id, team_id)
);

create index if not exists suggested_action_usage_user_team_idx on suggested_action_usage (
  user_id,
  team_id
);
create index if not exists suggested_action_usage_team_idx on suggested_action_usage (team_id);
create index if not exists suggested_action_usage_last_used_idx on suggested_action_usage (
  last_used_at
);
