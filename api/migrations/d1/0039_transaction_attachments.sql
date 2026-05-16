create table if not exists transaction_attachments (
  id text primary key,
  team_id text not null,
  transaction_id text,
  type text not null,
  name text not null,
  size integer not null,
  path_json text not null,
  path_key text not null,
  created_at text not null,
  updated_at text not null
);

create index if not exists transaction_attachments_team_id_idx
  on transaction_attachments (team_id);
create index if not exists transaction_attachments_team_transaction_idx
  on transaction_attachments (team_id, transaction_id);
create index if not exists transaction_attachments_team_path_key_idx
  on transaction_attachments (team_id, path_key);
create index if not exists transaction_attachments_created_at_idx
  on transaction_attachments (created_at);
