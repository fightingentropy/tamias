create table if not exists transactions (
  id text primary key,
  team_id text not null,
  created_at text not null,
  updated_at text not null,
  date text not null,
  name text not null,
  method text not null check (
    method in (
      'payment',
      'card_purchase',
      'card_atm',
      'transfer',
      'other',
      'unknown',
      'ach',
      'interest',
      'deposit',
      'wire',
      'fee'
    )
  ),
  amount real not null,
  currency text not null,
  assigned_id text,
  note text,
  bank_account_id text,
  internal_id text not null,
  status text not null check (
    status in ('posted', 'pending', 'excluded', 'completed', 'archived', 'exported')
  ),
  balance real,
  manual integer not null check (manual in (0, 1)),
  notified integer not null default 0 check (notified in (0, 1)),
  internal integer not null default 0 check (internal in (0, 1)),
  description text,
  category_slug text,
  base_amount real,
  counterparty_name text,
  base_currency text,
  tax_amount real,
  tax_rate real,
  tax_type text,
  recurring integer not null default 0 check (recurring in (0, 1)),
  frequency text check (
    frequency in ('weekly', 'biweekly', 'monthly', 'semi_monthly', 'annually', 'irregular', 'unknown')
    or frequency is null
  ),
  merchant_name text,
  enrichment_completed integer not null default 0 check (enrichment_completed in (0, 1)),
  has_attachment integer not null default 0 check (has_attachment in (0, 1)),
  search_text text,
  search_amount integer
);

create unique index if not exists transactions_team_internal_id_idx
  on transactions (team_id, internal_id);
create index if not exists transactions_team_id_idx
  on transactions (team_id);
create index if not exists transactions_team_date_idx
  on transactions (team_id, date, id);
create index if not exists transactions_team_bank_account_date_idx
  on transactions (team_id, bank_account_id, date, id);
create index if not exists transactions_team_notified_date_idx
  on transactions (team_id, notified, date, id);
create index if not exists transactions_team_search_amount_idx
  on transactions (team_id, search_amount, date, id);
create index if not exists transactions_team_status_date_idx
  on transactions (team_id, status, date, id);
create index if not exists transactions_updated_at_idx
  on transactions (updated_at);

create table if not exists transaction_tags (
  id text primary key,
  team_id text not null,
  transaction_id text not null,
  tag_id text not null,
  transaction_date text,
  created_at text not null,
  updated_at text not null
);

create unique index if not exists transaction_tags_team_transaction_tag_idx
  on transaction_tags (team_id, transaction_id, tag_id);
create index if not exists transaction_tags_team_id_idx
  on transaction_tags (team_id);
create index if not exists transaction_tags_team_transaction_idx
  on transaction_tags (team_id, transaction_id);
create index if not exists transaction_tags_team_tag_idx
  on transaction_tags (team_id, tag_id);
create index if not exists transaction_tags_team_tag_transaction_date_idx
  on transaction_tags (team_id, tag_id, transaction_date, transaction_id);
