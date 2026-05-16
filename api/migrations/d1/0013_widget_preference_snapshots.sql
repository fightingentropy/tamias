create table if not exists widget_preference_user_snapshots (
  user_id text not null,
  team_id text not null,
  updated_at text not null,
  primary key (user_id, team_id)
);
