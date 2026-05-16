create table if not exists insight_records (
  id text primary key,
  team_id text not null,
  period_type text not null check (period_type in ('weekly', 'monthly', 'quarterly', 'yearly')),
  period_start text not null,
  period_end text not null,
  period_year integer not null,
  period_number integer not null,
  status text not null check (status in ('pending', 'generating', 'completed', 'failed')),
  selected_metrics_json text,
  all_metrics_json text,
  anomalies_json text,
  expense_anomalies_json text,
  milestones_json text,
  activity_json text,
  currency text not null,
  title text,
  content_json text,
  predictions_json text,
  generated_at text,
  created_at text not null,
  updated_at text not null,
  unique (team_id, period_type, period_year, period_number)
);

create index if not exists insight_records_team_id_idx on insight_records (team_id);
create index if not exists insight_records_team_period_idx on insight_records (
  team_id,
  period_type,
  period_year,
  period_number
);
create index if not exists insight_records_team_status_idx on insight_records (team_id, status);
create index if not exists insight_records_generated_at_idx on insight_records (generated_at);

create table if not exists insight_user_statuses (
  user_id text not null,
  insight_id text not null,
  read_at text,
  dismissed_at text,
  created_at text not null,
  updated_at text not null,
  primary key (user_id, insight_id)
);

create index if not exists insight_user_statuses_user_id_idx on insight_user_statuses (user_id);
create index if not exists insight_user_statuses_insight_id_idx on insight_user_statuses (insight_id);
