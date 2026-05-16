create table if not exists installed_apps (
  id text primary key,
  team_id text,
  created_by text,
  app_id text not null,
  config_json text,
  settings_json text,
  created_at text not null,
  updated_at text not null
);

create table if not exists installed_app_team_snapshots (
  team_id text primary key,
  updated_at text not null
);

create index if not exists installed_apps_team_id_idx on installed_apps (team_id);
create index if not exists installed_apps_app_id_idx on installed_apps (app_id);
create unique index if not exists installed_apps_team_app_id_idx on installed_apps (
  team_id,
  app_id
);
create index if not exists installed_apps_created_by_idx on installed_apps (created_by);
create index if not exists installed_apps_updated_at_idx on installed_apps (updated_at);
