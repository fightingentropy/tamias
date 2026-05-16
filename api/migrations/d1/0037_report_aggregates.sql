create table if not exists transaction_metric_aggregates (
  team_id text not null,
  scope text not null check (scope in ('base', 'native')),
  date text not null,
  currency text not null,
  direction text not null check (direction in ('income', 'expense')),
  category_slug text,
  recurring integer not null check (recurring in (0, 1)),
  total_amount real not null,
  total_net_amount real,
  transaction_count integer not null check (transaction_count >= 0),
  created_at text,
  updated_at text not null
);

create index if not exists transaction_metric_aggregates_team_scope_currency_date_idx
  on transaction_metric_aggregates (team_id, scope, currency, date);

create index if not exists transaction_metric_aggregates_team_scope_currency_date_direction_idx
  on transaction_metric_aggregates (
    team_id,
    scope,
    currency,
    date,
    direction,
    category_slug,
    recurring
  );

create table if not exists transaction_recurring_aggregates (
  team_id text not null,
  scope text not null check (scope in ('base', 'native')),
  direction text not null check (direction in ('income', 'expense')),
  currency text not null,
  date text not null,
  name text not null,
  frequency text check (
    frequency in ('weekly', 'biweekly', 'monthly', 'semi_monthly', 'annually', 'irregular', 'unknown')
    or frequency is null
  ),
  category_slug text,
  total_amount real not null,
  transaction_count integer not null check (transaction_count >= 0),
  latest_amount real not null,
  latest_transaction_created_at text not null,
  created_at text,
  updated_at text not null
);

create index if not exists transaction_recurring_aggregates_team_scope_direction_currency_date_idx
  on transaction_recurring_aggregates (team_id, scope, direction, currency, date);

create index if not exists transaction_recurring_aggregates_team_scope_direction_currency_name_idx
  on transaction_recurring_aggregates (
    team_id,
    scope,
    direction,
    currency,
    name,
    frequency,
    category_slug,
    date
  );

create table if not exists transaction_tax_aggregates (
  team_id text not null,
  scope text not null check (scope in ('base', 'native')),
  date text not null,
  currency text not null,
  direction text not null check (direction in ('income', 'expense')),
  category_slug text,
  tax_type text,
  tax_rate real not null,
  total_tax_amount real not null,
  total_transaction_amount real not null,
  transaction_count integer not null check (transaction_count >= 0),
  created_at text,
  updated_at text not null
);

create index if not exists transaction_tax_aggregates_team_scope_direction_currency_date_idx
  on transaction_tax_aggregates (team_id, scope, direction, currency, date);

create index if not exists transaction_tax_aggregates_team_scope_currency_date_direction_idx
  on transaction_tax_aggregates (
    team_id,
    scope,
    currency,
    date,
    direction,
    category_slug,
    tax_type,
    tax_rate
  );

create table if not exists invoice_aggregates (
  team_id text not null,
  scope_key text not null,
  customer_id text,
  status text not null,
  currency text not null,
  invoice_count integer not null check (invoice_count >= 0),
  total_amount real not null,
  oldest_due_date text,
  latest_issue_date text,
  created_at text,
  updated_at text not null
);

create index if not exists invoice_aggregates_team_scope_idx
  on invoice_aggregates (team_id, scope_key);

create index if not exists invoice_aggregates_team_scope_status_idx
  on invoice_aggregates (team_id, scope_key, status);

create index if not exists invoice_aggregates_team_scope_status_currency_idx
  on invoice_aggregates (team_id, scope_key, status, currency);

create table if not exists invoice_date_aggregates (
  team_id text not null,
  status text not null,
  date_field text not null check (date_field in ('issueDate', 'paidAt')),
  date text not null,
  currency text not null,
  recurring integer not null check (recurring in (0, 1)),
  invoice_count integer not null check (invoice_count >= 0),
  total_amount real not null,
  valid_payment_count integer not null check (valid_payment_count >= 0),
  on_time_count integer not null check (on_time_count >= 0),
  total_days_to_pay real not null,
  created_at text,
  updated_at text not null
);

create index if not exists invoice_date_aggregates_team_status_date_field_date_idx
  on invoice_date_aggregates (team_id, status, date_field, date);

create index if not exists invoice_date_aggregates_team_status_date_field_currency_idx
  on invoice_date_aggregates (team_id, status, date_field, currency, recurring, date);

create table if not exists invoice_customer_date_aggregates (
  team_id text not null,
  customer_id text not null,
  status text not null,
  date_field text not null check (date_field in ('createdAt', 'paidAt')),
  date text not null,
  currency text not null,
  invoice_count integer not null check (invoice_count >= 0),
  total_amount real not null,
  created_at text,
  updated_at text not null
);

create index if not exists invoice_customer_date_aggregates_team_status_date_field_date_idx
  on invoice_customer_date_aggregates (team_id, status, date_field, date);

create index if not exists invoice_customer_date_aggregates_team_customer_status_date_field_idx
  on invoice_customer_date_aggregates (
    team_id,
    customer_id,
    status,
    date_field,
    currency,
    date
  );

create table if not exists invoice_analytics_aggregates (
  team_id text not null,
  date_field text not null check (date_field in ('createdAt', 'sentAt', 'paidAt')),
  date text not null,
  status text not null,
  currency text not null,
  due_date text,
  invoice_count integer not null check (invoice_count >= 0),
  total_amount real not null,
  issue_to_paid_valid_count integer not null check (issue_to_paid_valid_count >= 0),
  issue_to_paid_total_days real not null,
  sent_to_paid_valid_count integer not null check (sent_to_paid_valid_count >= 0),
  sent_to_paid_total_days real not null,
  created_at text,
  updated_at text not null
);

create index if not exists invoice_analytics_aggregates_team_date_field_date_idx
  on invoice_analytics_aggregates (team_id, date_field, date);

create index if not exists invoice_analytics_aggregates_team_date_field_status_date_idx
  on invoice_analytics_aggregates (team_id, date_field, status, date);

create table if not exists invoice_aging_aggregates (
  team_id text not null,
  status text not null,
  currency text not null,
  issue_date text,
  due_date text,
  invoice_count integer not null check (invoice_count >= 0),
  total_amount real not null,
  created_at text,
  updated_at text not null
);

create index if not exists invoice_aging_aggregates_team_status_idx
  on invoice_aging_aggregates (team_id, status);

create index if not exists invoice_aging_aggregates_team_status_currency_issue_due_idx
  on invoice_aging_aggregates (team_id, status, currency, issue_date, due_date);
