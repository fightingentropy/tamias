create table if not exists invoice_templates (
  id text primary key,
  team_id text not null,
  name text not null,
  is_default integer not null default 0 check (is_default in (0, 1)),
  data_json text not null default '{}',
  created_at text not null,
  updated_at text not null
);

create unique index if not exists invoice_templates_team_default_idx
  on invoice_templates (team_id)
  where is_default = 1;

create index if not exists invoice_templates_team_id_idx on invoice_templates (team_id);
create index if not exists invoice_templates_team_name_idx on invoice_templates (team_id, name);
create index if not exists invoice_templates_team_created_idx on invoice_templates (
  team_id,
  created_at
);
