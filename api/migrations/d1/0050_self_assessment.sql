-- Sole-trader working papers are independent of company/VAT filing profiles.
create table if not exists self_assessment_profiles (
  team_id text not null,
  tax_year integer not null,
  profile_json text not null,
  updated_by text not null,
  updated_at text not null,
  primary key (team_id, tax_year)
);
create table if not exists self_assessment_reviews (
  team_id text not null,
  tax_year integer not null,
  transaction_id text not null,
  source_version text not null,
  category text not null,
  business_percent integer not null check (business_percent between 0 and 100),
  note text not null default '',
  reviewed_by text not null,
  reviewed_at text not null,
  primary key (team_id, tax_year, transaction_id)
);
create table if not exists self_assessment_submissions (
  id text primary key,
  team_id text not null,
  tax_year integer not null,
  environment text not null check (environment in ('test', 'production')),
  status text not null check (status in ('prepared', 'pending', 'acknowledged', 'accepted', 'rejected', 'unknown')),
  request_fingerprint text not null,
  body_xml text not null,
  review_json text not null,
  ir_mark text not null,
  ir_mark_display text not null,
  correlation_id text,
  receipt_json text,
  receipt_xml text,
  response_endpoint text,
  next_poll_at text,
  created_at text not null,
  updated_at text not null,
  submitted_by text not null,
  unique (team_id, id)
);
create index if not exists self_assessment_submissions_team_year
  on self_assessment_submissions (team_id, tax_year, created_at);
-- An uncertain outcome must be reconciled, never replaced by a second live return.
create unique index if not exists self_assessment_one_live_return
  on self_assessment_submissions (team_id, tax_year)
  where environment = 'production' and status in ('pending', 'acknowledged', 'accepted', 'unknown');
