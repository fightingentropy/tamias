create table if not exists notification_settings (
  id text primary key,
  user_id text not null,
  team_id text not null,
  notification_type text not null,
  channel text not null check (channel in ('in_app', 'email', 'push')),
  enabled integer not null check (enabled in (0, 1)),
  created_at text not null,
  updated_at text not null
);

create table if not exists notification_setting_user_snapshots (
  user_id text not null,
  team_id text not null,
  updated_at text not null,
  primary key (user_id, team_id)
);

create index if not exists notification_settings_user_team_idx on notification_settings (
  user_id,
  team_id
);
create unique index if not exists notification_settings_user_team_type_channel_idx
  on notification_settings (user_id, team_id, notification_type, channel);
create index if not exists notification_settings_type_channel_idx on notification_settings (
  notification_type,
  channel
);
create index if not exists notification_settings_updated_at_idx on notification_settings (
  updated_at
);
