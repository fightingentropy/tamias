-- Hashes only; no authorisation codes, tokens or personal tax data.
create table hmrc_oauth_states (
  state_hash text primary key,
  browser_hash text not null,
  expires_at integer not null
);
create index hmrc_oauth_states_expiry_idx on hmrc_oauth_states(expires_at);
