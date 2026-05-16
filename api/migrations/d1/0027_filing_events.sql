create table if not exists filing_sequences (
  scope text primary key,
  next_value integer not null,
  created_at text not null,
  updated_at text not null
);

create table if not exists submission_events (
  id text primary key,
  team_id text not null,
  filing_profile_id text not null,
  provider text not null,
  obligation_type text not null,
  vat_return_id text,
  status text not null,
  event_type text not null,
  correlation_id text,
  request_payload_json text,
  response_payload_json text,
  error_message text,
  created_at text not null
);

create index if not exists submission_events_team_id_idx on submission_events (team_id);
create index if not exists submission_events_team_vat_return_id_idx on submission_events (team_id, vat_return_id);
create index if not exists submission_events_provider_obligation_idx on submission_events (provider, obligation_type);
create index if not exists submission_events_created_at_idx on submission_events (created_at);
