create table if not exists vault_files (
  path text primary key,
  team_id text not null,
  path_tokens_json text not null,
  storage_provider text not null check (storage_provider = 'r2'),
  storage_id text not null,
  bucket text not null default 'vault',
  content_type text,
  size integer,
  uploaded_by text,
  created_at text not null,
  updated_at text not null
);

create index if not exists vault_files_team_id_idx on vault_files (team_id);
create index if not exists vault_files_storage_provider_idx on vault_files (
  storage_provider
);
create index if not exists vault_files_updated_at_idx on vault_files (updated_at);
