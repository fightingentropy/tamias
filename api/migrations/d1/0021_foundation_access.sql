create table if not exists api_keys (
  id text primary key,
  name text not null,
  key_hash text not null,
  scopes_json text not null default '[]',
  team_id text not null,
  user_id text not null,
  created_at text not null,
  last_used_at text,
  updated_at text not null
);

create unique index if not exists api_keys_hash_idx on api_keys (key_hash);
create index if not exists api_keys_team_idx on api_keys (team_id);
create index if not exists api_keys_user_idx on api_keys (user_id);
create index if not exists api_keys_updated_at_idx on api_keys (updated_at);

create table if not exists oauth_applications (
  id text primary key,
  name text not null,
  slug text not null,
  description text,
  overview text,
  developer_name text,
  logo_url text,
  website text,
  install_url text,
  screenshots_json text not null default '[]',
  redirect_uris_json text not null default '[]',
  client_id text not null,
  client_secret_hash text not null,
  scopes_json text not null default '[]',
  team_id text not null,
  created_by_user_id text not null,
  created_at text not null,
  updated_at text not null,
  is_public integer not null check (is_public in (0, 1)),
  active integer not null check (active in (0, 1)),
  status text not null check (status in ('draft', 'pending', 'approved', 'rejected'))
);

create unique index if not exists oauth_applications_client_id_idx
  on oauth_applications (client_id);
create unique index if not exists oauth_applications_slug_idx on oauth_applications (slug);
create index if not exists oauth_applications_team_idx on oauth_applications (team_id);
create index if not exists oauth_applications_created_by_idx
  on oauth_applications (created_by_user_id);
create index if not exists oauth_applications_team_status_idx
  on oauth_applications (team_id, status);

create table if not exists oauth_authorization_codes (
  id text primary key,
  application_id text not null,
  user_id text not null,
  team_id text not null,
  code_hash text not null,
  scopes_json text not null default '[]',
  redirect_uri text not null,
  expires_at text not null,
  created_at text not null,
  used integer not null default 0 check (used in (0, 1)),
  used_at text,
  code_challenge text,
  code_challenge_method text,
  updated_at text not null
);

create unique index if not exists oauth_authorization_codes_hash_idx
  on oauth_authorization_codes (code_hash);
create index if not exists oauth_authorization_codes_application_idx
  on oauth_authorization_codes (application_id);
create index if not exists oauth_authorization_codes_user_idx on oauth_authorization_codes (user_id);
create index if not exists oauth_authorization_codes_team_idx on oauth_authorization_codes (team_id);
create index if not exists oauth_authorization_codes_expires_idx
  on oauth_authorization_codes (expires_at);

create table if not exists oauth_access_tokens (
  id text primary key,
  application_id text not null,
  user_id text not null,
  team_id text not null,
  authorization_code_id text,
  token_hash text not null,
  refresh_token_hash text,
  scopes_json text not null default '[]',
  expires_at text not null,
  refresh_token_expires_at text,
  created_at text not null,
  last_used_at text,
  revoked integer not null default 0 check (revoked in (0, 1)),
  revoked_at text,
  updated_at text not null
);

create unique index if not exists oauth_access_tokens_hash_idx on oauth_access_tokens (token_hash);
create unique index if not exists oauth_access_tokens_refresh_hash_idx
  on oauth_access_tokens (refresh_token_hash)
  where refresh_token_hash is not null;
create index if not exists oauth_access_tokens_application_idx
  on oauth_access_tokens (application_id);
create index if not exists oauth_access_tokens_user_idx on oauth_access_tokens (user_id);
create index if not exists oauth_access_tokens_team_idx on oauth_access_tokens (team_id);
create index if not exists oauth_access_tokens_user_team_idx
  on oauth_access_tokens (user_id, team_id);
create index if not exists oauth_access_tokens_application_user_team_idx
  on oauth_access_tokens (application_id, user_id, team_id);
create index if not exists oauth_access_tokens_expires_idx on oauth_access_tokens (expires_at);
