create table if not exists async_runs (
  id text primary key,
  team_id text,
  app_user_id text,
  provider text not null check (provider in ('cloudflare-queue', 'cloudflare-workflow', 'cloudflare-schedule')),
  kind text not null check (kind in ('job', 'workflow', 'schedule')),
  provider_run_id text,
  provider_queue_name text,
  provider_job_name text,
  status text not null check (
    status in ('waiting', 'active', 'completed', 'failed', 'delayed', 'canceled', 'unknown')
  ),
  progress real,
  progress_step text,
  result_json text,
  error text,
  metadata_json text,
  started_at text,
  completed_at text,
  canceled_at text,
  created_at text not null,
  updated_at text not null
);

create index if not exists async_runs_team_id_idx on async_runs (team_id);
create index if not exists async_runs_app_user_id_idx on async_runs (app_user_id);
create index if not exists async_runs_provider_run_idx on async_runs (provider, provider_run_id);
create index if not exists async_runs_updated_at_idx on async_runs (updated_at);
