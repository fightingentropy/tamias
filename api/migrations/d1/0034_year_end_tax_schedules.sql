create table if not exists corporation_tax_adjustments (
  id text primary key,
  team_id text not null,
  filing_profile_id text not null,
  period_key text not null,
  category text not null default 'other',
  label text not null,
  amount real not null,
  note text,
  created_by text,
  created_at text not null,
  updated_at text not null
);

create index if not exists corporation_tax_adjustments_period_idx
  on corporation_tax_adjustments (team_id, filing_profile_id, period_key, created_at);

create table if not exists close_company_loans_schedules (
  id text primary key,
  team_id text not null,
  filing_profile_id text not null,
  period_key text not null,
  before_end_period integer not null check (before_end_period in (0, 1)),
  loans_made_json text not null default '[]',
  tax_chargeable real,
  relief_earlier_than_json text not null default '[]',
  relief_earlier_due real,
  loan_later_relief_now_json text not null default '[]',
  relief_later_due real,
  total_loans_outstanding real,
  created_by text,
  created_at text not null,
  updated_at text not null
);

create unique index if not exists close_company_loans_schedules_period_idx
  on close_company_loans_schedules (team_id, filing_profile_id, period_key);

create table if not exists corporation_tax_rate_schedules (
  id text primary key,
  team_id text not null,
  filing_profile_id text not null,
  period_key text not null,
  exempt_distributions real,
  associated_companies_this_period integer,
  associated_companies_first_year integer,
  associated_companies_second_year integer,
  created_by text,
  created_at text not null,
  updated_at text not null
);

create unique index if not exists corporation_tax_rate_schedules_period_idx
  on corporation_tax_rate_schedules (team_id, filing_profile_id, period_key);
