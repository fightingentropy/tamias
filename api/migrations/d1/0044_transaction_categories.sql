create table if not exists transaction_categories (
  id text primary key,
  team_id text not null,
  name text not null,
  color text,
  slug text not null,
  description text,
  system integer not null default 0,
  tax_rate real,
  tax_type text,
  tax_reporting_code text,
  excluded integer not null default 0,
  parent_id text,
  created_at text not null,
  updated_at text not null
);

create unique index if not exists transaction_categories_team_slug_idx
  on transaction_categories (team_id, slug);
create index if not exists transaction_categories_team_id_idx
  on transaction_categories (team_id);
create index if not exists transaction_categories_team_parent_idx
  on transaction_categories (team_id, parent_id);
create index if not exists transaction_categories_team_system_idx
  on transaction_categories (team_id, system);
