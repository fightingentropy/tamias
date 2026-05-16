create table if not exists invoice_recurring_series (
  id text primary key,
  team_id text not null,
  user_id text not null,
  customer_id text,
  customer_name text,
  frequency text not null check (
    frequency in (
      'weekly',
      'biweekly',
      'monthly_date',
      'monthly_weekday',
      'monthly_last_day',
      'quarterly',
      'semi_annual',
      'annual',
      'custom'
    )
  ),
  frequency_day integer,
  frequency_week integer,
  frequency_interval integer,
  end_type text not null check (end_type in ('never', 'on_date', 'after_count')),
  end_date text,
  end_count integer,
  status text not null check (status in ('active', 'paused', 'completed', 'canceled')),
  invoices_generated integer not null default 0 check (invoices_generated >= 0),
  consecutive_failures integer not null default 0 check (consecutive_failures >= 0),
  next_scheduled_at text,
  last_generated_at text,
  upcoming_notification_sent_at text,
  timezone text not null,
  due_date_offset integer not null default 30,
  amount real,
  currency text,
  line_items_json text not null default 'null',
  template_json text not null default 'null',
  payment_details_json text not null default 'null',
  from_details_json text not null default 'null',
  note_details_json text not null default 'null',
  vat real,
  tax real,
  discount real,
  subtotal real,
  top_block_json text not null default 'null',
  bottom_block_json text not null default 'null',
  template_id text,
  created_at text not null,
  updated_at text not null
);

create index if not exists invoice_recurring_series_team_id_idx
  on invoice_recurring_series (team_id);

create index if not exists invoice_recurring_series_team_status_idx
  on invoice_recurring_series (team_id, status);

create index if not exists invoice_recurring_series_status_next_scheduled_idx
  on invoice_recurring_series (status, next_scheduled_at);

create index if not exists invoice_recurring_series_team_customer_idx
  on invoice_recurring_series (team_id, customer_id);

create index if not exists invoice_recurring_series_team_created_idx
  on invoice_recurring_series (team_id, created_at desc);
