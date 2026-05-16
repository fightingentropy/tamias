create table if not exists report_links (
  id text primary key,
  link_id text not null unique,
  team_id text not null,
  created_by_user_id text,
  type text not null
    check (
      type in (
        'profit',
        'revenue',
        'burn_rate',
        'expense',
        'monthly_revenue',
        'revenue_forecast',
        'runway',
        'category_expenses'
      )
    ),
  from_date text not null,
  to_date text not null,
  currency text,
  expire_at text,
  created_at text not null,
  updated_at text not null
);

create index if not exists report_links_team_id_idx on report_links (team_id);
create index if not exists report_links_created_by_user_id_idx on report_links (
  created_by_user_id
);
create index if not exists report_links_expire_at_idx on report_links (expire_at);
