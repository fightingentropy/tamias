create table if not exists public_invoices (
  id text primary key,
  team_id text not null,
  token text not null,
  status text not null,
  payment_intent_id text,
  viewed_at text,
  invoice_number text,
  invoice_recurring_id text,
  recurring_sequence integer,
  customer_id text,
  customer_name text,
  currency text,
  amount real,
  issue_date text,
  sent_at text,
  due_date text,
  paid_at text,
  search_text text,
  payload_json text not null,
  created_at text not null,
  updated_at text not null
);

create unique index if not exists public_invoices_token_idx
  on public_invoices (token);

create unique index if not exists public_invoices_team_invoice_number_idx
  on public_invoices (team_id, invoice_number)
  where invoice_number is not null;

create unique index if not exists public_invoices_payment_intent_idx
  on public_invoices (payment_intent_id)
  where payment_intent_id is not null;

create index if not exists public_invoices_team_created_idx
  on public_invoices (team_id, created_at);

create index if not exists public_invoices_team_status_created_idx
  on public_invoices (team_id, status, created_at);

create index if not exists public_invoices_team_customer_idx
  on public_invoices (team_id, customer_id);

create index if not exists public_invoices_team_customer_issue_idx
  on public_invoices (team_id, customer_id, issue_date);

create index if not exists public_invoices_team_issue_idx
  on public_invoices (team_id, issue_date);

create index if not exists public_invoices_team_sent_idx
  on public_invoices (team_id, sent_at);

create index if not exists public_invoices_team_due_idx
  on public_invoices (team_id, due_date);

create index if not exists public_invoices_team_paid_idx
  on public_invoices (team_id, paid_at);

create index if not exists public_invoices_team_status_issue_idx
  on public_invoices (team_id, status, issue_date);

create index if not exists public_invoices_team_status_due_idx
  on public_invoices (team_id, status, due_date);

create index if not exists public_invoices_team_status_paid_idx
  on public_invoices (team_id, status, paid_at);

create index if not exists public_invoices_team_recurring_idx
  on public_invoices (team_id, invoice_recurring_id);

create index if not exists public_invoices_team_recurring_sequence_idx
  on public_invoices (team_id, invoice_recurring_id, recurring_sequence);

create index if not exists public_invoices_status_idx
  on public_invoices (status);
