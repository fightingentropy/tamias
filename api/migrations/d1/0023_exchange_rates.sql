create table if not exists exchange_rates (
  base text not null,
  target text not null,
  rate real not null,
  updated_at text not null,
  primary key (base, target)
);

create index if not exists exchange_rates_target_idx on exchange_rates (target);
create index if not exists exchange_rates_updated_at_idx on exchange_rates (updated_at);
