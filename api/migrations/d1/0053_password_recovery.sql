create table auth_password_resets (
  token_hash text primary key,
  account_id text not null references auth_accounts(id) on delete cascade,
  created_at text not null,
  expires_at text not null,
  used_at text,
  claim_id text
);

create index auth_password_resets_account_created_idx
  on auth_password_resets(account_id, created_at);
