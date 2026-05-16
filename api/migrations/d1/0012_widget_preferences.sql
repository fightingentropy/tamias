create table if not exists widget_preferences (
  user_id text not null,
  team_id text not null,
  primary_widgets_json text not null,
  available_widgets_json text not null,
  created_at text not null,
  updated_at text not null,
  primary key (user_id, team_id)
);

create index if not exists widget_preferences_team_id_idx on widget_preferences (team_id);
create index if not exists widget_preferences_user_id_idx on widget_preferences (user_id);
create index if not exists widget_preferences_updated_at_idx on widget_preferences (updated_at);
