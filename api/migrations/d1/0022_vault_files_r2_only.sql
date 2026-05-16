create table if not exists vault_files_r2_only (
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

insert or replace into vault_files_r2_only (
  path,
  team_id,
  path_tokens_json,
  storage_provider,
  storage_id,
  bucket,
  content_type,
  size,
  uploaded_by,
  created_at,
  updated_at
)
select
  path,
  team_id,
  path_tokens_json,
  'r2',
  storage_id,
  bucket,
  content_type,
  size,
  uploaded_by,
  created_at,
  updated_at
from vault_files
where storage_provider = 'r2';

drop table vault_files;
alter table vault_files_r2_only rename to vault_files;

create index if not exists vault_files_team_id_idx on vault_files (team_id);
create index if not exists vault_files_storage_provider_idx on vault_files (
  storage_provider
);
create index if not exists vault_files_updated_at_idx on vault_files (updated_at);
