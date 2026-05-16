create table if not exists institutions (
  institution_id text primary key,
  name text not null,
  normalized_name text not null,
  logo text,
  provider text not null check (provider in ('truelayer')),
  countries_json text not null default '[]',
  available_history integer,
  maximum_consent_validity integer,
  popularity integer not null,
  type text,
  status text not null check (status in ('active', 'removed')),
  created_at text not null,
  updated_at text not null
);

create index if not exists institutions_status_idx on institutions (status);
create index if not exists institutions_provider_status_idx on institutions (provider, status);
create index if not exists institutions_normalized_name_idx on institutions (normalized_name);
