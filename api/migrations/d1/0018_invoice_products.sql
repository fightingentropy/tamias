create table if not exists invoice_products (
  id text primary key,
  team_id text not null,
  created_by_user_id text,
  name text not null,
  name_key text not null,
  normalized_name text not null,
  description text,
  price real,
  price_key text not null,
  currency text,
  currency_key text not null,
  unit text,
  tax_rate real,
  is_active integer not null default 1 check (is_active in (0, 1)),
  usage_count integer not null default 0 check (usage_count >= 0),
  last_used_at text,
  created_at text not null,
  updated_at text
);

create unique index if not exists invoice_products_team_name_currency_price_idx
  on invoice_products (team_id, name_key, currency_key, price_key);

create index if not exists invoice_products_team_id_idx on invoice_products (team_id);
create index if not exists invoice_products_team_active_idx on invoice_products (
  team_id,
  is_active
);
create index if not exists invoice_products_team_usage_idx on invoice_products (
  team_id,
  usage_count desc,
  last_used_at desc
);
create index if not exists invoice_products_team_recent_idx on invoice_products (
  team_id,
  last_used_at desc,
  usage_count desc
);
