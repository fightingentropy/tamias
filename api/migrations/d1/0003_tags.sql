create table if not exists tags (
  id text primary key,
  team_id text not null,
  name text not null,
  created_at text not null,
  updated_at text not null
);

create unique index if not exists tags_team_name_idx on tags (team_id, name);
create index if not exists tags_team_id_idx on tags (team_id);
create index if not exists tags_updated_at_idx on tags (updated_at);
