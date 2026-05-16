create table if not exists compliance_journal_entries (
  journal_entry_id text primary key,
  team_id text not null,
  entry_date text not null,
  reference text,
  description text,
  source_type text not null check (
    source_type in (
      'transaction',
      'invoice',
      'invoice_refund',
      'manual_adjustment',
      'payroll_import'
    )
  ),
  source_id text not null,
  currency text not null,
  meta_json text,
  lines_json text not null,
  created_at text not null,
  updated_at text not null
);

create unique index if not exists compliance_journal_entries_team_source_idx on compliance_journal_entries (
  team_id,
  source_type,
  source_id
);
create index if not exists compliance_journal_entries_team_entry_date_idx on compliance_journal_entries (
  team_id,
  entry_date
);
create index if not exists compliance_journal_entries_team_source_type_idx on compliance_journal_entries (
  team_id,
  source_type
);
create index if not exists compliance_journal_entries_updated_at_idx on compliance_journal_entries (
  updated_at
);

create table if not exists source_links (
  id text primary key,
  team_id text not null,
  source_type text not null check (
    source_type in (
      'transaction',
      'invoice',
      'invoice_refund',
      'inbox',
      'manual_adjustment',
      'payroll_import'
    )
  ),
  source_id text not null,
  journal_entry_id text not null,
  meta_json text,
  created_at text not null,
  updated_at text not null
);

create unique index if not exists source_links_team_source_idx on source_links (
  team_id,
  source_type,
  source_id
);
create index if not exists source_links_team_source_type_idx on source_links (
  team_id,
  source_type
);
create index if not exists source_links_journal_entry_idx on source_links (journal_entry_id);
create index if not exists source_links_updated_at_idx on source_links (updated_at);
