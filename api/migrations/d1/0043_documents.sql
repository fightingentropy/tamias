create table if not exists documents (
  id text primary key,
  team_id text not null,
  name text not null,
  created_at text not null,
  updated_at text not null,
  metadata_json text,
  path_tokens_json text not null,
  parent_id text,
  object_id text,
  owner_id text,
  tag text,
  title text,
  body text,
  summary text,
  content text,
  date text,
  language text,
  processing_status text not null check (
    processing_status in ('pending', 'processing', 'completed', 'failed')
  ),
  search_text text
);

create unique index if not exists documents_team_name_idx on documents (team_id, name);
create index if not exists documents_team_created_at_idx
  on documents (team_id, created_at, id);
create index if not exists documents_team_date_idx on documents (team_id, date);
create index if not exists documents_updated_at_idx on documents (updated_at);
