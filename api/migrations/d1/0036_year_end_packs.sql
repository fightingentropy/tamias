create table if not exists year_end_packs (
  id text primary key,
  team_id text not null,
  filing_profile_id text not null,
  period_key text not null,
  period_start text not null,
  period_end text not null,
  accounts_due_date text not null,
  corporation_tax_due_date text not null,
  status text not null check (status in ('draft', 'ready', 'exported')),
  currency text not null,
  trial_balance_json text not null,
  profit_and_loss_json text not null,
  balance_sheet_json text not null,
  retained_earnings_json text not null,
  working_papers_json text not null,
  corporation_tax_json text not null,
  manual_journal_count integer not null,
  payroll_run_count integer not null,
  export_bundles_json text not null default '[]',
  latest_exported_at text,
  snapshot_checksum text not null,
  created_at text not null,
  updated_at text not null
);

create unique index if not exists year_end_packs_period_idx
  on year_end_packs (team_id, filing_profile_id, period_key);
create index if not exists year_end_packs_team_id_idx on year_end_packs (team_id);
