create table if not exists operation_idempotency (
  team_id text not null,
  operation_scope text not null,
  idempotency_key text not null,
  request_hash text not null,
  status text not null check (
    status in ('pending', 'succeeded', 'failed', 'reconciliation_required')
  ),
  result_json text,
  error_message text,
  attempt_count integer not null default 1 check (attempt_count >= 1),
  lease_token text not null,
  lease_expires_at text,
  created_at text not null,
  updated_at text not null,
  primary key (team_id, operation_scope, idempotency_key)
);

create trigger if not exists submission_events_no_update
before update on submission_events
BEGIN
  select raise(abort, 'submission events are immutable');
END;

create trigger if not exists submission_events_no_delete
before delete on submission_events
BEGIN
  select raise(abort, 'submission events are immutable');
END;

create table if not exists immutable_audit_events (
  id text primary key,
  team_id text not null,
  actor_type text not null check (actor_type in ('user', 'customer', 'service', 'webhook', 'system', 'mcp')),
  actor_id text not null,
  action text not null,
  resource_type text not null,
  resource_id text,
  idempotency_key text,
  confirmation_id text,
  environment text not null,
  payload_json text not null,
  created_at text not null
);

create unique index if not exists immutable_audit_events_idempotency_idx
  on immutable_audit_events (team_id, action, idempotency_key)
  where idempotency_key is not null;
create index if not exists immutable_audit_events_resource_idx
  on immutable_audit_events (team_id, resource_type, resource_id, created_at);

create trigger if not exists immutable_audit_events_no_update
before update on immutable_audit_events
BEGIN
  select raise(abort, 'immutable audit events cannot be updated');
END;

create trigger if not exists immutable_audit_events_no_delete
before delete on immutable_audit_events
BEGIN
  select raise(abort, 'immutable audit events cannot be deleted');
END;

create table if not exists transactional_outbox (
  id text primary key,
  team_id text not null,
  topic text not null,
  aggregate_type text not null,
  aggregate_id text not null,
  idempotency_key text not null,
  payload_json text not null,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  available_at text not null,
  published_at text,
  last_error text,
  created_at text not null,
  updated_at text not null,
  unique (team_id, topic, idempotency_key)
);

create index if not exists transactional_outbox_pending_idx
  on transactional_outbox (published_at, available_at, created_at);

create table if not exists dead_letter_messages (
  id text primary key,
  queue_name text not null,
  message_id text not null,
  team_id text,
  body_json text not null,
  failure_reason text not null,
  delivery_attempts integer not null check (delivery_attempts >= 0),
  created_at text not null,
  unique (queue_name, message_id)
);

create index if not exists dead_letter_messages_queue_created_idx
  on dead_letter_messages (queue_name, created_at);

create trigger if not exists dead_letter_messages_no_update
before update on dead_letter_messages
BEGIN
  select raise(abort, 'dead-letter records cannot be updated');
END;

create trigger if not exists dead_letter_messages_no_delete
before delete on dead_letter_messages
BEGIN
  select raise(abort, 'dead-letter records cannot be deleted');
END;
