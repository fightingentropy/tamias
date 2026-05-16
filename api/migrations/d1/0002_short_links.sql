create table if not exists short_links (
  id text primary key,
  short_id text not null,
  url text not null,
  team_id text,
  user_id text,
  team_name text,
  type text check (type in ('redirect', 'download')),
  size integer,
  mime_type text,
  file_name text,
  expires_at text,
  created_at text not null,
  updated_at text not null
);

create unique index if not exists short_links_short_id_idx on short_links (short_id);
create index if not exists short_links_team_id_idx on short_links (team_id);
create index if not exists short_links_user_id_idx on short_links (user_id);
create index if not exists short_links_expires_at_idx on short_links (expires_at);
