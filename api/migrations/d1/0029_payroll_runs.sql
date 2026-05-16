create table if not exists payroll_runs (
  id text primary key,
  team_id text not null,
  filing_profile_id text not null,
  period_key text not null,
  pay_period_start text not null,
  pay_period_end text not null,
  run_date text not null,
  source text not null check (source in ('csv', 'manual')),
  status text not null check (status in ('imported', 'exported')),
  checksum text not null,
  currency text not null,
  journal_entry_id text not null,
  line_count integer not null,
  liability_gross_pay real not null,
  liability_employer_taxes real not null,
  liability_paye real not null,
  export_bundles_json text not null,
  latest_exported_at text,
  meta_json text,
  created_by text,
  created_at text not null,
  updated_at text not null
);

create unique index if not exists payroll_runs_team_period_idx on payroll_runs (
  team_id,
  period_key
);
create index if not exists payroll_runs_team_pay_period_end_idx on payroll_runs (
  team_id,
  pay_period_end desc
);
create index if not exists payroll_runs_team_run_date_idx on payroll_runs (
  team_id,
  run_date desc
);
create index if not exists payroll_runs_updated_at_idx on payroll_runs (updated_at);
