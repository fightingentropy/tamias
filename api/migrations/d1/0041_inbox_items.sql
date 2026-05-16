create table if not exists inbox_items (
  id text primary key,
  team_id text not null,
  created_at text not null,
  updated_at text not null,
  file_path text not null,
  file_path_key text not null,
  file_name text,
  transaction_id text,
  amount real,
  currency text,
  content_type text,
  size integer,
  attachment_id text,
  date text,
  forwarded_to text,
  reference_id text,
  meta text,
  status text not null check (
    status in (
      'new',
      'archived',
      'processing',
      'done',
      'pending',
      'analyzing',
      'suggested_match',
      'no_match',
      'other',
      'deleted'
    )
  ),
  website text,
  sender_email text,
  display_name text,
  type text check (type is null or type in ('invoice', 'expense', 'other')),
  description text,
  base_amount real,
  base_currency text,
  tax_amount real,
  tax_rate real,
  tax_type text,
  inbox_account_id text,
  invoice_number text,
  grouped_inbox_id text,
  search_text text,
  search_eligible integer not null default 0,
  search_amount integer,
  created_at_day text generated always as (substr(created_at, 1, 10)) virtual
);

create index if not exists idx_inbox_items_team_created_at
  on inbox_items(team_id, created_at);
create index if not exists idx_inbox_items_status_created_at
  on inbox_items(status, created_at);
create index if not exists idx_inbox_items_team_status_created_at
  on inbox_items(team_id, status, created_at);
create index if not exists idx_inbox_items_team_reference_id
  on inbox_items(team_id, reference_id);
create index if not exists idx_inbox_items_team_transaction_id
  on inbox_items(team_id, transaction_id);
create index if not exists idx_inbox_items_team_grouped_inbox_id
  on inbox_items(team_id, grouped_inbox_id);
create index if not exists idx_inbox_items_team_invoice_number
  on inbox_items(team_id, invoice_number);
create index if not exists idx_inbox_items_team_file_path_key
  on inbox_items(team_id, file_path_key);
create index if not exists idx_inbox_items_team_date
  on inbox_items(team_id, date);
create index if not exists idx_inbox_items_team_search_amount
  on inbox_items(team_id, search_eligible, search_amount);

create virtual table if not exists inbox_items_fts using fts5(
  id unindexed,
  team_id unindexed,
  search_text
);

create table if not exists transaction_match_suggestions (
  id text primary key,
  team_id text not null,
  inbox_id text not null,
  transaction_id text not null,
  normalized_inbox_name text,
  normalized_transaction_name text,
  confidence_score real not null,
  amount_score real,
  currency_score real,
  date_score real,
  name_score real,
  match_type text not null check (match_type in ('auto_matched', 'high_confidence', 'suggested')),
  match_details text,
  status text not null check (
    status in ('pending', 'confirmed', 'declined', 'expired', 'unmatched')
  ),
  user_action_at text,
  user_id text,
  created_at text not null,
  updated_at text not null,
  unique(team_id, inbox_id, transaction_id)
);

create index if not exists idx_transaction_match_suggestions_team
  on transaction_match_suggestions(team_id);
create index if not exists idx_transaction_match_suggestions_team_inbox
  on transaction_match_suggestions(team_id, inbox_id);
create index if not exists idx_transaction_match_suggestions_team_transaction
  on transaction_match_suggestions(team_id, transaction_id);
create index if not exists idx_transaction_match_suggestions_team_status_created_at
  on transaction_match_suggestions(team_id, status, created_at);
