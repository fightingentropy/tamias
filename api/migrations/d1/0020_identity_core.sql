create table if not exists users (
  id text primary key,
  auth_user_id text,
  email text,
  full_name text,
  avatar_url text,
  locale text not null default 'en',
  week_starts_on_monday integer not null default 0 check (week_starts_on_monday in (0, 1)),
  timezone text,
  timezone_auto_sync integer not null default 1 check (timezone_auto_sync in (0, 1)),
  time_format integer not null default 24 check (time_format in (12, 24)),
  date_format text,
  ai_provider text not null default 'openai' check (ai_provider in ('openai', 'kimi', 'openrouter')),
  current_team_id text,
  created_at text not null,
  updated_at text not null
);

create unique index if not exists users_auth_user_id_idx
  on users (auth_user_id)
  where auth_user_id is not null;
create unique index if not exists users_email_idx on users (email) where email is not null;
create index if not exists users_current_team_idx on users (current_team_id);
create index if not exists users_updated_at_idx on users (updated_at);

create table if not exists auth_accounts (
  id text primary key,
  user_id text not null,
  provider text not null,
  provider_account_id text not null,
  secret_hash text,
  email_verified_at text,
  phone_verified_at text,
  created_at text not null,
  updated_at text not null
);

create unique index if not exists auth_accounts_provider_account_idx
  on auth_accounts (provider, provider_account_id);
create index if not exists auth_accounts_user_provider_idx on auth_accounts (user_id, provider);

create table if not exists auth_sessions (
  id text primary key,
  user_id text not null,
  expires_at text not null,
  revoked_at text,
  created_at text not null,
  updated_at text not null,
  last_used_at text,
  user_agent text,
  ip_hash text
);

create index if not exists auth_sessions_user_idx on auth_sessions (user_id);
create index if not exists auth_sessions_expires_idx on auth_sessions (expires_at);
create index if not exists auth_sessions_revoked_idx on auth_sessions (revoked_at);

create table if not exists auth_refresh_tokens (
  id text primary key,
  session_id text not null,
  token_hash text not null,
  parent_refresh_token_id text,
  expires_at text not null,
  first_used_at text,
  revoked_at text,
  created_at text not null
);

create unique index if not exists auth_refresh_tokens_hash_idx on auth_refresh_tokens (token_hash);
create index if not exists auth_refresh_tokens_session_idx on auth_refresh_tokens (session_id);
create index if not exists auth_refresh_tokens_session_parent_idx
  on auth_refresh_tokens (session_id, parent_refresh_token_id);
create index if not exists auth_refresh_tokens_expires_idx on auth_refresh_tokens (expires_at);

create table if not exists auth_rate_limits (
  identifier text primary key,
  last_attempt_at text not null,
  attempts_left integer not null,
  reset_at text
);

create index if not exists auth_rate_limits_reset_idx on auth_rate_limits (reset_at);

create table if not exists teams (
  id text primary key,
  name text,
  logo_url text,
  inbox_id text,
  email text,
  base_currency text,
  country_code text,
  fiscal_year_start_month integer,
  export_settings_json text,
  created_at text not null,
  canceled_at text,
  plan text,
  subscription_status text,
  stripe_account_id text,
  stripe_connect_status text,
  company_type text,
  heard_about text,
  next_invoice_sequence integer,
  updated_at text not null
);

create unique index if not exists teams_inbox_id_idx on teams (inbox_id) where inbox_id is not null;
create unique index if not exists teams_stripe_account_id_idx
  on teams (stripe_account_id)
  where stripe_account_id is not null;
create index if not exists teams_created_at_idx on teams (created_at);
create index if not exists teams_updated_at_idx on teams (updated_at);

create table if not exists team_memberships (
  id text primary key,
  team_id text not null,
  user_id text not null,
  role text not null check (role in ('owner', 'member')),
  created_at text not null,
  updated_at text not null
);

create unique index if not exists team_memberships_team_user_idx
  on team_memberships (team_id, user_id);
create index if not exists team_memberships_team_idx on team_memberships (team_id);
create index if not exists team_memberships_user_idx on team_memberships (user_id);

create table if not exists team_invites (
  id text primary key,
  team_id text not null,
  email text,
  role text not null check (role in ('owner', 'member')),
  invited_by_user_id text,
  created_at text not null,
  updated_at text not null
);

create unique index if not exists team_invites_team_email_idx
  on team_invites (team_id, email)
  where email is not null;
create index if not exists team_invites_team_idx on team_invites (team_id);
create index if not exists team_invites_email_idx on team_invites (email);
